import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { jwtVerify, createLocalJWKSet } from 'jose';
import { createUser } from '../server/auth.mjs';
import { MCP_READ_TOOLS, MCP_WRITE_TOOLS } from '../server/mcp-tools.mjs';

process.env.REMOTE_MCP_API_KEY ||= 'ld-test-remote-mcp-key-32chars-xxxx';
process.env.PORTAL_API_KEY ||= 'ld-test-portal-api-key';
process.env.PORTAL_BIND ||= '127.0.0.1';
process.env.REMOTE_MCP_READ_ONLY = '1';
process.env.OAUTH_SECRET ||= 'ld-test-oauth-secret-32-chars-minimum';
process.env.OAUTH_ADMIN_EMAIL ||= 'gary@leannedigital.com';
process.env.OAUTH_ADMIN_PASSWORD ||= 'oauth-admin-test-password';
process.env.OAUTH_ACCESS_TOKEN_TTL ||= '8';
process.env.OAUTH_DATA_DIR ||= fs.mkdtempSync(path.join(os.tmpdir(), 'ld-oauth-flow-'));

const { startPortal } = await import('../server/api.mjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN_EMAIL = process.env.OAUTH_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.OAUTH_ADMIN_PASSWORD;
const STATIC_KEY = process.env.REMOTE_MCP_API_KEY;
const PORTAL_KEY = process.env.PORTAL_API_KEY;

let failures = 0;
function check(label, ok, detail = '') {
    const mark = ok ? 'PASS' : 'FAIL';
    if (!ok) failures += 1;
    console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ''}`);
}

function pkce() {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

class CookieJar {
    constructor() {
        this.store = new Map();
    }
    absorb(res) {
        const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
        for (const cookie of raw) {
            const [pair] = cookie.split(';');
            const eq = pair.indexOf('=');
            if (eq < 0) continue;
            const name = pair.slice(0, eq);
            const value = pair.slice(eq + 1);
            if (/Max-Age=0/i.test(cookie) || /Expires=Thu, 01 Jan 1970/i.test(cookie)) {
                this.store.delete(name);
            } else {
                this.store.set(name, value);
            }
        }
    }
    header() {
        return [...this.store.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
    }
}

const { server, port } = await startPortal({ port: 0, bind: '127.0.0.1' });
const BASE = `http://127.0.0.1:${port}`;
const RESOURCE = `${BASE}/mcp`;
const REDIRECT_URI = 'http://127.0.0.1:9/callback';

async function fetchRaw(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const res = await fetch(url, { redirect: 'manual', ...options, headers });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = null; }
    const location = res.headers.get('location')
        || (json?.redirect === true && json.url ? String(json.url) : '')
        || (typeof json?.url === 'string' && json.redirect ? String(json.url) : '');
    return { res, text, json, location, status: res.status };
}

function decodeEntities(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function hiddenValue(html, name) {
    const match = html.match(new RegExp(`name="${name}" value="([^"]*)"`));
    return decodeEntities(match?.[1] || '');
}

function rpcPayload(id, method, params) {
    return { jsonrpc: '2.0', id, method, params };
}

async function mcpPost(token, body) {
    const headers = {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const raw = await res.text();
    let json = null;
    try {
        json = JSON.parse(raw);
    } catch {
        const match = raw.match(/data:\s*(\{[\s\S]*\})/);
        if (match) {
            try { json = JSON.parse(match[1]); } catch { json = null; }
        }
    }
    return { status: res.status, json, raw, headers: res.headers };
}

function toolText(result) {
    const text = result.json?.result?.content?.[0]?.text || '';
    try { return JSON.parse(text); } catch { return text; }
}

const missing = await mcpPost('', rpcPayload(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'oauth-test', version: '0.0.1' },
}));
const www = missing.headers.get('www-authenticate') || '';
check('1. /mcp without auth returns OAuth-aware 401', missing.status === 401, `status=${missing.status} body=${JSON.stringify(missing.json).slice(0, 120)}`);
check('2. WWW-Authenticate includes resource_metadata',
    /resource_metadata="[^"]+"/.test(www),
    www.slice(0, 220));

const prmUrl = `${BASE}/.well-known/oauth-protected-resource/mcp`;
const prm = await fetchRaw(prmUrl);
check('3. protected resource metadata is valid',
    prm.status === 200
        && prm.json?.resource === RESOURCE
        && Array.isArray(prm.json?.authorization_servers)
        && prm.json.authorization_servers[0]?.startsWith('http://127.0.0.1:')
        && prm.json.scopes_supported?.includes('mcp:read')
        && prm.json.scopes_supported?.includes('offline_access'),
    JSON.stringify(prm.json));

const asMeta = await fetchRaw(`${BASE}/.well-known/oauth-authorization-server`);
const metadata = asMeta.json || {};
check('4. authorization server metadata is valid',
    asMeta.status === 200
        && metadata.issuer
        && metadata.authorization_endpoint
        && metadata.token_endpoint
        && metadata.registration_endpoint
        && metadata.response_types_supported?.includes('code')
        && metadata.grant_types_supported?.includes('authorization_code')
        && metadata.grant_types_supported?.includes('refresh_token')
        && metadata.code_challenge_methods_supported?.includes('S256')
        && metadata.scopes_supported?.includes('mcp:read'),
    JSON.stringify({
        issuer: metadata.issuer,
        authorization_endpoint: metadata.authorization_endpoint,
        token_endpoint: metadata.token_endpoint,
        registration_endpoint: metadata.registration_endpoint,
        code_challenge_methods_supported: metadata.code_challenge_methods_supported,
        scopes_supported: metadata.scopes_supported,
    }));

const dcr = await fetchRaw(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({
        client_name: 'OAuth test client',
        redirect_uris: [REDIRECT_URI],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: 'mcp:read offline_access',
    }),
});
const clientId = dcr.json?.client_id;
check('5. DCR/client registration works as intended',
    (dcr.status === 201 || dcr.status === 200)
        && Boolean(clientId)
        && !dcr.json?.client_secret,
    `status=${dcr.status} client_id=${clientId ? 'yes' : 'no'} secret=${dcr.json?.client_secret ? 'present' : 'none'}`);

const dcrWrite = await fetchRaw(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({
        client_name: 'Write scope probe',
        redirect_uris: [REDIRECT_URI],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: 'mcp:read mcp:write offline_access',
    }),
});
const registeredScope = String(dcrWrite.json?.scope || '');
check('5b. DCR cannot register mcp:write',
    (dcrWrite.status >= 400 && !dcrWrite.json?.client_id)
        || (Boolean(dcrWrite.json?.client_id) && !registeredScope.split(/\s+/).includes('mcp:write')),
    `status=${dcrWrite.status} scope=${registeredScope || dcrWrite.json?.error || 'none'}`);

async function completeAuthorization({ scope = 'mcp:read offline_access', verifier, challenge, email = ADMIN_EMAIL, password = ADMIN_PASSWORD }) {
    const cookies = new CookieJar();
    const state = randomBytes(16).toString('hex');
    const authorize = new URL(metadata.authorization_endpoint);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('redirect_uri', REDIRECT_URI);
    authorize.searchParams.set('scope', scope);
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('code_challenge', challenge);
    authorize.searchParams.set('code_challenge_method', 'S256');
    authorize.searchParams.set('resource', RESOURCE);

    let current = authorize.toString();
    let html = '';
    let last = null;
    for (let i = 0; i < 8; i += 1) {
        last = await fetchRaw(current, { headers: { Cookie: cookies.header(), Origin: BASE } });
        cookies.absorb(last.res);
        if (last.location) {
            current = new URL(last.location, current).toString();
            if (current.startsWith(REDIRECT_URI)) break;
            continue;
        }
        html = last.text;
        break;
    }

    if (!current.startsWith(REDIRECT_URI) && /oauth\/login/.test(current + html)) {
        const loginUrl = current.includes('/oauth/login') ? current : `${BASE}/oauth/login${authorize.search}`;
        const loginPage = html.includes('name="csrf"') ? last : await fetchRaw(loginUrl, { headers: { Cookie: cookies.header(), Origin: BASE } });
        cookies.absorb(loginPage.res);
        const csrf = hiddenValue(loginPage.text, 'csrf');
        const returnQuery = hiddenValue(loginPage.text, 'return_query') || new URL(loginUrl).searchParams.toString();
        const posted = await fetchRaw(`${BASE}/oauth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Origin: BASE,
                Cookie: cookies.header(),
                Referer: loginUrl,
            },
            body: new URLSearchParams({
                email,
                password,
                csrf,
                return_query: returnQuery,
            }).toString(),
        });
        cookies.absorb(posted.res);
        if (posted.status === 403) {
            return { denied: true, status: posted.status, body: posted.text, cookies };
        }
        current = posted.location ? new URL(posted.location, BASE).toString() : current;
        for (let i = 0; i < 8; i += 1) {
            last = await fetchRaw(current, { headers: { Cookie: cookies.header(), Origin: BASE } });
            cookies.absorb(last.res);
            if (last.location) {
                current = new URL(last.location, current).toString();
                if (current.startsWith(REDIRECT_URI)) break;
                continue;
            }
            html = last.text;
            break;
        }
    }

    if (!current.startsWith(REDIRECT_URI) && /oauth\/consent/.test(current + html)) {
        const consentUrl = current.includes('/oauth/consent') ? current : `${BASE}/oauth/consent${new URL(current).search}`;
        const consentPage = html.includes('name="csrf"') ? last : await fetchRaw(consentUrl, { headers: { Cookie: cookies.header(), Origin: BASE } });
        cookies.absorb(consentPage.res);
        const csrf = hiddenValue(consentPage.text, 'csrf');
        const oauthQuery = hiddenValue(consentPage.text, 'oauth_query');
        const posted = await fetchRaw(`${BASE}/oauth/consent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Origin: BASE,
                Cookie: cookies.header(),
                Referer: consentUrl,
            },
            body: new URLSearchParams({ csrf, decision: 'allow', oauth_query: oauthQuery }).toString(),
        });
        cookies.absorb(posted.res);
        if (!(posted.status >= 300 && posted.status < 400 && posted.location)) {
            return {
                denied: false,
                code: '',
                state: '',
                location: posted.location || current,
                html: posted.text,
                status: posted.status,
                consentError: (posted.text.match(/<p class="error">([^<]+)<\/p>/) || [posted.text, posted.text])[1].slice(0, 300),
                cookies,
            };
        }
        current = posted.location ? new URL(posted.location, BASE).toString() : current;
    }

    const redirected = current.startsWith(REDIRECT_URI) ? new URL(current) : null;
    return {
        denied: false,
        code: redirected?.searchParams.get('code') || '',
        state: redirected?.searchParams.get('state') || '',
        location: current,
        html,
        status: last?.status,
        cookies,
    };
}

async function exchangeCode({ code, verifier, expectOk = true }) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
        resource: RESOURCE,
    });
    const token = await fetchRaw(metadata.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE },
        body: body.toString(),
    });
    if (!expectOk) return token;
    return token;
}

const goodPkce = pkce();
const authorized = await completeAuthorization(goodPkce);
check('6. Authorization Code + S256 PKCE',
    Boolean(authorized.code) && authorized.state,
    `code=${authorized.code ? 'yes' : 'no'} status=${authorized.status} location=${authorized.location.slice(0, 80)} err=${(authorized.consentError || authorized.html || '').replace(/\s+/g, ' ').slice(0, 220)}`);

const tokens = await exchangeCode({ code: authorized.code, verifier: goodPkce.verifier });
const accessToken = tokens.json?.access_token;
const refreshToken = tokens.json?.refresh_token;
check('6b. token endpoint returns access + refresh tokens',
    tokens.status === 200 && Boolean(accessToken) && Boolean(refreshToken),
    `status=${tokens.status} keys=${Object.keys(tokens.json || {}).join(',')}`);

const badPkce = pkce();
const authorizedBad = await completeAuthorization(badPkce);
const badToken = await exchangeCode({ code: authorizedBad.code, verifier: 'wrong-verifier-value-that-is-long-enough-xx', expectOk: false });
check('7. invalid PKCE verifier fails',
    badToken.status >= 400 && !badToken.json?.access_token,
    `status=${badToken.status} error=${badToken.json?.error || badToken.text.slice(0, 80)}`);

const init = await mcpPost(accessToken, rpcPayload(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'oauth-test', version: '0.0.1' },
}));
check('8. access token can call initialize',
    init.status === 200 && Boolean(init.json?.result?.protocolVersion || init.json?.result?.serverInfo),
    JSON.stringify(init.json?.result?.serverInfo || init.json?.error || { status: init.status }));

const listed = await mcpPost(accessToken, rpcPayload(2, 'tools/list', {}));
const names = (listed.json?.result?.tools || []).map((tool) => tool.name);
check('9. access token can call tools/list',
    listed.status === 200 && MCP_READ_TOOLS.every((name) => names.includes(name)),
    `count=${names.length}`);
check('9b. OAuth/read-only does not expose write tools',
    MCP_WRITE_TOOLS.every((name) => !names.includes(name)),
    `writes=${MCP_WRITE_TOOLS.filter((name) => names.includes(name)).join(',') || 'none'}`);

const seo = await mcpPost(accessToken, rpcPayload(3, 'tools/call', { name: 'list_seo_clients', arguments: {} }));
const seoBody = toolText(seo);
check('10. access token can call list_seo_clients',
    seo.status === 200 && Array.isArray(seoBody.clients),
    `clients=${seoBody.clients?.length}`);

const missingScopePkce = pkce();
const missingScopeAuth = await completeAuthorization({ ...missingScopePkce, scope: 'offline_access' });
const missingScopeTokens = missingScopeAuth.code
    ? await exchangeCode({ code: missingScopeAuth.code, verifier: missingScopePkce.verifier })
    : { status: 0, json: {} };
const missingScopeMcp = missingScopeTokens.json?.access_token
    ? await mcpPost(missingScopeTokens.json.access_token, rpcPayload(1, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'oauth-test', version: '0.0.1' },
    }))
    : { status: 0, json: {}, headers: new Headers() };
check('13. missing scope is rejected',
    missingScopeMcp.status === 403 || missingScopeMcp.status === 401 || !missingScopeTokens.json?.access_token,
    `tokenStatus=${missingScopeTokens.status} mcpStatus=${missingScopeMcp.status} error=${missingScopeMcp.json?.error || missingScopeTokens.json?.error || ''}`);

const refreshed = await fetchRaw(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE },
    body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        resource: RESOURCE,
    }).toString(),
});
const refreshedInit = refreshed.json?.access_token
    ? await mcpPost(refreshed.json.access_token, rpcPayload(14, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'oauth-test', version: '0.0.1' },
    }))
    : { status: 0, json: {} };
check('14. refresh_token obtains a replacement access token',
    refreshed.status === 200
        && Boolean(refreshed.json?.access_token)
        && Boolean(refreshed.json?.refresh_token)
        && refreshedInit.status === 200,
    `status=${refreshed.status} access_changed=${refreshed.json?.access_token !== accessToken} refresh_rotated=${refreshed.json?.refresh_token !== refreshToken} mcp=${refreshedInit.status}`);

const staticInit = await mcpPost(STATIC_KEY, rpcPayload(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'oauth-test', version: '0.0.1' },
}));
check('15. static REMOTE_MCP_API_KEY still works',
    staticInit.status === 200 && Boolean(staticInit.json?.result),
    `status=${staticInit.status}`);

const portalOnMcp = await mcpPost(PORTAL_KEY, rpcPayload(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'oauth-test', version: '0.0.1' },
}));
check('16. PORTAL_API_KEY still does NOT work against /mcp',
    portalOnMcp.status === 401,
    `status=${portalOnMcp.status}`);

try {
    await createUser({
        email: 'oauth-client-user@example.com',
        password: 'client-pass-1234',
        role: 'client',
        clientSlug: 'oauth-test-client',
        name: 'OAuth Client User',
    });
} catch (error) {
    if (error.status !== 409) throw error;
}
const clientPkce = pkce();
const clientAuth = await completeAuthorization({
    ...clientPkce,
    email: 'oauth-client-user@example.com',
    password: 'client-pass-1234',
});
check('17. client portal users cannot authorize agency MCP',
    clientAuth.denied === true || !clientAuth.code,
    `denied=${clientAuth.denied} code=${clientAuth.code ? 'yes' : 'no'} status=${clientAuth.status}`);

try {
    const jwksRes = await fetchRaw(`${BASE}/oauth/jwks`);
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'));
    const wrongAud = await jwtVerify(accessToken, createLocalJWKSet(jwksRes.json), {
        issuer: metadata.issuer,
        audience: 'https://example.com/not-mcp',
    }).then(() => ({ rejected: false })).catch((error) => ({ rejected: true, message: error.message }));
    check('12. wrong audience/resource token is rejected',
        wrongAud.rejected === true && Array.isArray(payload.aud ? [payload.aud].flat() : []) && (payload.aud === RESOURCE || payload.aud?.includes?.(RESOURCE)),
        `aud=${JSON.stringify(payload.aud)} rejected=${wrongAud.rejected} ${wrongAud.message || ''}`);
} catch (error) {
    check('12. wrong audience/resource token is rejected', false, error.message);
}

await new Promise((resolve) => setTimeout(resolve, 16_000));
const expired = await mcpPost(accessToken, rpcPayload(9, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'oauth-test', version: '0.0.1' },
}));
check('11. expired token is rejected',
    expired.status === 401,
    `status=${expired.status} error=${expired.json?.error || expired.json?.error_description || ''}`);

const health = await fetch(`${BASE}/health`);
const healthJson = await health.json();
check('19. existing HTTP APIs still work', health.status === 200 && healthJson.ok === true);

const apiClients = await fetch(`${BASE}/api/clients`, {
    headers: { Authorization: `Bearer ${PORTAL_KEY}` },
});
const apiJson = await apiClients.json();
check('19b. HTTP /api/clients still works',
    apiClients.status === 200 && Array.isArray(apiJson.clients),
    `status=${apiClients.status}`);

const child = spawn(process.execPath, ['server/mcp.mjs'], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
});
let stdioOut = '';
child.stdout.on('data', (chunk) => {
    stdioOut += chunk.toString('utf8');
});
child.stdin.write(`${JSON.stringify(rpcPayload(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'stdio-test', version: '0.0.1' },
}))}\n`);
await new Promise((resolve) => setTimeout(resolve, 1500));
child.kill('SIGTERM');
check('18. local stdio MCP still works',
    stdioOut.includes('leanne-digital') || stdioOut.includes('protocolVersion') || stdioOut.includes('serverInfo'),
    stdioOut.slice(0, 160).replace(/\s+/g, ' '));

server.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll OAuth checks passed.');
process.exit(failures ? 1 : 0);
