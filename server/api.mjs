import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from '../scripts/load-env.mjs';
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
import { handleContact } from './contact.mjs';
import { requestPath, resolvePublicFile, sendFile } from './static.mjs';
import { saveCalendlyBooking } from '../scripts/admin-inbox.mjs';
import {
    addProjectUpdate,
    createClientProject,
    createClientWithAccount,
    createPortfolioProject,
    deleteClientWithAccount,
    deletePortfolioProject,
    getAgencyClient,
    getClientProject,
    getClientRevenue,
    getDashboardStats,
    getMonthlyRevenue,
    getRevenueByService,
    getSiteConversions,
    getSiteStatistics,
    listAgencyClients,
    listClientProjects,
    listSeoClients,
    loadCalendlyBookings,
    loadPortfolioProjects,
    loadSubmissions,
    setLeadStatus,
    setProjectStatus,
    updateClientProject,
    updateClientWithAccount,
    updatePortfolioProject,
    updatesForProject,
} from './services/agency.mjs';
import { handleRemoteMcp, isMcpPath } from './mcp-http.mjs';

loadEnv();

const PORT = Number(process.env.PORTAL_API_PORT || 4174);
const BIND = process.env.PORTAL_BIND || '127.0.0.1';
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
    const isAdminDash = pathname === '/admin' || pathname.startsWith('/admin/');
    const isClientHub = pathname === '/clients' || pathname === '/clients/';
    const isClientPage = pathname.startsWith('/clients/');
    const isClientAsset = pathname.startsWith('/assets/clients/');
    if (!isAdminDash && !isClientHub && !isClientPage && !isClientAsset) return 'allow';
    if (!user) return 'login';
    if (user.role === 'staff') return 'allow';
    const own = user.clientSlug;
    if (!own) return 'forbid';
    if (isAdminDash || isClientHub) return 'own';
    if (isClientAsset) {
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

function queryFrom(req) {
    return Object.fromEntries(new URL(req.url, originFrom(req)).searchParams);
}

function requireStaff(user, req, res) {
    if (user.role !== 'staff') {
        json(req, res, 403, { error: 'Staff only' });
        return false;
    }
    return true;
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
    if (pathname === '/api/webhooks/calendly' && method === 'POST') {
        const secret = String(process.env.CALENDLY_WEBHOOK_SECRET || '').trim();
        const provided =
            req.headers['x-webhook-secret'] ||
            new URL(req.url, originFrom(req)).searchParams.get('secret') ||
            '';
        if (secret && provided !== secret) return json(req, res, 401, { error: 'Unauthorized' });
        const body = await readBody(req);
        const booking = saveCalendlyBooking(body);
        return json(req, res, 200, { ok: true, booking });
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
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, { stats: getDashboardStats() });
        return true;
    }
    if (pathname === '/api/admin/dashboard' && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, {
            clients: listAgencyClients(user),
            projects: loadPortfolioProjects(),
            inbox: loadSubmissions(),
            calendly: loadCalendlyBookings(),
        });
        return true;
    }
    if (pathname === '/api/revenue' && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, getMonthlyRevenue(queryFrom(req).month));
        return true;
    }
    if (pathname === '/api/revenue/by-service' && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, getRevenueByService(queryFrom(req).month));
        return true;
    }
    const clientRevenue = pathname.match(/^\/api\/revenue\/clients\/([^/]+)$/);
    if (clientRevenue && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, getClientRevenue(decodeURIComponent(clientRevenue[1]), queryFrom(req).month));
        return true;
    }
    if (pathname === '/api/analytics/statistics' && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, await getSiteStatistics({ month: queryFrom(req).month }));
        return true;
    }
    if (pathname === '/api/analytics/conversions' && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, await getSiteConversions({ month: queryFrom(req).month }));
        return true;
    }
    if (pathname === '/api/projects' && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        const query = queryFrom(req);
        json(req, res, 200, { projects: listClientProjects(query) });
        return true;
    }
    if (pathname === '/api/projects' && method === 'POST') {
        if (!requireStaff(user, req, res)) return true;
        const body = await readBody(req);
        const project = createClientProject(body, user);
        json(req, res, 201, { project });
        return true;
    }
    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)(?:\/([^/]+))?$/);
    if (projectMatch) {
        if (!requireStaff(user, req, res)) return true;
        const id = decodeURIComponent(projectMatch[1]);
        const action = projectMatch[2] || '';
        if (action === 'pause' && method === 'POST') {
            json(req, res, 200, { project: setProjectStatus(id, 'paused', { ...user, message: 'Paused' }) });
            return true;
        }
        if (action === 'resume' && method === 'POST') {
            json(req, res, 200, { project: setProjectStatus(id, 'active', { ...user, message: 'Resumed' }) });
            return true;
        }
        if (action === 'complete' && method === 'POST') {
            json(req, res, 200, { project: setProjectStatus(id, 'completed', { ...user, message: 'Completed' }) });
            return true;
        }
        if (action === 'updates' && method === 'GET') {
            json(req, res, 200, { updates: updatesForProject(id) });
            return true;
        }
        if (action === 'updates' && method === 'POST') {
            const body = await readBody(req);
            json(req, res, 201, { update: addProjectUpdate(id, { ...body, createdBy: user.email }) });
            return true;
        }
        if (action) {
            json(req, res, 404, { error: 'Not found' });
            return true;
        }
        if (method === 'GET') {
            const project = getClientProject(id);
            if (!project) return json(req, res, 404, { error: 'Project not found' });
            json(req, res, 200, { project, updates: updatesForProject(id) });
            return true;
        }
        if (method === 'PATCH') {
            const body = await readBody(req);
            json(req, res, 200, { project: updateClientProject(id, body, user) });
            return true;
        }
        json(req, res, 404, { error: 'Not found' });
        return true;
    }
    if (pathname === '/api/portfolio' && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, { projects: loadPortfolioProjects() });
        return true;
    }
    if (pathname === '/api/portfolio' && method === 'POST') {
        if (!requireStaff(user, req, res)) return true;
        const body = await readBody(req);
        const project = await createPortfolioProject(body);
        json(req, res, 201, { project, projects: loadPortfolioProjects() });
        return true;
    }
    const portfolioMatch = pathname.match(/^\/api\/portfolio\/([^/]+)$/);
    if (portfolioMatch) {
        if (!requireStaff(user, req, res)) return true;
        const slug = decodeURIComponent(portfolioMatch[1]);
        if (method === 'PATCH') {
            const body = await readBody(req);
            const project = await updatePortfolioProject(slug, body);
            json(req, res, 200, { project, projects: loadPortfolioProjects() });
            return true;
        }
        if (method === 'DELETE') {
            const project = await deletePortfolioProject(slug);
            json(req, res, 200, { deleted: true, project, projects: loadPortfolioProjects() });
            return true;
        }
        json(req, res, 404, { error: 'Not found' });
        return true;
    }
    if (pathname === '/api/leads' && method === 'PATCH') {
        if (!requireStaff(user, req, res)) return true;
        const body = await readBody(req);
        json(req, res, 200, setLeadStatus(body.id, body.status));
        return true;
    }
    if (pathname === '/api/inbox' && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, { inbox: loadSubmissions() });
        return true;
    }
    if (pathname === '/api/calendly' && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, { bookings: loadCalendlyBookings() });
        return true;
    }
    if (pathname === '/api/clients' && method === 'GET') {
        const query = queryFrom(req);
        json(req, res, 200, { clients: listAgencyClients(user, query) });
        return true;
    }
    if (pathname === '/api/clients/seo' && method === 'GET') {
        if (!requireStaff(user, req, res)) return true;
        json(req, res, 200, { clients: listSeoClients() });
        return true;
    }
    if (pathname === '/api/clients' && method === 'POST') {
        if (!requireStaff(user, req, res)) return true;
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
        const client = getAgencyClient(id);
        if (user.role !== 'staff' && client.slug !== user.clientSlug) {
            return json(req, res, 403, { error: 'Forbidden' });
        }
        json(req, res, 200, { client, projects: listClientProjects({ client: client.slug }) });
        return true;
    }
    if (!requireStaff(user, req, res)) return true;
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
    const rawPath = requestPath(req.url);
    const pathname =
        rawPath.startsWith('/api/') && rawPath.endsWith('/') && rawPath.length > 5
            ? rawPath.slice(0, -1)
            : rawPath;
    if (isMcpPath(pathname)) {
        await handleRemoteMcp(req, res);
        return;
    }

    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders(req));
        res.end();
        return;
    }
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
    if (pathname === '/admin-dashboard' || pathname.startsWith('/admin-dashboard/')) {
        redirect(res, '/admin/');
        return;
    }
    const authHandled = await handleAuth(req, res, method, pathname);
    if (authHandled !== false) return;

    const { user } = actor(req);
    if (await handleApi(req, res, method, pathname, user)) return;

    const { user: pageUser } = getSessionUser(req);
    handleStatic(req, res, pathname, pageUser ? publicUser(pageUser) : null);
}

export function createPortalServer() {
    return http.createServer((req, res) => {
        handle(req, res).catch((error) => {
            json(req, res, error.status || 500, { error: error.message || 'Server error' });
        });
    });
}

export function startPortal({ port = PORT, bind = BIND } = {}) {
    const server = createPortalServer();
    return new Promise((resolve, reject) => {
        server.listen(port, bind, async () => {
            try {
                const staff = await seedStaffAccount();
                const accounts = await ensureClientAccounts();
                const address = server.address();
                const actualPort = typeof address === 'object' && address ? address.port : port;
                console.log(`Client portal http://${bind}:${actualPort}/login/`);
                console.log(`Admin dashboard http://${bind}:${actualPort}/admin/`);
                console.log(`API http://${bind}:${actualPort}/api/clients`);
                console.log(`Remote MCP http://${bind}:${actualPort}/mcp`);
                if (staff?.temporaryPassword) {
                    console.log(`Staff login ${staff.email} / ${staff.temporaryPassword}`);
                    console.log('This password is also in data/portal-bootstrap.json (not committed).');
                }
                if (accounts.length) {
                    console.log(`Created ${accounts.length} client logins. Temporary passwords: data/portal-bootstrap.json`);
                }
                resolve({ server, port: actualPort, bind, staff, accounts });
            } catch (err) {
                reject(err);
            }
        });
        server.on('error', reject);
    });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    await startPortal();
}
