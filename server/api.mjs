import http from 'node:http';
import path from 'node:path';
import { loadEnv } from '../scripts/load-env.mjs';
import { getClient, loadClients } from '../scripts/client-store.mjs';
import { portalStats } from '../scripts/portal-stats.mjs';
import { openApiSpec } from './openapi.mjs';
import {
    cookieHeader,
    destroySession,
    ensureClientAccounts,
    getSessionUser,
    login,
    publicUser,
    requestPasswordReset,
    resetPassword,
    seedStaffAccount,
} from './auth.mjs';
import {
    createClientWithAccount,
    deleteClientWithAccount,
    updateClientWithAccount,
} from './portal-service.mjs';
import { handleContact } from './contact.mjs';
import { requestPath, resolvePublicFile, sendFile } from './static.mjs';

loadEnv();

const PORT = Number(process.env.PORTAL_API_PORT || 4174);
const API_KEY = process.env.PORTAL_API_KEY || '';

function corsHeaders(req) {
    const origin = req.headers.origin || '';
    if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        };
    }
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    };
}

function json(req, res, status, body, extraHeaders = {}) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders(req),
        ...extraHeaders,
    });
    res.end(JSON.stringify(body));
}

function hasApiKey(req) {
    if (!API_KEY) return false;
    const header = req.headers['x-api-key'] || '';
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return header === API_KEY || bearer === API_KEY;
}

function actor(req) {
    const { user, session } = getSessionUser(req);
    if (user) return { user: publicUser(user), session };
    if (hasApiKey(req)) return { user: { role: 'staff', email: 'api-key', clientSlug: null }, session: null };
    return { user: null, session: null };
}

function readRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function readBody(req) {
    return readRawBody(req).then((raw) => {
        if (!raw) return {};
        try {
            return JSON.parse(raw);
        } catch {
            throw Object.assign(new Error('Invalid JSON'), { status: 400 });
        }
    });
}

function parseFormBody(raw, req) {
    const params = new URLSearchParams(raw);
    return {
        name: params.get('name') || '',
        email: params.get('email') || '',
        message: params.get('message') || '',
        service: params.get('service') || '',
        honey: params.get('website') || params.get('_honey') || '',
        page: params.get('page') || req.headers.referer || '/',
    };
}

function originFrom(req) {
    return `http://${req.headers.host || `127.0.0.1:${PORT}`}`;
}

function clientSlugFromPath(pathname) {
    const match = pathname.match(/^\/clients\/([^/]+)/);
    return match ? match[1] : '';
}

function portalAccess(pathname, user) {
    const protectedPath =
        pathname === '/clients' ||
        pathname.startsWith('/clients/') ||
        pathname.startsWith('/assets/clients/');
    if (!protectedPath) return 'allow';
    if (!user) return 'login';
    if (user.role === 'staff') return 'allow';
    const own = user.clientSlug;
    if (!own) return 'forbid';
    if (pathname === '/clients' || pathname === '/clients/') return 'own';
    if (pathname.startsWith('/assets/clients/')) {
        const assetSlug = pathname.split('/')[3] || '';
        return assetSlug === own ? 'allow' : 'forbid';
    }
    const slug = clientSlugFromPath(pathname);
    if (slug === 'shift' && own === 'shift-physiotherapy') return 'allow';
    return slug === own ? 'allow' : 'forbid';
}

function redirect(res, location, status = 302) {
    res.writeHead(status, { Location: location });
    res.end();
}

function forbidden(res) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!DOCTYPE html><title>Forbidden</title><p>You do not have access to this page.</p>');
}

function visibleClients(user) {
    const clients = loadClients();
    if (user?.role === 'staff') return clients;
    if (user?.clientSlug) return clients.filter((client) => client.slug === user.clientSlug);
    return [];
}

async function handleAuth(req, res, method, pathname) {
    if (pathname === '/api/auth/me' && method === 'GET') {
        const { user } = getSessionUser(req);
        if (!user) return json(req, res, 401, { error: 'Unauthorized' });
        return json(req, res, 200, { user: publicUser(user) });
    }
    if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await readBody(req);
        const { user, session } = await login(body.email, body.password);
        return json(req, res, 200, { user }, { 'Set-Cookie': cookieHeader(session.id) });
    }
    if (pathname === '/api/auth/logout' && method === 'POST') {
        const { session } = getSessionUser(req);
        if (session) destroySession(session.id);
        return json(req, res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', { clear: true }) });
    }
    if (pathname === '/api/auth/forgot' && method === 'POST') {
        const body = await readBody(req);
        const result = await requestPasswordReset(body.email, originFrom(req));
        return json(req, res, 200, result);
    }
    if (pathname === '/api/auth/reset' && method === 'POST') {
        const body = await readBody(req);
        const user = await resetPassword(body.token, body.password);
        return json(req, res, 200, { user });
    }
    if (pathname === '/api/contact' && method === 'POST') {
        const body = await readBody(req);
        const result = await handleContact(req, body);
        return json(req, res, 200, result);
    }
    return false;
}

async function handleApi(req, res, method, pathname, user) {
    if (pathname === '/health') {
        json(req, res, 200, { ok: true });
        return true;
    }
    if (pathname === '/api/openapi.json' && method === 'GET') {
        json(req, res, 200, openApiSpec(PORT));
        return true;
    }
    if (!pathname.startsWith('/api/')) return false;
    if (!user) {
        json(req, res, 401, { error: 'Unauthorized' });
        return true;
    }

    if (pathname === '/api/dashboard' && method === 'GET') {
        if (user.role !== 'staff') return json(req, res, 403, { error: 'Staff only' });
        json(req, res, 200, { stats: portalStats(loadClients()) });
        return true;
    }
    if (pathname === '/api/clients' && method === 'GET') {
        json(req, res, 200, { clients: visibleClients(user) });
        return true;
    }
    if (pathname === '/api/clients' && method === 'POST') {
        if (user.role !== 'staff') return json(req, res, 403, { error: 'Staff only' });
        const body = await readBody(req);
        const created = await createClientWithAccount(body);
        json(req, res, 201, created);
        return true;
    }
    const match = pathname.match(/^\/api\/clients\/([^/]+)$/);
    if (!match) {
        json(req, res, 404, { error: 'Not found' });
        return true;
    }
    const id = decodeURIComponent(match[1]);
    if (method === 'GET') {
        const client = getClient(id);
        if (!client) return json(req, res, 404, { error: 'Client not found' });
        if (user.role !== 'staff' && client.slug !== user.clientSlug) {
            return json(req, res, 403, { error: 'Forbidden' });
        }
        json(req, res, 200, { client });
        return true;
    }
    if (user.role !== 'staff') return json(req, res, 403, { error: 'Staff only' });
    if (method === 'PATCH') {
        const body = await readBody(req);
        const updated = await updateClientWithAccount(id, body);
        json(req, res, 200, updated);
        return true;
    }
    if (method === 'DELETE') {
        const client = await deleteClientWithAccount(id);
        json(req, res, 200, { deleted: true, client });
        return true;
    }
    json(req, res, 404, { error: 'Not found' });
    return true;
}

function handleStatic(req, res, pathname, user) {
    let lookup = pathname;
    if (!path.extname(lookup) && !lookup.endsWith('/')) lookup = `${lookup}/`;
    const file = resolvePublicFile(lookup) || resolvePublicFile(pathname);
    if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
    }
    const access = portalAccess(pathname, user);
    if (access === 'login') {
        redirect(res, `/login/?next=${encodeURIComponent(pathname)}`);
        return;
    }
    if (access === 'own') {
        redirect(res, `/clients/${user.clientSlug}/`);
        return;
    }
    if (access === 'forbid') {
        forbidden(res);
        return;
    }
    sendFile(res, file);
}

async function handle(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders(req));
        res.end();
        return;
    }

    const pathname = requestPath(req.url);
    const method = req.method;
    if (method === 'POST' && (pathname === '/thank-you' || pathname === '/thank-you/')) {
        const raw = await readRawBody(req);
        const body = parseFormBody(raw, req);
        try {
            await handleContact(req, body);
        } catch (error) {
            console.error('Contact form:', error.message);
        }
        redirect(res, '/thank-you/', 303);
        return;
    }
    const legacy = {
        '/services/graphic-design-winnipeg/': '/graphic-design/',
        '/services/graphic-design-winnipeg': '/graphic-design/',
        '/services/web-design-winnipeg/': '/website-design/',
        '/services/web-design-winnipeg': '/website-design/',
    };
    if (legacy[pathname]) {
        redirect(res, legacy[pathname]);
        return;
    }
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        redirect(res, pathname.replace(/^\/admin/, '/clients') || '/clients/');
        return;
    }
    const authHandled = await handleAuth(req, res, method, pathname);
    if (authHandled !== false) return;

    const { user } = actor(req);
    if (await handleApi(req, res, method, pathname, user)) return;

    const { user: pageUser } = getSessionUser(req);
    handleStatic(req, res, pathname, pageUser ? publicUser(pageUser) : null);
}

const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
        json(req, res, error.status || 500, { error: error.message || 'Server error' });
    });
});

server.listen(PORT, '127.0.0.1', async () => {
    const staff = await seedStaffAccount();
    const accounts = await ensureClientAccounts();
    console.log(`Client portal http://127.0.0.1:${PORT}/login/`);
    console.log(`Admin dashboard http://127.0.0.1:${PORT}/clients/`);
    console.log(`API http://127.0.0.1:${PORT}/api/clients`);
    if (staff?.temporaryPassword) {
        console.log(`Staff login ${staff.email} / ${staff.temporaryPassword}`);
        console.log('This password is also in data/portal-bootstrap.json (not committed).');
    }
    if (accounts.length) {
        console.log(`Created ${accounts.length} client logins. Temporary passwords: data/portal-bootstrap.json`);
    }
});
