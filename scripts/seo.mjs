import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from './site-config.mjs';

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAQ_FILE = path.join(ROOT, 'data', 'page-faqs.json');

export function rewriteLegacyLinks(html) {
    return String(html || '')
        .replaceAll('/wp-admin/', '/clients/')
        .replaceAll('/services/graphic-design-winnipeg/', '/graphic-design/')
        .replaceAll('/services/web-design-winnipeg/', '/website-design/');
}
export const GTAG_ID = 'G-K29LV069TN';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/hero/leanne-and-gary-ld-hero-v02.webp`;
export const CONTACT_EMAIL = 'leanne@leannedigital.com';

let faqCache = null;

export function loadPageFaqs() {
    if (!faqCache) {
        faqCache = JSON.parse(fs.readFileSync(FAQ_FILE, 'utf8'));
    }
    return faqCache;
}

export function faqsForPath(pagePath, extras = []) {
    const all = loadPageFaqs();
    const specific = all[pagePath] || [];
    if (specific.length >= 8) return specific;
    const fallback = all.default || [];
    const merged = [...extras, ...specific];
    if (merged.length >= 3) return merged.slice(0, 8);
    const seen = new Set(merged.map((item) => item.question.toLowerCase()));
    for (const item of fallback) {
        if (seen.has(item.question.toLowerCase())) continue;
        merged.push(item);
        if (merged.length >= 4) break;
    }
    return merged;
}

export function extractFaqsFromHtml(html) {
    const faqs = [];
    const blocks = html.match(/<details[\s\S]*?<\/details>/gi) || [];
    for (const block of blocks) {
        const summary = block.match(/<summary[\s\S]*?<\/summary>/i);
        const question = summary
            ? summary[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : '';
        const textMatch =
            block.match(/<div class="ld-widget-text"><div>([\s\S]*?)<\/div><\/div>/i) ||
            block.match(/<p>([\s\S]*?)<\/p>/i);
        const answer = textMatch
            ? String(textMatch[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : '';
        if (question && answer) faqs.push({ question, answer });
    }
    return faqs;
}

export function htmlHasVisibleFaq(html) {
    return /Frequently Asked Questions/i.test(html) && /<details[\s\S]*?<summary/i.test(html);
}

export function faqSchema(faqs) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    };
}

export function organizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'ProfessionalService',
        name: 'Leanne Digital',
        url: SITE_URL,
        email: CONTACT_EMAIL,
        image: DEFAULT_OG_IMAGE,
        address: {
            '@type': 'PostalAddress',
            addressLocality: 'Winnipeg',
            addressRegion: 'MB',
            addressCountry: 'CA',
        },
        areaServed: 'CA',
        sameAs: [
            'https://www.facebook.com/Leanne.Digital',
            'https://www.linkedin.com/company/leanne-digital-design/',
            'https://www.instagram.com/leannedigitaldesign/',
        ],
    };
}

export function renderJsonLd(data) {
    const items = Array.isArray(data) ? data : [data];
    return items
        .filter(Boolean)
        .map((item) => `    <script type="application/ld+json">${JSON.stringify(item)}</script>`)
        .join('\n');
}

export function renderGtag() {
    return `    <script async src="https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GTAG_ID}');
    </script>`;
}

export function unescapeBasicHtml(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
}

export function renderOgTags({ title, description, canonical, ogImage, ogType = 'website' }) {
    const image = ogImage || DEFAULT_OG_IMAGE;
    const safeTitle = escapeHtml(unescapeBasicHtml(title).replace(/\s+/g, ' ').trim());
    const safeDesc = escapeHtml(unescapeBasicHtml(description).replace(/\s+/g, ' ').trim());
    return `    <meta property="og:type" content="${escapeHtml(ogType)}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDesc}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:site_name" content="Leanne Digital">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDesc}">
    <meta name="twitter:image" content="${escapeHtml(image)}">`;
}

export function renderSeoBlock({
    title,
    description,
    canonical,
    robots = 'index,follow',
    ogImage,
    ogType = 'website',
    schema,
}) {
    const safeTitle = escapeHtml(unescapeBasicHtml(title).replace(/\s+/g, ' ').trim());
    const safeDesc = escapeHtml(unescapeBasicHtml(description).replace(/\s+/g, ' ').trim());
    const safeCanonical = escapeHtml(String(canonical || '').trim());
    const safeRobots = escapeHtml(String(robots || 'index,follow').trim());
    const jsonLd = schema ? `\n${renderJsonLd(schema)}` : '';
    return `    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}">
    <meta name="robots" content="${safeRobots}">
    <link rel="canonical" href="${safeCanonical}">
${renderOgTags({ title, description, canonical, ogImage, ogType })}${jsonLd}`;
}

export function renderFaqSection(faqs, { heading = 'Frequently Asked Questions' } = {}) {
    if (!faqs?.length) return '';
    const items = faqs
        .map(
            (item) => `                <details class="page-faq__item">
                    <summary>${escapeHtml(item.question)}</summary>
                    <p>${escapeHtml(item.answer)}</p>
                </details>`
        )
        .join('\n');
    return `        <section class="page-faq section--navy" aria-labelledby="page-faq-heading">
            <div class="container page-faq__inner">
                <h2 class="page-faq__title" id="page-faq-heading">${escapeHtml(heading)}</h2>
                <div class="page-faq__list">
${items}
                </div>
            </div>
        </section>
`;
}

export function renderFaqSchemaOnly(_faqs) {
    return '';
}

export function recaptchaSiteKey() {
    return String(process.env.RECAPTCHA_SITE_KEY || '').trim();
}

export function renderRecaptchaScript() {
    const key = recaptchaSiteKey();
    if (!key) return '';
    return `    <script src="https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}"></script>`;
}

export function renderContactFormScript(depth) {
    const prefix = depth === 0 ? '' : '../'.repeat(depth);
    const key = recaptchaSiteKey();
    const config = key
        ? `    <script>window.LD_RECAPTCHA_SITE_KEY = ${JSON.stringify(key)};</script>\n`
        : '';
    return `${config}${renderRecaptchaScript()}
    <script src="${prefix}js/contact-form.js" defer></script>`;
}

const NOINDEX_PREFIXES = ['/clients/', '/login/', '/assets/clients/', '/admin/'];
const NOINDEX_PATHS = new Set(['/client-portal/', '/project-tracker/', '/ldd-chat/']);

export function isNoindexPath(pagePath) {
    if (NOINDEX_PATHS.has(pagePath)) return true;
    return NOINDEX_PREFIXES.some((prefix) => pagePath === prefix || pagePath.startsWith(prefix));
}

export function collectPublicPages() {
    const pages = [];
    function walk(dir, urlPath) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const hasIndex = entries.some((entry) => entry.isFile() && entry.name === 'index.html');
        if (hasIndex && urlPath !== '') {
            const pagePath = urlPath === '/' ? '/' : `${urlPath}/`;
            if (!isNoindexPath(pagePath) && !pagePath.startsWith('/blog/page/')) {
                const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
                if (!/name="robots" content="noindex/i.test(html) && !/Coming soon/i.test(html)) {
                    const rawTitle = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || pagePath;
                    const title = rawTitle
                        .replace(/\s*\|\s*Leanne Digital\s*$/i, '')
                        .replace(/&amp;/g, '&')
                        .trim();
                    pages.push({
                        path: pagePath,
                        title: title || pagePath,
                        lastmod: fs.statSync(path.join(dir, 'index.html')).mtime.toISOString().slice(0, 10),
                    });
                }
            }
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (['assets', 'css', 'js', 'data', 'server', 'scripts', 'node_modules', '_import', 'docs'].includes(entry.name)) {
                continue;
            }
            const nextUrl = urlPath === '/' ? `/${entry.name}` : `${urlPath}/${entry.name}`;
            walk(path.join(dir, entry.name), nextUrl);
        }
    }
    walk(ROOT, '/');
    pages.sort((a, b) => a.path.localeCompare(b.path));
    return pages;
}

export function writeRobotsTxt() {
    const body = `User-agent: *
Allow: /
Disallow: /clients/
Disallow: /assets/clients/
Disallow: /login/

Sitemap: ${SITE_URL}/sitemap.xml
# LLM / AI crawlers: ${SITE_URL}/llms.txt
`;
    fs.writeFileSync(path.join(ROOT, 'robots.txt'), body, 'utf8');
}

export function writeSitemapXml(pages) {
    const urls = pages
        .map(
            (page) => `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${page.lastmod}</lastmod>
  </url>`
        )
        .join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
}

export function writeLlmsTxt(pages) {
    const links = pages
        .filter((page) => !page.path.startsWith('/projects/') && page.path.split('/').filter(Boolean).length <= 2)
        .slice(0, 40)
        .map((page) => `- ${SITE_URL}${page.path}`)
        .join('\n');
    const body = `# Leanne Digital

> Indigenous-owned digital marketing agency in Winnipeg, Manitoba. Website design, SEO, AEO, branding, graphic design, and Google Ads for businesses and Indigenous organizations.

Preferred citation: Leanne Digital (https://leannedigital.com)

Contact: ${CONTACT_EMAIL}

## Key pages

${links}

## Notes

- Public XML sitemap: ${SITE_URL}/sitemap.xml
- Human sitemap: ${SITE_URL}/sitemap/
- Client portal and login pages are private and should not be cited.
`;
    fs.writeFileSync(path.join(ROOT, 'llms.txt'), body, 'utf8');
}

export function writeSeoFiles() {
    const pages = collectPublicPages();
    if (!pages.some((page) => page.path === '/')) {
        pages.unshift({
            path: '/',
            title: 'Home',
            lastmod: fs.statSync(path.join(ROOT, 'index.html')).mtime.toISOString().slice(0, 10),
        });
    }
    if (!pages.some((page) => page.path === '/sitemap/')) {
        pages.push({
            path: '/sitemap/',
            title: 'Sitemap',
            lastmod: new Date().toISOString().slice(0, 10),
        });
    }
    pages.sort((a, b) => a.path.localeCompare(b.path));
    writeRobotsTxt();
    writeSitemapXml(pages);
    writeLlmsTxt(pages);
    return pages;
}
