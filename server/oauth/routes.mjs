import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { getOAuth, startOAuth } from './auth.mjs';
import {
    CSRF_COOKIE,
    MAX_OAUTH_BODY_BYTES,
    MCP_SCOPE_READ,
    OAUTH_BASE_PATH,
    OAUTH_CONSENT_PATH,
    OAUTH_LOGIN_PATH,
    OAUTH_SCOPES,
    isHttpsIssuer,
    oauthEnabled,
} from './config.mjs';
import { consentPageHtml, loginPageHtml, oauthErrorPageHtml } from './pages.mjs';
import { isOAuthStaffEmail, oauthStaffDeniedMessage } from './staff.mjs';

const hits = new Map();

function allowRequest(id, max = 20) {
    const now = Date.now();
    const recent = (hits.get(id) || []).filter((stamp) => now - stamp < 60_000);
    if (recent.length >= max) {
        hits.set(id, recent);
        return false;
    }
    recent.push(now);
    hits.set(id, recent);
    return true;
}

function clientIp(req) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || String(req.socket?.remoteAddress || 'unknown');
}

function requestPathname(req) {
    const host = req.headers.host || '127.0.0.1';
    return new URL(req.url || '/', `http://${host}`).pathname.replace(/\/$/, '') || '/';
}

function requestUrl(req) {
    const host = req.headers.host || '127.0.0.1';
    return new URL(req.url || '/', `http://${host}`);
}

function sendHtml(res, status, html, extraHeaders = {}) {
    res.writeHead(status, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        ...extraHeaders,
    });
    res.end(html);
}

function sendJson(res, status, body, extraHeaders = {}) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...extraHeaders,
    });
    res.end(JSON.stringify(body));
}

function publicCors() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version',
        'Access-Control-Max-Age': '600',
        'Access-Control-Expose-Headers': 'WWW-Authenticate',
    };
}

function cookieValue(header, name) {
    const match = String(header || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : '';
}

function csrfCookieHeader(token, issuer) {
    const secure = isHttpsIssuer(issuer) ? '; Secure' : '';
    return `${CSRF_COOKIE}=${token}; HttpOnly; Path=${OAUTH_BASE_PATH}; SameSite=Lax; Max-Age=3600${secure}`;
}

function newCsrfToken() {
    return randomBytes(16).toString('hex');
}

function safeEqual(a, b) {
    const left = Buffer.from(String(a || ''));
    const right = Buffer.from(String(b || ''));
    if (!left.length || left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}

function originAllowed(req, issuer) {
    const expected = new URL(issuer).origin;
    const origin = String(req.headers.origin || '').trim();
    if (origin) return origin === expected;
    const referer = String(req.headers.referer || '').trim();
    if (!referer) return false;
    try {
        return new URL(referer).origin === expected;
    } catch {
        return false;
    }
}

function authorizeReturnQuery(raw) {
    const params = new URLSearchParams(String(raw || ''));
    const clientId = params.get('client_id');
    const redirectUri = params.get('redirect_uri');
    if (!clientId || !redirectUri) return '';
    params.delete('password');
    params.delete('csrf');
    return params.toString();
}

async function readFormBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_OAUTH_BODY_BYTES) {
            const error = new Error('Payload too large');
            error.status = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}

function copyAuthCookies(fromResponse, extraSetCookie = []) {
    const cookies = [];
    if (typeof fromResponse.headers.getSetCookie === 'function') {
        cookies.push(...fromResponse.headers.getSetCookie());
    } else {
        const single = fromResponse.headers.get('set-cookie');
        if (single) cookies.push(single);
    }
    cookies.push(...extraSetCookie);
    return cookies;
}

async function sendFetchResponse(res, response, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    response.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower === 'transfer-encoding' || lower === 'content-length') return;
        if (lower === 'set-cookie') return;
        headers[key] = value;
    });
    const cookies = copyAuthCookies(response);
    if (cookies.length) headers['Set-Cookie'] = cookies;
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
}

function nodeHeaders(req) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(key, value);
        else if (Array.isArray(value)) headers.set(key, value.join(', '));
    }
    if (!headers.has('x-forwarded-for') && req.socket?.remoteAddress) {
        headers.set('x-forwarded-for', String(req.socket.remoteAddress));
    }
    return headers;
}

function nodeRequestToFetchRequest(req, body) {
    const init = {
        method: req.method || 'GET',
        headers: nodeHeaders(req),
    };
    if (body && !['GET', 'HEAD'].includes(req.method || 'GET')) {
        init.body = body;
    }
    return new Request(requestUrl(req), init);
}

async function readLimitedBuffer(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_OAUTH_BODY_BYTES) {
            const error = new Error('Payload too large');
            error.status = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

function redirectFromPayload(payload) {
    if (payload && payload.redirect === true && typeof payload.url === 'string' && payload.url) {
        return payload.url;
    }
    return '';
}

async function sendOAuthRedirect(res, location, response) {
    const cookies = response ? copyAuthCookies(response) : [];
    const headers = {
        Location: location,
        'Cache-Control': 'no-store',
        ...publicCors(),
    };
    if (cookies.length) headers['Set-Cookie'] = cookies;
    res.writeHead(302, headers);
    res.end();
}

export function isOAuthPath(pathname) {
    const path = pathname.replace(/\/$/, '') || '/';
    return (
        path === '/.well-known/oauth-protected-resource' ||
        path === '/.well-known/oauth-protected-resource/mcp' ||
        path === '/.well-known/oauth-authorization-server' ||
        path === '/.well-known/oauth-authorization-server/oauth' ||
        path.startsWith(`${OAUTH_BASE_PATH}/`) ||
        path === OAUTH_BASE_PATH
    );
}

export function oauthWwwAuthenticate(resource, { error = 'invalid_token', description = 'Authentication required', scopes = [MCP_SCOPE_READ] } = {}) {
    const metadataUrl = getOAuthProtectedResourceMetadataUrl(new URL(resource));
    const parts = [
        'Bearer realm="mcp"',
        `error="${error}"`,
        `error_description="${String(description).replace(/"/g, '')}"`,
        `scope="${scopes.join(' ')}"`,
        `resource_metadata="${metadataUrl}"`,
    ];
    return parts.join(', ');
}

async function handleProtectedResourceMetadata(req, res, oauth) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, publicCors());
        res.end();
        return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET, HEAD, OPTIONS', ...publicCors() });
        return;
    }
    const body = {
        resource: oauth.resource,
        authorization_servers: [oauth.issuer],
        bearer_methods_supported: ['header'],
        scopes_supported: OAUTH_SCOPES,
        resource_name: 'Leanne Digital MCP',
        resource_documentation: `${oauth.publicOrigin || oauth.issuer}${OAUTH_LOGIN_PATH}`,
    };
    const headers = {
        ...publicCors(),
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
    };
    if (req.method === 'HEAD') {
        res.writeHead(200, headers);
        res.end();
        return;
    }
    sendJson(res, 200, body, headers);
}

async function handleAuthorizationServerMetadata(req, res, oauth) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, publicCors());
        res.end();
        return;
    }
    const response = await oauth.metadataHandler(nodeRequestToFetchRequest(req));
    const headers = { ...publicCors() };
    await sendFetchResponse(res, response, headers);
}

async function handleLogin(req, res, oauth) {
    const issuer = oauth.publicOrigin || oauth.issuer;
    const url = requestUrl(req);
    if (req.method === 'GET') {
        const token = newCsrfToken();
        sendHtml(res, 200, loginPageHtml({
            csrfToken: token,
            returnQuery: url.searchParams.toString(),
        }), { 'Set-Cookie': csrfCookieHeader(token, issuer) });
        return;
    }
    if (req.method !== 'POST') {
        sendHtml(res, 405, oauthErrorPageHtml('Method not allowed'));
        return;
    }
    if (!allowRequest(`oauth-login:${clientIp(req)}`, 10)) {
        sendHtml(res, 429, oauthErrorPageHtml('Too many sign-in attempts. Try again in a minute.'));
        return;
    }
    if (!originAllowed(req, issuer)) {
        sendHtml(res, 403, oauthErrorPageHtml('Invalid request origin'));
        return;
    }
    const body = await readFormBody(req);
    const expectedCsrf = cookieValue(req.headers.cookie, CSRF_COOKIE);
    if (!expectedCsrf || !safeEqual(body.csrf, expectedCsrf)) {
        sendHtml(res, 403, oauthErrorPageHtml('Invalid or expired form token. Reload the page and try again.'));
        return;
    }
    const returnQuery = authorizeReturnQuery(body.return_query);
    if (!returnQuery) {
        sendHtml(res, 400, oauthErrorPageHtml('This sign-in page must be opened from an authorization request. Start the connection again from ChatGPT.'));
        return;
    }
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!isOAuthStaffEmail(email)) {
        const token = newCsrfToken();
        sendHtml(res, 403, loginPageHtml({
            error: oauthStaffDeniedMessage(),
            csrfToken: token,
            returnQuery,
        }), { 'Set-Cookie': csrfCookieHeader(token, issuer) });
        return;
    }

    const signIn = await oauth.auth.api.signInEmail({
        body: { email, password },
        headers: oauth.fromNodeHeaders(req.headers),
        asResponse: true,
    });

    if (!signIn.ok) {
        const token = newCsrfToken();
        sendHtml(res, 401, loginPageHtml({
            error: 'Invalid email or password',
            csrfToken: token,
            returnQuery,
        }), { 'Set-Cookie': csrfCookieHeader(token, issuer) });
        return;
    }

    const location = `${OAUTH_BASE_PATH}/oauth2/authorize?${returnQuery}`;
    const cookies = copyAuthCookies(signIn, [csrfCookieHeader(newCsrfToken(), issuer)]);
    res.writeHead(303, {
        Location: location,
        'Set-Cookie': cookies,
        'Cache-Control': 'no-store',
    });
    res.end();
}

async function handleConsent(req, res, oauth) {
    const issuer = oauth.publicOrigin || oauth.issuer;
    const session = await oauth.auth.api.getSession({
        headers: oauth.fromNodeHeaders(req.headers),
    });
    if (!session?.user) {
        const url = requestUrl(req);
        res.writeHead(302, { Location: `${OAUTH_LOGIN_PATH}?${url.searchParams.toString()}` });
        res.end();
        return;
    }
    if (!isOAuthStaffEmail(session.user.email)) {
        sendHtml(res, 403, oauthErrorPageHtml(oauthStaffDeniedMessage()));
        return;
    }

    if (req.method === 'GET') {
        const url = requestUrl(req);
        const token = newCsrfToken();
        let clientName = 'Leanne Digital MCP';
        try {
            const client = await oauth.auth.api.getOAuthClientPublic?.({
                query: { client_id: url.searchParams.get('client_id') || '' },
                headers: oauth.fromNodeHeaders(req.headers),
            });
            if (client?.name || client?.client_name) clientName = client.name || client.client_name;
        } catch {
            // Public client lookup is optional for the consent copy.
        }
        const scopes = String(url.searchParams.get('scope') || MCP_SCOPE_READ)
            .split(/\s+/)
            .filter(Boolean);
        sendHtml(res, 200, consentPageHtml({
            csrfToken: token,
            clientName,
            scopes,
            oauthQuery: url.searchParams.toString(),
        }), { 'Set-Cookie': csrfCookieHeader(token, issuer) });
        return;
    }

    if (req.method !== 'POST') {
        sendHtml(res, 405, oauthErrorPageHtml('Method not allowed'));
        return;
    }
    if (!originAllowed(req, issuer)) {
        sendHtml(res, 403, oauthErrorPageHtml('Invalid request origin'));
        return;
    }
    const body = await readFormBody(req);
    const expectedCsrf = cookieValue(req.headers.cookie, CSRF_COOKIE);
    if (!expectedCsrf || !safeEqual(body.csrf, expectedCsrf)) {
        sendHtml(res, 403, oauthErrorPageHtml('Invalid or expired form token. Reload the page and try again.'));
        return;
    }
    const accept = body.decision === 'allow';
    const refererQuery = (() => {
        try {
            return req.headers.referer ? new URL(req.headers.referer).searchParams.toString() : '';
        } catch {
            return '';
        }
    })();
    const oauthQuery = body.oauth_query || refererQuery;
    if (!oauthQuery) {
        sendHtml(res, 400, oauthErrorPageHtml('Missing authorization request. Start the connection again from ChatGPT.'));
        return;
    }
    try {
        const headers = oauth.fromNodeHeaders(req.headers);
        headers.set('content-type', 'application/json');
        headers.set('origin', oauth.publicOrigin || oauth.issuer);
        const response = await oauth.auth.handler(new Request(new URL('/oauth/oauth2/consent', oauth.publicOrigin || oauth.issuer), {
            method: 'POST',
            headers,
            body: JSON.stringify({ accept, oauth_query: oauthQuery }),
        }));
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const payload = await response.clone().json().catch(() => null);
            const next = redirectFromPayload(payload) || payload?.url;
            if (next) {
                await sendOAuthRedirect(res, next, response);
                return;
            }
        }
        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
            await sendFetchResponse(res, response, publicCors());
            return;
        }
        const payload = contentType.includes('application/json')
            ? await response.json().catch(() => null)
            : null;
        const message = payload?.message || payload?.error_description || payload?.error || `Authorization failed (${response.status})`;
        sendHtml(res, response.status >= 400 ? response.status : 400, oauthErrorPageHtml(String(message)));
    } catch (error) {
        const message = error.body?.message
            || error.body?.error_description
            || error.message
            || (error.body ? JSON.stringify(error.body) : 'Authorization failed');
        sendHtml(res, error.statusCode || 400, oauthErrorPageHtml(String(message)));
    }
}

async function handleBetterAuth(req, res, oauth) {
    let body;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET')) {
        body = await readLimitedBuffer(req);
    }
    const response = await oauth.auth.handler(nodeRequestToFetchRequest(req, body));
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const payload = await response.clone().json().catch(() => null);
        const next = redirectFromPayload(payload);
        if (next) {
            await sendOAuthRedirect(res, next, response);
            return;
        }
    }
    await sendFetchResponse(res, response, publicCors());
}

export async function handleOAuth(req, res) {
    if (!oauthEnabled()) {
        sendJson(res, 503, { error: 'OAuth is not configured' });
        return;
    }
    const oauth = getOAuth() || await startOAuth();
    if (!oauth) {
        sendJson(res, 503, { error: 'OAuth is not configured' });
        return;
    }

    const pathname = requestPathname(req);
    if (pathname === '/.well-known/oauth-protected-resource' || pathname === '/.well-known/oauth-protected-resource/mcp') {
        await handleProtectedResourceMetadata(req, res, oauth);
        return;
    }
    if (pathname === '/.well-known/oauth-authorization-server' || pathname === '/.well-known/oauth-authorization-server/oauth') {
        await handleAuthorizationServerMetadata(req, res, oauth);
        return;
    }
    if (pathname === OAUTH_LOGIN_PATH) {
        await handleLogin(req, res, oauth);
        return;
    }
    if (pathname === OAUTH_CONSENT_PATH) {
        await handleConsent(req, res, oauth);
        return;
    }

    if (req.method === 'OPTIONS' && pathname.startsWith(OAUTH_BASE_PATH)) {
        res.writeHead(204, publicCors());
        res.end();
        return;
    }

    await handleBetterAuth(req, res, oauth);
}
