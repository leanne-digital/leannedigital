import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.REMOTE_MCP_API_KEY ||= 'ld-test-remote-mcp-key-32chars-xxxx';
process.env.PORTAL_API_KEY ||= 'ld-test-portal-api-key';
process.env.PORTAL_BIND ||= '127.0.0.1';
process.env.REMOTE_MCP_READ_ONLY = '';
process.env.OAUTH_SECRET ||= 'ld-test-oauth-secret-32-chars-minimum';
process.env.OAUTH_ADMIN_EMAIL ||= 'gary@leannedigital.com';
process.env.OAUTH_ADMIN_PASSWORD ||= 'oauth-admin-test-password';
process.env.OAUTH_DATA_DIR ||= fs.mkdtempSync(path.join(os.tmpdir(), 'ld-oauth-static-'));

const { startPortal } = await import('../server/api.mjs');
const { MCP_READ_TOOLS, MCP_WRITE_TOOLS, sanitizeForMcp } = await import('../server/mcp-tools.mjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = process.env.REMOTE_MCP_API_KEY;
const PORTAL_KEY = process.env.PORTAL_API_KEY;

let failures = 0;
function check(label, ok, detail = '') {
    const mark = ok ? 'PASS' : 'FAIL';
    if (!ok) failures += 1;
    console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ''}`);
}

const { server, port } = await startPortal({ port: 0, bind: '127.0.0.1' });
const BASE = `http://127.0.0.1:${port}`;

function rpcPayload(id, method, params) {
    return { jsonrpc: '2.0', id, method, params };
}

async function mcpPost(token, body, extraHeaders = {}) {
    const headers = {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        ...extraHeaders,
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
            try {
                json = JSON.parse(match[1]);
            } catch {
                json = null;
            }
        }
    }
    return { status: res.status, json, raw, headers: res.headers };
}

async function callTool(name, args = {}, token = TOKEN) {
    return mcpPost(token, rpcPayload(20, 'tools/call', { name, arguments: args }));
}

function toolText(result) {
    const text = result.json?.result?.content?.[0]?.text
        || result.json?.content?.[0]?.text
        || '';
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

const noAuth = await mcpPost('', rpcPayload(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.0.1' },
}));
const wwwAuth = noAuth.headers.get('www-authenticate') || '';
check('invalid/missing authentication', noAuth.status === 401, `status=${noAuth.status}`);
check('missing auth WWW-Authenticate includes resource_metadata',
    /resource_metadata=/.test(wwwAuth),
    wwwAuth.slice(0, 180));

const badAuth = await mcpPost('wrong-key', rpcPayload(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.0.1' },
}));
check('invalid token rejected', badAuth.status === 401, `status=${badAuth.status}`);

const init = await mcpPost(TOKEN, rpcPayload(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.0.1' },
}));
check('valid authentication', init.status === 200 && Boolean(init.json?.result?.serverInfo || init.json?.result?.protocolVersion),
    JSON.stringify(init.json?.result?.serverInfo || init.json?.error || { status: init.status }));

const listed = await mcpPost(TOKEN, rpcPayload(2, 'tools/list', {}));
const tools = listed.json?.result?.tools || [];
const names = tools.map((tool) => tool.name);
check('remote tools include read + write',
    MCP_READ_TOOLS.every((name) => names.includes(name)) && MCP_WRITE_TOOLS.every((name) => names.includes(name)),
    `count=${names.length}`);
check('read/write annotations present',
    tools.some((tool) => tool.annotations?.readOnlyHint === true)
        && tools.some((tool) => tool.annotations?.readOnlyHint === false),
    `read=${tools.filter((t) => t.annotations?.readOnlyHint).length}`);

const clients = await callTool('list_clients', {});
const clientPayload = toolText(clients);
const clientList = clientPayload.clients || [];
check('read tool list_clients',
    clients.status === 200 && Array.isArray(clientList) && clientList.length > 0,
    `clients=${clientList.length}`);
check('MCP output does not include credentials/passwords',
    !JSON.stringify(clientPayload).toLowerCase().includes('temporarypassword')
        && !(clientList[0] && Object.prototype.hasOwnProperty.call(clientList[0], 'credentials')),
    clientList[0] ? Object.keys(clientList[0]).slice(0, 8).join(',') : 'none');

const projects = await callTool('list_projects', { status: 'active' });
const projectList = toolText(projects).projects || [];
check('read tool list_projects via shared services',
    projects.status === 200 && Array.isArray(projectList),
    `projects=${projectList.length}`);

const revenue = await callTool('get_monthly_revenue', {});
check('read tool get_monthly_revenue via shared services',
    revenue.status === 200 && typeof toolText(revenue).monthlyRecurring === 'number',
    JSON.stringify({ month: toolText(revenue).month, monthlyRecurring: toolText(revenue).monthlyRecurring }));

const stats = await callTool('get_site_statistics', { month: '2026-08' });
const statsBody = toolText(stats);
check('analytics tool through Lilipadd adapter',
    stats.status === 200 && (statsBody.available === true || statsBody.available === false) && statsBody.source === 'lilipadd',
    JSON.stringify({ available: statsBody.available, reason: statsBody.reason || null, site: statsBody.site || null }));

const conversions = await callTool('get_site_conversions', { month: '2026-08' });
check('conversions tool through Lilipadd adapter',
    conversions.status === 200 && toolText(conversions).source === 'lilipadd',
    JSON.stringify({ available: toolText(conversions).available }));

const sample = projectList[0];
let writeOk = false;
if (sample?.id) {
    const updated = await callTool('add_project_update', {
        id: String(sample.id),
        message: `remote mcp smoke ${new Date().toISOString()}`,
    });
    writeOk = updated.status === 200 && Boolean(toolText(updated).update?.id || toolText(updated).update?.message);
    check('write tool add_project_update', writeOk, JSON.stringify(toolText(updated).update || toolText(updated)));
} else {
    const created = await callTool('create_project', {
        clientId: String(clientList[0]?.slug || clientList[0]?.id || ''),
        serviceType: 'custom',
        name: `MCP smoke ${Date.now()}`,
        monthlyFee: 0,
    });
    writeOk = created.status === 200 && Boolean(toolText(created).project?.id);
    check('write tool create_project', writeOk, JSON.stringify(toolText(created).project || toolText(created)));
}

const invalidArgs = await callTool('get_client', {});
const invalidBody = invalidArgs.json || {};
check('invalid tool arguments',
    invalidArgs.status >= 400
        || Boolean(invalidBody.error)
        || Boolean(invalidBody.result?.isError)
        || String(invalidBody.result?.content?.[0]?.text || '').includes('error')
        || invalidBody.result === undefined && invalidArgs.status !== 200,
    JSON.stringify(invalidBody.error || invalidBody.result || { status: invalidArgs.status }).slice(0, 180));

const unknown = await callTool('not_a_real_tool', {});
check('unknown tool',
    unknown.status >= 400
        || Boolean(unknown.json?.error)
        || Boolean(unknown.json?.result?.isError)
        || String(unknown.json?.result?.content?.[0]?.text || '').toLowerCase().includes('unknown'),
    JSON.stringify(unknown.json?.error || unknown.json?.result || { status: unknown.status }).slice(0, 180));

const health = await fetch(`${BASE}/health`);
const healthJson = await health.json();
check('HTTP /health still works', health.status === 200 && healthJson.ok === true);

const apiClients = await fetch(`${BASE}/api/clients`, {
    headers: { Authorization: `Bearer ${PORTAL_KEY}` },
});
const apiJson = await apiClients.json();
check('HTTP /api/clients still works',
    apiClients.status === 200 && Array.isArray(apiJson.clients),
    `status=${apiClients.status} clients=${apiJson.clients?.length}`);

const portalKeyOnMcp = await mcpPost(PORTAL_KEY, rpcPayload(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.0.1' },
}));
check('PORTAL_API_KEY is not accepted for remote MCP',
    portalKeyOnMcp.status === 401,
    `status=${portalKeyOnMcp.status}`);

const redacted = sanitizeForMcp({ password: 'secret', credentials: [{ password: 'x' }], name: 'Ok' });
check('sanitizer strips secrets', redacted.password === undefined && redacted.credentials === undefined && redacted.name === 'Ok');

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
check('local stdio MCP still initializes',
    stdioOut.includes('leanne-digital') || stdioOut.includes('protocolVersion') || stdioOut.includes('serverInfo'),
    stdioOut.slice(0, 180).replace(/\s+/g, ' '));

server.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
