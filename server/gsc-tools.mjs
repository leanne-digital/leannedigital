import { z } from 'zod';
import { gsc } from './services/gsc.mjs';
const siteUrl = z.string().describe('Exact property from gsc_list_sites, including sc-domain: or URL prefix.');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dimension = z.enum(['query', 'page', 'country', 'device', 'date', 'searchAppearance']);
const querySchema = {
    siteUrl, startDate: date.optional(), endDate: date.optional(),
    dimensions: z.array(dimension).max(3).optional(),
    searchType: z.enum(['web', 'image', 'video', 'news', 'discover', 'googleNews']).optional(),
    dataState: z.enum(['final', 'all']).optional(),
    rowLimit: z.number().int().min(1).max(25000).optional(),
    filters: z.array(z.object({ dimension, operator: z.enum(['equals', 'notEquals', 'contains', 'notContains', 'includingRegex', 'excludingRegex']), expression: z.string().max(4096) })).max(20).optional(),
};
export function registerGscTools(server) {
    const add = (name, description, schema, handler) => server.tool(name, description, schema,
        { readOnlyHint: true, destructiveHint: false, openWorldHint: true }, async args => {
            try { return { content: [{ type: 'text', text: JSON.stringify(await handler(args)) }] }; }
            catch (err) { return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: err.status ? err.message : 'Search Console request failed. Check the connection and retry.' }) }] }; }
        });
    add('gsc_connection_status', 'Check whether the agency GSC credentials are configured; does not verify Google authorization or expose secrets.', {}, gsc.status);
    add('gsc_list_sites', 'List Search Console properties available to the connected agency Google account. Call first and copy siteUrl exactly.', {}, gsc.listSites);
    add('gsc_search_analytics', 'Read clicks, impressions, CTR and average position. Defaults to 28 days ending 3 days ago, final data. Use no dimensions for totals. Page using startRow; possiblyTruncated signals a full page. Query rows omit anonymized searches.', { ...querySchema, startRow: z.number().int().min(0).optional() }, gsc.query);
    add('gsc_compare_periods', 'Compare GSC performance with the preceding equal-length period, or explicit previous dates. Defaults to final data. Missing rows have null deltas, not assumed zeros. Check possiblyTruncated.', { ...querySchema, previousStartDate: date.optional(), previousEndDate: date.optional() }, gsc.compare);
    add('gsc_inspect_url', 'Inspect Google indexing status, canonical and crawl information. This reads the indexed version; it does not request indexing or perform a live test.', { siteUrl, inspectionUrl: z.string().url() }, gsc.inspectUrl);
    add('gsc_list_sitemaps', 'Read submitted sitemaps and their status. Does not submit or delete sitemaps.', { siteUrl }, gsc.listSitemaps);
}
