import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from './site-config.mjs';
import { isNoindexPath } from './seo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set([
    'node_modules',
    'data',
    'server',
    'scripts',
    '_import',
    'docs',
    '.git',
    'assets',
    'css',
    'js',
]);

const PLATFORM_SCRIPT =
    '    <script src="__PLATFORM_URL__" data-key="__SITE_KEY__" defer></script>';

export function urlPathFor(file) {
    const rel = path.relative(ROOT, path.dirname(file)).replaceAll('\\', '/');
    return rel === '' ? '/' : `/${rel}/`;
}

export function walkHtml(dir = ROOT, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walkHtml(full, out);
        } else if (entry.name === 'index.html') {
            out.push(full);
        }
    }
    return out;
}

export function extractPageMeta(html, pagePath) {
    const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim() || '';
    const description =
        (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1]?.trim() || '';
    const robots =
        (html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i) || [])[1]?.trim() || '';
    const canonical =
        (html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i) || [])[1]?.trim() || '';
    const schemas = [];
    for (const match of html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    )) {
        try {
            schemas.push(JSON.parse(match[1]));
        } catch {
            /* ignore invalid JSON-LD */
        }
    }
    const faq = schemas.find((item) => item?.['@type'] === 'FAQPage') || null;
    const noindex =
        isNoindexPath(pagePath) || /noindex/i.test(robots) || pagePath.startsWith('/blog/page/');
    return {
        path: pagePath,
        title: title.replace(/&amp;/g, '&'),
        description: description.replace(/&amp;/g, '&'),
        robots: robots || (noindex ? 'noindex,nofollow' : 'index,follow'),
        canonical: canonical || `${SITE_URL}${pagePath === '/' ? '/' : pagePath}`,
        inSitemap: !noindex,
        schema: faq,
    };
}

export function collectSeoInventory() {
    return walkHtml().map((file) => extractPageMeta(fs.readFileSync(file, 'utf8'), urlPathFor(file)));
}

export function transformHtml(html) {
    let out = html;

    out = out.replace(/<title>[^<]*<\/title>\s*/gi, '');
    out = out.replace(/<meta\s+name="description"[^>]*>\s*/gi, '');
    out = out.replace(/<meta\s+name="robots"[^>]*>\s*/gi, '');
    out = out.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
    out = out.replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '');
    out = out.replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '');
    out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, '');
    out = out.replace(
        /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]*"><\/script>\s*/gi,
        '',
    );
    out = out.replace(/<script>\s*window\.dataLayer[\s\S]*?gtag\('config'[\s\S]*?<\/script>\s*/gi, '');
    out = out.replace(/<script[^>]*(?:snippet\.js|platform\.js)[^>]*>\s*<\/script>\s*/gi, '');
    out = out.replace(/<script[^>]*lilipadd-events\.js[^>]*>\s*<\/script>\s*/gi, '');
    out = out.replace(/<script[^>]*contact-form\.js[^>]*>\s*<\/script>\s*/gi, '');
    out = out.replace(/<script>window\.LD_RECAPTCHA_SITE_KEY[\s\S]*?<\/script>\s*/gi, '');
    out = out.replace(/<script src="https:\/\/www\.google\.com\/recaptcha\/api\.js[^"]*"><\/script>\s*/gi, '');

    if (!out.includes('<!-- lp:seo -->')) {
        out = out.replace(
            /(<meta\s+name="viewport"[^>]*>)/i,
            '$1\n    <!-- lp:seo -->\n    <!-- lp:custom-head -->',
        );
    }
    if (!out.includes('<!-- lp:custom-head -->')) {
        out = out.replace(/(<!-- lp:seo -->)/, '$1\n    <!-- lp:custom-head -->');
    }
    if (!out.includes('data-key="__SITE_KEY__"')) {
        out = out.replace('<!-- lp:custom-head -->', `<!-- lp:custom-head -->\n${PLATFORM_SCRIPT}`);
    }

    if (!out.includes('<!-- lp:custom-body-start -->')) {
        out = out.replace(/<body([^>]*)>/i, '<body$1>\n    <!-- lp:custom-body-start -->');
    }
    if (!out.includes('<!-- lp:custom-body-end -->')) {
        out = out.replace(/<\/body>/i, '    <!-- lp:custom-body-end -->\n</body>');
    }

    out = out.replace(/<form([^>]*class="[^"]*contact-form[^"]*"[^>]*)>/gi, (_match, attrs) => {
        let next = attrs;
        if (!/data-lp-form=/.test(next)) next += ' data-lp-form="contact"';
        if (!/\blp-form\b/.test(next)) {
            next = next.replace(/class="([^"]*)"/, 'class="$1 lp-form"');
        }
        if (/\bid="/.test(next)) next = next.replace(/\bid="[^"]*"/, 'id="contact"');
        else next += ' id="contact"';
        if (/action="/.test(next)) next = next.replace(/action="[^"]*"/, 'action="/thank-you/"');
        else next += ' action="/thank-you/"';
        if (/method="/.test(next)) next = next.replace(/method="[^"]*"/, 'method="post"');
        else next += ' method="post"';
        return `<form${next}>`;
    });
    out = out.replace(/name="_honey"/g, 'name="website"');
    out = out.replace(/name="company_website"/g, 'name="website"');

    return out;
}

export function applySlotsToTree() {
    const files = walkHtml();
    let changed = 0;
    for (const file of files) {
        const before = fs.readFileSync(file, 'utf8');
        const after = transformHtml(before);
        if (after !== before) {
            fs.writeFileSync(file, after, 'utf8');
            changed += 1;
        }
    }
    return { files: files.length, changed };
}
