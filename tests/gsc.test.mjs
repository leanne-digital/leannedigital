import test from 'node:test';
import assert from 'node:assert/strict';
import { createGscService } from '../server/services/gsc.mjs';
const env = { GSC_CLIENT_ID: 'client', GSC_CLIENT_SECRET: 'secret', GSC_REFRESH_TOKEN: 'refresh' };
const now = () => new Date('2026-10-19T01:00:00Z');
const ok = data => ({ ok: true, status: 200, json: async () => data });
function fixture(handler) {
    const calls = [];
    const service = createGscService({ env, now, fetchImpl: async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith('/token')) return ok({ access_token: 'access', expires_in: 3600 });
        return handler(url, options, calls);
    } });
    return { service, calls };
}
test('configuration reports no secrets and missing connection fails before network', async () => {
    const service = createGscService({ env: {}, fetchImpl: () => assert.fail('unexpected network') });
    assert.equal(service.status().configured, false);
    await assert.rejects(service.listSites(), /not connected/);
    assert.equal(JSON.stringify(createGscService({ env }).status()).includes('refresh'), false);
});
test('concurrent requests share refresh; properties retain exact prefix', async () => {
    const { service, calls } = fixture(() => ok({ siteEntry: [{ siteUrl: 'sc-domain:example.com' }] }));
    const results = await Promise.all([service.listSites(), service.listSites()]);
    assert.equal(calls.filter(c => c.url.endsWith('/token')).length, 1);
    assert.equal(results[0].sites[0].siteUrl, 'sc-domain:example.com');
});
test('query sends encoded property, Pacific defaults, filters and pagination', async () => {
    const { service, calls } = fixture(() => ok({ rows: [{ keys: ['a'], clicks: 1, impressions: 2, ctr: .5, position: 3 }] }));
    const filters = [{ dimension: 'page', operator: 'contains', expression: '/services/' }];
    const result = await service.query({ siteUrl: 'https://example.com/', dimensions: ['query'], rowLimit: 1, startRow: 7, filters });
    const call = calls.at(-1), body = JSON.parse(call.options.body);
    assert.match(call.url, /https%3A%2F%2Fexample.com%2F/);
    assert.equal(body.endDate, '2026-10-15');
    assert.equal(body.startDate, '2026-09-18');
    assert.equal(body.dataState, 'final');
    assert.equal(body.startRow, 7);
    assert.deepEqual(body.dimensionFilterGroups[0].filters, filters);
    assert.equal(result.possiblyTruncated, true);
    assert.equal(result.rows[0].ctr, .5);
});
test('invalid dates, limits and unrelated URLs never call Google', async () => {
    const { service, calls } = fixture(() => assert.fail('unexpected call'));
    await assert.rejects(service.query({ siteUrl: 'sc-domain:example.com', startDate: '2026-02-30' }), /Dates/);
    await assert.rejects(service.query({ siteUrl: 'sc-domain:example.com', rowLimit: 25001 }), /pagination/);
    await assert.rejects(service.inspectUrl({ siteUrl: 'sc-domain:example.com', inspectionUrl: 'https://example.com.evil.test/' }), /belong/);
    await assert.rejects(service.inspectUrl({ siteUrl: 'https://example.com', inspectionUrl: 'https://example.com.evil.test/' }), /belong/);
    assert.equal(calls.length, 0);
});
test('comparison crosses month boundaries and leaves absent rows null', async () => {
    const { service } = fixture((url, opts) => {
        const old = JSON.parse(opts.body).endDate === '2026-02-28';
        return ok({ rows: [{ keys: ['same'], clicks: old ? 2 : 5, impressions: 10, ctr: old ? .2 : .5, position: 4 }, { keys: [old ? 'old' : 'new'], clicks: 1 }] });
    });
    const result = await service.compare({ siteUrl: 'sc-domain:example.com', startDate: '2026-03-01', endDate: '2026-03-07' });
    assert.equal(result.previousPeriod.startDate, '2026-02-22');
    assert.equal(result.previousPeriod.endDate, '2026-02-28');
    assert.equal(result.rows.find(r => r.keys[0] === 'same').delta.clicks, 3);
    assert.equal(result.rows.find(r => r.keys[0] === 'new').delta, null);
});
test('401 refreshes once; upstream error bodies cannot expose tokens', async () => {
    let count = 0;
    const { service, calls } = fixture(() => ++count === 1 ? { ok: false, status: 401 } : ok({ siteEntry: [] }));
    await service.listSites();
    assert.equal(calls.filter(c => c.url.endsWith('/token')).length, 2);
    const denied = fixture(() => ({ ok: false, status: 403, json: async () => ({ error: 'SECRET_TOKEN' }) }));
    await assert.rejects(denied.service.listSites(), err => err.status === 403 && !err.message.includes('SECRET_TOKEN'));
});
test('inspection and sitemap calls use fixed Google endpoints', async () => {
    const { service, calls } = fixture(() => ok({ sitemap: [] }));
    await service.inspectUrl({ siteUrl: 'sc-domain:example.com', inspectionUrl: 'https://www.example.com/page' });
    assert.equal(calls.at(-1).url, 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect');
    await service.listSitemaps({ siteUrl: 'sc-domain:example.com' });
    assert.equal(calls.at(-1).url, 'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/sitemaps');
});
test('read-only MCP exposes all six GSC tools without credentials', async () => {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { createMcpServer } = await import('../server/mcp-tools.mjs');
    const server = createMcpServer({ readOnly: true });
    const client = new Client({ name: 'gsc-test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    try {
        await server.connect(a); await client.connect(b);
        const result = await client.listTools();
        const tools = result.tools.filter(t => t.name.startsWith('gsc_'));
        assert.equal(tools.length, 6);
        assert.ok(tools.every(t => t.annotations.readOnlyHint && t.annotations.openWorldHint));
        const status = await client.callTool({ name: 'gsc_connection_status', arguments: {} });
        assert.equal(JSON.parse(status.content[0].text).configured, false);
        const invalid = await client.callTool({ name: 'gsc_search_analytics', arguments: { siteUrl: 'sc-domain:example.com', rowLimit: 50000 } });
        assert.equal(invalid.isError, true);
    } finally { await client.close(); await server.close(); }
});
