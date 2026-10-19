// Run on a trusted workstation with a browser. Credentials stay outside the checkout.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { GSC_SCOPE } from '../server/services/gsc.mjs';
const [credentialsPath, outputPath] = process.argv.slice(2);
if (!credentialsPath || !outputPath) {
    console.error('Usage: node scripts/connect-gsc.mjs /private/google-desktop-client.json /private/gsc.env');
    process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(fs.realpathSync(path.dirname(path.resolve(outputPath))), path.basename(outputPath));
if (output === root || output.startsWith(root + path.sep)) throw new Error('Output must be outside the repository and public web root.');
if (fs.existsSync(output)) throw new Error('Output already exists; choose a new private filename.');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8')).installed;
if (!credentials?.client_id || !credentials?.client_secret) throw new Error('Use a Google OAuth Desktop app credentials JSON file.');
const state = randomBytes(32).toString('base64url');
const verifier = randomBytes(48).toString('base64url');
let used = false, redirectUri;
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, redirectUri);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const receivedState = Buffer.from(url.searchParams.get('state') || '');
    if (req.method !== 'GET' || url.pathname !== '/callback' || used || receivedState.length !== Buffer.byteLength(state) || !timingSafeEqual(receivedState, Buffer.from(state))) {
        res.writeHead(400); res.end('Invalid authorization callback.'); return;
    }
    used = true;
    try {
        if (url.searchParams.has('error') || !url.searchParams.get('code')) throw new Error('Google authorization was declined.');
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST', signal: AbortSignal.timeout(20000),
            body: new URLSearchParams({ client_id: credentials.client_id, client_secret: credentials.client_secret,
                code: url.searchParams.get('code'), code_verifier: verifier, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
        });
        const tokens = await response.json();
        if (!response.ok || !tokens.refresh_token || !String(tokens.scope || '').split(' ').includes(GSC_SCOPE)) throw new Error('Google did not grant offline read access. Check the consent configuration and retry.');
        const values = { GSC_CLIENT_ID: credentials.client_id, GSC_CLIENT_SECRET: credentials.client_secret, GSC_REFRESH_TOKEN: tokens.refresh_token };
        if (Object.values(values).some(value => /[\r\n]/.test(value))) throw new Error('Invalid credential format.');
        fs.writeFileSync(output, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
        res.end('Search Console authorized. You may close this window.');
        console.log('Saved private GSC environment file. Install it in the portal service environment; never paste its contents into chat or Git.');
    } catch {
        process.exitCode = 1;
        res.writeHead(400); res.end('Authorization failed. Check the Google consent configuration and retry.');
        console.error('GSC connection failed; no tokens were printed.');
    } finally { clearTimeout(timer); server.close(); }
});
const timer = setTimeout(() => { console.error('Authorization timed out.'); process.exitCode = 1; server.close(); }, 5 * 60 * 1000);
server.listen(0, '127.0.0.1', () => {
    redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: credentials.client_id, redirect_uri: redirectUri, response_type: 'code',
        scope: GSC_SCOPE, access_type: 'offline', prompt: 'consent select_account', state,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
    console.log('Open this URL on this computer and choose the Google account with access to the client properties:\n' + url);
});
