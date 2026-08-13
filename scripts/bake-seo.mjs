import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from './site-config.mjs';
import { isNoindexPath, renderSeoBlock } from './seo.mjs';
import { urlPathFor, walkHtml } from './lilipadd-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY = path.join(ROOT, 'data', 'lilipadd-seo-inventory.json');

function loadInventory() {
    if (!fs.existsSync(INVENTORY)) return new Map();
    const rows = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
    return new Map(rows.map((row) => [row.path, row]));
}

function textFromHtml(html) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function fallbackTitle(pagePath, html) {
    const h1 = textFromHtml((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
    if (h1) return /leanne digital/i.test(h1) ? h1 : `${h1} | Leanne Digital`;
    const slug = pagePath.replace(/^\/|\/$/g, '').split('/').filter(Boolean).pop() || 'Home';
    const label = slug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    return `${label} | Leanne Digital`;
}

function fallbackDescription(html) {
    const lead =
        (html.match(/<p class="[^"]*(?:lead|hero__lead|coming-soon__lead)[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
            [])[1] ||
        (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] ||
        (html.match(/<p>([\s\S]*?)<\/p>/i) || [])[1] ||
        '';
    const text = textFromHtml(lead);
    if (text.length >= 40) return text.slice(0, 160);
    return 'Leanne Digital is an Indigenous-owned digital marketing agency in Winnipeg offering website design, SEO, branding, and ongoing support.';
}

export function bakeSeoIntoHtml(html, pagePath, inventory) {
    const row = inventory.get(pagePath) || {};
    const title = String(row.title || '').trim() || fallbackTitle(pagePath, html);
    const description = String(row.description || '').trim() || fallbackDescription(html);
    const canonical = row.canonical || `${SITE_URL}${pagePath === '/' ? '/' : pagePath}`;
    const robots =
        row.robots ||
        (isNoindexPath(pagePath) || pagePath === '/thank-you/' ? 'noindex,nofollow' : 'index,follow');
    const block = renderSeoBlock({
        title,
        description,
        canonical,
        robots,
        schema: row.schema || null,
    });

    if (html.includes('<!-- lp:seo -->')) {
        if (/<!-- lp:seo -->[\s\S]*?<!-- lp:custom-head -->/.test(html)) {
            return html.replace(
                /<!-- lp:seo -->[\s\S]*?<!-- lp:custom-head -->/,
                `<!-- lp:seo -->\n${block}\n    <!-- lp:custom-head -->`,
            );
        }
        return html.replace('<!-- lp:seo -->', `<!-- lp:seo -->\n${block}`);
    }

    if (/<title>[^<]+<\/title>/i.test(html)) return html;
    return html.replace(
        /(<meta\s+name="viewport"[^>]*>)/i,
        `$1\n    <!-- lp:seo -->\n${block}\n    <!-- lp:custom-head -->`,
    );
}

export function bakeSeoIntoTree() {
    const inventory = loadInventory();
    const files = walkHtml();
    let changed = 0;
    for (const file of files) {
        const pagePath = urlPathFor(file);
        const before = fs.readFileSync(file, 'utf8');
        const after = bakeSeoIntoHtml(before, pagePath, inventory);
        if (after !== before) {
            fs.writeFileSync(file, after, 'utf8');
            changed += 1;
        }
    }
    return { files: files.length, changed };
}

const isDirect = path.basename(fileURLToPath(import.meta.url)) === path.basename(process.argv[1] || '');
if (isDirect) {
    const result = bakeSeoIntoTree();
    console.log(`Baked SEO titles into ${result.changed}/${result.files} pages.`);
}
