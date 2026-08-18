import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { createMcpServer } from './mcp-tools.mjs';
import { getOAuth } from './oauth/auth.mjs';
import { oauthEnabled, oauthResource, MCP_SCOPE_READ } from './oauth/config.mjs';
import { oauthWwwAuthenticate } from './oauth/routes.mjs';
import { tokenHasWriteScope, verifyMcpAccessToken } from './oauth/verify.mjs';

export const MCP_PATH = '/mcp';
const MAX_BODY_BYTES = 256 * 1024;
const RATE_LIMIT_PER_MIN = Number(process.env.REMOTE_MCP_RATE_LIMIT_PER_MIN) || 60;

const hits = new Map();

function allowRequest(id) {
    const now = Date.now();
    const recent = (hits.get(id) || []).filter((stamp) => now - stamp < 60_000);
    if (recent.length >= RATE_LIMIT_PER_MIN) {
        hits.set(id, recent);
        return false;
    }
    recent.push(now);
    hits.set(id, recent);
    return true;
}

function safeEqual(provided, expected) {
    const a = Buffer.from(String(provided || ''));
    const b = Buffer.from(String(expected || ''));
    if (a.length !== b.length || !a.length) return false;
    return timingSafeEqual(a, b);
}

function configuredKey() {
    return String(process.env.REMOTE_MCP_API_KEY || '').trim();
}

function envReadOnly() {
    return String(process.env.REMOTE_MCP_READ_ONLY || '') === '1';
}

function bearerToken(req) {
    const header = String(req.headers.authorization || '');
    if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
    return String(req.headers['x-mcp-api-key'] || '').trim();
}

function resourceUrl() {
    return getOAuth()?.resource || oauthResource();
}

function challengeHeaders({ error = 'invalid_token', description = 'Authentication required', extra = {} } = {}) {
    return {
        'WWW-Authenticate': oauthWwwAuthenticate(resourceUrl(), { error, description, scopes: [MCP_SCOPE_READ] }),
        'Access-Control-Expose-Headers': 'WWW-Authenticate',
        ...extra,
    };
}

/**
 * Dedicated remote-MCP credential, plus OAuth access tokens.
 * PORTAL_API_KEY is intentionally not accepted here.
 */
export async function authenticateRemoteMcp(req) {
    const expected = configuredKey();
    const oauthOn = oauthEnabled() && Boolean(getOAuth());
    if (!expected && !oauthOn) {
        return { ok: false, status: 503, error: 'Remote MCP is not configured (set REMOTE_MCP_API_KEY or OAuth)' };
    }

    const provided = bearerToken(req);
    if (provided && expected && safeEqual(provided, expected)) {
        return {
            ok: true,
            method: 'api-key',
            readOnly: envReadOnly(),
            actorEmail: 'remote-mcp',
        };
    }

    if (provided && oauthOn) {
        const verified = await verifyMcpAccessToken(provided, {
            audience: resourceUrl(),
            requiredScopes: [MCP_SCOPE_READ],
        });
        if (verified.ok) {
            return {
                ok: true,
                method: 'oauth',
                readOnly: envReadOnly() || !tokenHasWriteScope(verified.scopes),
                actorEmail: verified.email || verified.subject || 'oauth',
                scopes: verified.scopes,
            };
        }
        if (verified.error === 'insufficient_scope') {
            return {
                ok: false,
                status: 403,
                error: verified.error,
                error_description: verified.description,
            };
        }
        return {
            ok: false,
            status: 401,
            error: 'invalid_token',
            error_description: verified.description || 'Invalid Bearer token',
        };
    }

    if (!provided) {
        return {
            ok: false,
            status: 401,
            error: 'invalid_token',
            error_description: 'Missing Bearer token',
        };
    }
    return {
        ok: false,
        status: 401,
        error: 'invalid_token',
        error_description: 'Invalid Bearer token',
    };
}

function mcpCors() {
    return {
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-MCP-API-Key, MCP-Protocol-Version',
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Max-Age': '600',
        'Access-Control-Expose-Headers': 'WWW-Authenticate',
    };
}

function sendJson(res, status, body, extraHeaders = {}) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        ...mcpCors(),
        ...extraHeaders,
    });
    res.end(JSON.stringify(body));
}

function readLimitedBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(Object.assign(new Error('Payload too large'), { status: 413 }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function clientId(req) {
    return String(req.socket?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown');
}

export function isMcpPath(pathname) {
    return pathname === MCP_PATH || pathname === `${MCP_PATH}/`;
}

export async function handleRemoteMcp(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            ...mcpCors(),
            'WWW-Authenticate': oauthWwwAuthenticate(resourceUrl(), {
                description: 'Authentication required',
            }),
            'Access-Control-Expose-Headers': 'WWW-Authenticate',
        });
        res.end();
        return;
    }

    const auth = await authenticateRemoteMcp(req);
    if (!auth.ok) {
        const description = auth.error_description || auth.error || 'Authentication required';
        sendJson(
            res,
            auth.status,
            {
                error: auth.error,
                error_description: description,
            },
            challengeHeaders({
                error: auth.status === 403 ? 'insufficient_scope' : 'invalid_token',
                description,
            })
        );
        return;
    }

    if (!allowRequest(`mcp:${clientId(req)}`)) {
        sendJson(res, 429, { error: 'Rate limit exceeded' });
        return;
    }

    if (!['POST', 'GET', 'DELETE'].includes(req.method)) {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    let parsedBody;
    if (req.method === 'POST') {
        const raw = await readLimitedBody(req);
        if (raw) {
            try {
                parsedBody = JSON.parse(raw);
            } catch {
                sendJson(res, 400, { error: 'Invalid JSON' });
                return;
            }
        }
    }

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });
    const mcp = createMcpServer({
        actor: { email: auth.actorEmail || 'remote-mcp', createdBy: auth.actorEmail || 'remote-mcp' },
        readOnly: auth.readOnly,
    });
    res.on('close', () => {
        void transport.close();
        void mcp.close();
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
}
