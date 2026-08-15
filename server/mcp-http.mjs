import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './mcp-tools.mjs';

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
    if (!a.length || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

function configuredKey() {
    return String(process.env.REMOTE_MCP_API_KEY || '').trim();
}

function bearerToken(req) {
    const header = String(req.headers.authorization || '');
    if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
    return String(req.headers['x-mcp-api-key'] || '').trim();
}

/**
 * Dedicated remote-MCP credential. Intentionally not PORTAL_API_KEY:
 * that key also unlocks the full staff HTTP API. OAuth can replace this
 * function later without changing createMcpServer().
 */
export function authenticateRemoteMcp(req) {
    const expected = configuredKey();
    if (!expected) {
        return { ok: false, status: 503, error: 'Remote MCP is not configured (set REMOTE_MCP_API_KEY)' };
    }
    const provided = bearerToken(req);
    if (!provided) {
        return { ok: false, status: 401, error: 'Missing Bearer token' };
    }
    if (!safeEqual(provided, expected)) {
        return { ok: false, status: 401, error: 'Invalid Bearer token' };
    }
    return {
        ok: true,
        readOnly: String(process.env.REMOTE_MCP_READ_ONLY || '') === '1',
    };
}

function mcpCors() {
    return {
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-MCP-API-Key, MCP-Protocol-Version',
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Max-Age': '600',
    };
}

function sendJson(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        ...mcpCors(),
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
        res.writeHead(204, mcpCors());
        res.end();
        return;
    }

    const auth = authenticateRemoteMcp(req);
    if (!auth.ok) {
        sendJson(res, auth.status, { error: auth.error });
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
        actor: { email: 'remote-mcp', createdBy: 'remote-mcp' },
        readOnly: auth.readOnly,
    });
    res.on('close', () => {
        void transport.close();
        void mcp.close();
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
}
