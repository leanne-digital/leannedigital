import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from './site-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', 'data', 'server', 'scripts', '_import', 'docs', '.git']);

function walkHtml(dir, out = []) {
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

function pagePathFromFile(file) {
    const rel = path.relative(ROOT, path.dirname(file)).replaceAll('\\', '/');
    return rel === '' ? '/' : `/${rel}/`;
}

function isPrivate(pagePath) {
    return (
        pagePath.startsWith('/clients/') ||
        pagePath.startsWith('/login/') ||
        pagePath === '/clients/' ||
        pagePath === '/thank-you/'
    );
}

function checkPage(file) {
    const html = fs.readFileSync(file, 'utf8');
    const pagePath = pagePathFromFile(file);
    const issues = [];
    const hasSeoSlot = html.includes('<!-- lp:seo -->');
    const hasHeadSlot = html.includes('<!-- lp:custom-head -->');
    const hasBodyEnd = html.includes('<!-- lp:custom-body-end -->');
    const hasLoader = html.includes('data-key="__SITE_KEY__"') || html.includes('/v1/platform.js');
    const hasBakedTitle = /<title>[^<]+<\/title>/i.test(html);
    const hasGtag = html.includes('gtag/js?id=');
    const hasLocalSnippet =
        html.includes('localhost:4000') ||
        /src="[^"]*snippet\.js/i.test(html);
    const hasLocalForm = html.includes('/api/contact') || html.includes('contact-form.js');
    const hasFaqVisible = /Frequently Asked Questions/i.test(html) && /<details[\s\S]*?<summary/i.test(html);

    if (!hasSeoSlot) issues.push('missing <!-- lp:seo --> slot');
    if (!hasHeadSlot) issues.push('missing <!-- lp:custom-head --> slot');
    if (!hasBodyEnd) issues.push('missing <!-- lp:custom-body-end --> slot');
    if (!hasLoader) issues.push('missing platform.js loader placeholders');
    if (!isPrivate(pagePath) && !hasBakedTitle) issues.push('missing <title> tag');
    if (hasGtag) issues.push('baked Google tag — use Lilipadd custom code / Google settings');
    if (hasLocalSnippet) issues.push('legacy snippet.js / localhost loader');
    if (hasLocalForm) issues.push('form still posts to /api/contact or loads contact-form.js');
    if (!isPrivate(pagePath) && !/noindex/i.test(html)) {
        if (!hasFaqVisible) issues.push('missing visible FAQ');
    }

    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((match) => match[1]);
    const broken = [];
    for (const raw of [...hrefs, ...srcs]) {
        if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/api/')) continue;
        const clean = raw.split('#')[0].split('?')[0];
        if (!clean || clean === '/') {
            if (!fs.existsSync(path.join(ROOT, 'index.html'))) broken.push(raw);
            continue;
        }
        const target = path.join(ROOT, clean.replace(/^\//, ''));
        const asFile = target;
        const asIndex = path.join(target, 'index.html');
        const asDirIndex = clean.endsWith('/') ? path.join(ROOT, clean.replace(/^\//, ''), 'index.html') : asIndex;
        if (!fs.existsSync(asFile) && !fs.existsSync(asDirIndex) && !fs.existsSync(`${target}.html`)) {
            broken.push(raw);
        }
    }

    return { pagePath, issues, broken: [...new Set(broken)] };
}

function main() {
    const files = walkHtml(ROOT);
    let failed = 0;
    const required = ['robots.txt', 'sitemap.xml', 'llms.txt'];
    for (const name of required) {
        if (!fs.existsSync(path.join(ROOT, name))) {
            console.error(`Missing ${name}`);
            failed += 1;
        }
    }
    const robots = fs.existsSync(path.join(ROOT, 'robots.txt'))
        ? fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8')
        : '';
    if (robots && !robots.includes('Sitemap:')) {
        console.error('robots.txt is missing a Sitemap directive');
        failed += 1;
    }

    for (const file of files) {
        const result = checkPage(file);
        if (result.issues.length || result.broken.length) {
            failed += 1;
            console.error(`${result.pagePath}`);
            result.issues.forEach((issue) => console.error(`  - ${issue}`));
            result.broken.slice(0, 12).forEach((link) => console.error(`  - broken: ${link}`));
            if (result.broken.length > 12) console.error(`  - … ${result.broken.length - 12} more broken links`);
        }
    }

    if (failed) {
        console.error(`\nSEO verify failed (${failed} pages/files).`);
        process.exit(1);
    }
    console.log(`SEO verify passed for ${files.length} pages.`);
}

main();
