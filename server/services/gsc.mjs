// Shared agency Search Console connection. Remote access uses the existing staff MCP gate.
const API = 'https://www.googleapis.com/webmasters/v3';
export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export function createGscService({ env = process.env, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
    let cached, refreshing;
    const configured = () => Boolean(env.GSC_CLIENT_ID && env.GSC_CLIENT_SECRET && env.GSC_REFRESH_TOKEN);
    async function token() {
        if (!configured()) throw fail('GSC is not connected. Complete GSC-MCP-SETUP.md on the server.', 503);
        if (cached && cached.expires > now().getTime()) return cached.value;
        if (!refreshing) refreshing = (async () => {
            const response = await fetchImpl('https://oauth2.googleapis.com/token', {
                method: 'POST', signal: AbortSignal.timeout(20000),
                body: new URLSearchParams({ client_id: env.GSC_CLIENT_ID, client_secret: env.GSC_CLIENT_SECRET,
                    refresh_token: env.GSC_REFRESH_TOKEN, grant_type: 'refresh_token' }),
            });
            const data = await response.json();
            if (!response.ok || !data.access_token) throw fail('Google authorization failed. Reconnect GSC or check the private OAuth configuration.', 401);
            cached = { value: data.access_token, expires: now().getTime() + Math.max(0, (Number(data.expires_in) || 3600) - 60) * 1000 };
            return cached.value;
        })().finally(() => { refreshing = null; });
        return refreshing;
    }
    async function request(url, body, retry = true) {
        const response = await fetchImpl(url, {
            method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(30000),
            headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (response.status === 401 && retry) { cached = null; return request(url, body, false); }
        if (!response.ok) throw fail(response.status === 403 ? 'Google denied access. Check property permissions and that Search Console API is enabled.' : response.status === 429 ? 'Google Search Console quota exceeded. Try again later.' : `Search Console request failed (HTTP ${response.status}).`, response.status);
        return response.json();
    }
    function sitePath(siteUrl) {
        if (typeof siteUrl !== 'string' || !/^(sc-domain:[^/\s]+|https?:\/\/\S+)$/.test(siteUrl)) throw fail('Use the exact siteUrl returned by gsc_list_sites.');
        return `${API}/sites/${encodeURIComponent(siteUrl)}`;
    }
    function date(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw fail('Dates must be valid YYYY-MM-DD values.');
        return value;
    }
    function shift(value, days) { return new Date(Date.parse(value) + days * 86400000).toISOString().slice(0, 10); }
    function range(input) {
        // Search Console dates use Pacific time, including the default final-data window.
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now());
        const endDate = date(input.endDate || shift(today, -3));
        const startDate = date(input.startDate || shift(endDate, -27));
        if (startDate > endDate) throw fail('startDate must be on or before endDate.');
        return { startDate, endDate };
    }
    async function query(input) {
        const url = sitePath(input.siteUrl);
        const rowLimit = input.rowLimit ?? 1000, startRow = input.startRow ?? 0;
        if (!Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > 25000 || !Number.isInteger(startRow) || startRow < 0) throw fail('Invalid pagination; rowLimit must be 1–25000 and startRow nonnegative.');
        const query = { ...range(input), dimensions: input.dimensions || [], type: input.searchType || 'web', dataState: input.dataState || 'final', rowLimit, startRow };
        if (input.filters?.length) query.dimensionFilterGroups = [{ groupType: 'and', filters: input.filters }];
        const data = await request(`${url}/searchAnalytics/query`, query);
        const rows = data.rows || [];
        return { siteUrl: input.siteUrl, query, rows, rowCount: rows.length, possiblyTruncated: rows.length === rowLimit,
            metadata: data.metadata, responseAggregationType: data.responseAggregationType,
            note: 'CTR is a fraction (0–1). Position is an impression-weighted average. Google returns top rows, not every query; anonymized queries are omitted. Do not sum query rows for site totals. Final data usually lags 2–3 days. dataState=all includes provisional data.' };
    }
    return {
        status: () => ({ configured: configured(), scope: GSC_SCOPE, connection: 'Shared agency Google account; accessible to authorized Admin MCP staff.', setup: 'GSC-MCP-SETUP.md' }),
        listSites: async () => ({ sites: (await request(`${API}/sites`)).siteEntry || [] }),
        query,
        listSitemaps: async ({ siteUrl }) => ({ siteUrl, sitemaps: (await request(`${sitePath(siteUrl)}/sitemaps`)).sitemap || [] }),
        inspectUrl: async ({ siteUrl, inspectionUrl }) => {
            sitePath(siteUrl);
            let url; try { url = new URL(inspectionUrl); } catch { throw fail('Invalid inspectionUrl.'); }
            if (!['http:', 'https:'].includes(url.protocol)) throw fail('inspectionUrl must be HTTP or HTTPS.');
            const belongs = siteUrl.startsWith('sc-domain:')
                ? url.hostname === siteUrl.slice(10) || url.hostname.endsWith(`.${siteUrl.slice(10)}`)
                : url.origin === new URL(siteUrl).origin && url.pathname.startsWith(new URL(siteUrl).pathname);
            if (!belongs) throw fail('inspectionUrl must belong to the selected property.');
            return request('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { siteUrl, inspectionUrl });
        },
        compare: async (input) => {
            const current = range(input);
            const days = (Date.parse(current.endDate) - Date.parse(current.startDate)) / 86400000 + 1;
            const previousEndDate = input.previousEndDate || shift(current.startDate, -1);
            const previousStartDate = input.previousStartDate || shift(previousEndDate, 1 - days);
            const [a, b] = await Promise.all([
                query({ ...input, ...current, startRow: 0 }),
                query({ ...input, startDate: previousStartDate, endDate: previousEndDate, startRow: 0 }),
            ]);
            const key = row => JSON.stringify(row.keys || []);
            const rows = new Map(b.rows.map(row => [key(row), { keys: row.keys || [], previous: row, current: null }]));
            for (const row of a.rows) rows.set(key(row), { ...(rows.get(key(row)) || { keys: row.keys || [], previous: null }), current: row });
            return { currentPeriod: a.query, previousPeriod: b.query, possiblyTruncated: a.possiblyTruncated || b.possiblyTruncated,
                rows: [...rows.values()].map(row => ({ ...row, delta: row.current && row.previous ? Object.fromEntries(['clicks', 'impressions', 'ctr', 'position'].map(k => [k, row.current[k] - row.previous[k]])) : null })),
                note: `${a.note} Missing rows are not assumed to be zero; a capped response can hide rows. CTR deltas are fractions; position deltas are changes in average position.` };
        },
    };
}
export const gsc = createGscService();
