import { loadEnv } from '../../scripts/load-env.mjs';
import { LILIPADD } from '../../scripts/site-config.mjs';

loadEnv();

function apiBase() {
    const explicit = String(process.env.LILIPADD_API_URL || '').replace(/\/$/, '');
    if (explicit) return explicit;
    const platform = process.env.LILIPADD_PLATFORM_URL || LILIPADD.platformUrl || '';
    if (platform.includes('app.lilipadd.com')) return 'https://api.lilipadd.com';
    if (platform.includes('localhost') || platform.includes('127.0.0.1')) {
        return platform.replace(/\/v1\/platform\.js$/, '').replace(/\/$/, '') || 'http://localhost:4000';
    }
    return 'https://api.lilipadd.com';
}

function unavailable(reason) {
    return {
        available: false,
        source: 'lilipadd',
        reason,
        traffic: null,
        conversions: null,
        pages: [],
    };
}

function credentials() {
    const apiKey = String(process.env.LILIPADD_API_KEY || '').trim();
    const siteKey = String(process.env.LILIPADD_SITE_KEY || '').trim();
    if (!apiKey) {
        return unavailable(
            'Set LILIPADD_API_KEY to a private Lilipadd tenant server key with stats:read. Do not put it in the query string or in platform.js.',
        );
    }
    if (!siteKey) {
        return unavailable(
            'Set LILIPADD_SITE_KEY to the public lp_ site key. LILIPADD_API_KEY is only used as Authorization: Bearer.',
        );
    }
    if (siteKey === apiKey) {
        return unavailable(
            'LILIPADD_SITE_KEY must be the public site key, not the private LILIPADD_API_KEY.',
        );
    }
    return { apiKey, siteKey };
}

async function fetchLilipadd(pathname, query = {}) {
    const creds = credentials();
    if (creds.available === false) return creds;

    const url = new URL(pathname, `${apiBase()}/`);
    url.searchParams.set('key', creds.siteKey);
    for (const [name, value] of Object.entries(query)) {
        if (value) url.searchParams.set(name, value);
    }

    const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
    };

    let res;
    try {
        res = await fetch(url, { headers });
    } catch (error) {
        return unavailable(`Could not reach Lilipadd analytics (${error.message}).`);
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        return unavailable(`Lilipadd analytics returned ${res.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
    }
    const data = await res.json().catch(() => ({}));
    return {
        available: true,
        source: 'lilipadd',
        ...data,
    };
}

export async function getSiteStatistics({ month } = {}) {
    return fetchLilipadd('/api/public/v1/analytics', { month, view: 'statistics' });
}

export async function getSiteConversions({ month } = {}) {
    return fetchLilipadd('/api/public/v1/analytics', { month, view: 'conversions' });
}
