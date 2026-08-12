import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeServiceHtml } from './service-html-normalize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADMIN = path.join(ROOT, '_import', 'simply-static-new', 'admin');
const WP_ROOT = path.join(ROOT, '_import', 'simply-static-new');
const DATA_FILE = path.join(ROOT, 'data', 'clients.json');
const REPORTS_DIR = path.join(ROOT, 'data', 'client-reports');
const ASSETS_ROOT = path.join(ROOT, 'assets', 'clients');

const MONTH_NAMES = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
};

const MOCKUP_PATTERN = /WebDesign|Portfolio-Image|HighRes|SEO-Services/i;
const ASSET_PATTERN = /(?:https:\/\/leannedigital\.com)?(\/wp-content\/uploads\/[^"'?\s#]+)/gi;

function decode(text) {
    return text
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
}

function strip(html) {
    return decode(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function extractEntry(html) {
    const match = html.match(
        /<div class="entry-content clear"[^>]*>([\s\S]*?)<\/div><!-- \.entry-content \.clear -->/i
    );
    return match ? match[1] : '';
}

function extractBio(html) {
    const entry = extractEntry(html);
    const paragraphs = [...entry.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((match) => strip(match[1]))
        .filter((text) => text.length > 40 && !/^reports$/i.test(text));
    return paragraphs[0] || '';
}

function extractName(html) {
    const title = strip(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '')
        .replace(/\s*[-|]\s*Leanne Digital.*$/i, '')
        .trim();
    if (title) return title;
    const heading = extractEntry(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
        || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
        || '';
    return strip(heading);
}

function parseMonth(slug) {
    const match = slug.match(
        /(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{4})$/i
    );
    if (!match) return null;
    const monthName = match[1].toLowerCase();
    const year = match[2];
    const label = `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()} ${year}`;
    return {
        monthKey: `${year}-${MONTH_NAMES[monthName]}`,
        label,
    };
}

function collectAssetUrls(html) {
    const urls = new Set();
    for (const match of html.matchAll(ASSET_PATTERN)) {
        urls.add(match[1].split('?')[0]);
    }
    return [...urls];
}

function copyAssets(slug, urls) {
    const destDir = path.join(ASSETS_ROOT, slug);
    fs.mkdirSync(destDir, { recursive: true });
    const map = new Map();
    const used = new Set();

    for (const url of urls) {
        if (MOCKUP_PATTERN.test(url)) continue;
        const src = path.join(WP_ROOT, url.replace(/^\//, '').replaceAll('/', path.sep));
        if (!fs.existsSync(src)) {
            console.warn(`  ! Missing ${url}`);
            continue;
        }
        let filename = path.basename(url);
        if (used.has(filename.toLowerCase())) {
            const stamp = url.match(/\/uploads\/(\d{4})\/(\d{2})\//);
            filename = stamp ? `${stamp[1]}-${stamp[2]}-${filename}` : filename;
        }
        used.add(filename.toLowerCase());
        fs.copyFileSync(src, path.join(destDir, filename));
        map.set(url, `/assets/clients/${slug}/${filename}`);
    }

    return map;
}

function rewriteAssets(html, map) {
    return html.replace(ASSET_PATTERN, (full, url) => {
        const clean = url.split('?')[0];
        return map.get(clean) || full;
    });
}

function cleanReportHtml(html, map) {
    let output = html;
    output = output.replace(/<style[\s\S]*?<\/style>/gi, '');
    output = output.replace(
        /<div class="elementor-element[^"]*elementor-widget-table-of-contents[\s\S]*?<\/div>\s*<\/div>/gi,
        ''
    );
    output = output.replace(
        /<img[^>]+src="[^"]*(?:WebDesign|Portfolio-Image|HighRes|SEO-Services)[^"]*"[^>]*>/gi,
        ''
    );
    output = output.replace(/class="shift-blog-table"/gi, 'class="client-report-table"');
    output = output.replace(/class="shift-badge"/gi, 'class="client-report-badge"');
    output = rewriteAssets(output, map);
    output = normalizeServiceHtml(output);
    output = output.replace(/<table(?![^>]*class=)/gi, '<table class="client-report-table"');
    output = output.replace(/<div class="ld-widget-image"><\/div>/g, '');
    output = output.replace(/<div id="elementor-toc__[^"]*"><\/div>/g, '');
    output = output.replace(/<div class="ld-col"><\/div>/g, '');
    return output.trim();
}

function importClient(slug) {
    const profileFile = path.join(ADMIN, slug, 'index.html');
    if (!fs.existsSync(profileFile)) return null;

    const profileHtml = fs.readFileSync(profileFile, 'utf8');
    const name = extractName(profileHtml);
    const bio = extractBio(profileHtml);
    const reportDirs = fs
        .readdirSync(path.join(ADMIN, slug), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('seo-report-'))
        .map((entry) => entry.name);

    const reports = [];
    for (const reportSlug of reportDirs) {
        const month = parseMonth(reportSlug);
        if (!month) continue;
        const reportFile = path.join(ADMIN, slug, reportSlug, 'index.html');
        if (!fs.existsSync(reportFile)) continue;
        const reportHtml = fs.readFileSync(reportFile, 'utf8');
        const entry = extractEntry(reportHtml);
        const assetMap = copyAssets(slug, collectAssetUrls(entry));
        const body = cleanReportHtml(entry, assetMap);
        const outDir = path.join(REPORTS_DIR, slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, `${reportSlug}.html`), body, 'utf8');
        reports.push({
            slug: reportSlug,
            title: month.label,
            monthKey: month.monthKey,
        });
    }

    reports.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    return { slug, name, bio, reports };
}

function main() {
    if (!fs.existsSync(ADMIN)) {
        throw new Error(`Static export not found at ${ADMIN}`);
    }

    const slugs = fs
        .readdirSync(ADMIN, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((slug) => {
            const dir = path.join(ADMIN, slug);
            return fs.readdirSync(dir, { withFileTypes: true }).some(
                (entry) => entry.isDirectory() && entry.name.startsWith('seo-report-')
            );
        });

    const imported = slugs.map(importClient).filter(Boolean);
    const existing = fs.existsSync(DATA_FILE)
        ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
        : [];
    const bySlug = new Map(existing.map((client) => [client.slug, client]));
    for (const client of imported) {
        const prev = bySlug.get(client.slug) || {};
        bySlug.set(client.slug, {
            ...prev,
            ...client,
            services: prev.services || client.services,
            includes: prev.includes || client.includes,
            started: prev.started || client.started,
            currency: prev.currency || client.currency || 'CAD',
        });
    }
    const clients = [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, `${JSON.stringify(clients, null, 2)}\n`, 'utf8');
    for (const client of clients) {
        console.log(`${client.name}: ${client.reports.length} monthly reports`);
    }
}

main();
