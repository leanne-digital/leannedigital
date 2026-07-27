import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMING_SOON_PAGES, PRIMARY_NAV, SERVICE_LINKS, BUILT_PAGES } from './site-config.mjs';
import { renderFavicons } from './favicons.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function assetPrefix(depth) {
    return depth === 0 ? '' : '../'.repeat(depth);
}

function renderNav(depth, currentPath) {
    const prefix = assetPrefix(depth);
    const home = depth === 0 ? '/' : `${prefix}`.replace(/\/?$/, '/') || '/';

    const items = PRIMARY_NAV.map((item) => {
        if (item.type === 'services') {
            const links = SERVICE_LINKS.map(
                (link) =>
                    `                        <li><a href="${link.path}"${currentPath === link.path ? ' aria-current="page"' : ''}>${link.title}</a></li>`
            ).join('\n');
            return `                <li class="site-nav__item site-nav__item--has-menu">
                    <button type="button" class="site-nav__trigger" aria-expanded="false" aria-haspopup="true">
                        ${item.title}
                        <svg class="site-nav__chevron" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M2.5 4.5 6 8l3.5-3.5"/></svg>
                    </button>
                    <ul class="site-nav__submenu">
${links}
                    </ul>
                </li>`;
        }
        const current = currentPath === item.path ? ' aria-current="page"' : '';
        return `                <li class="site-nav__item"><a href="${item.path}"${current}>${item.title}</a></li>`;
    }).join('\n');

    return `    <header class="site-header">
        <div class="container site-header__inner">
            <a class="site-logo" href="${depth === 0 ? '/' : '/'}" aria-label="Leanne Digital home">
                <img
                    class="site-logo__image"
                    src="${prefix}assets/images/brand/leanne-digital-logo-white.png"
                    alt="Leanne Digital"
                    width="184"
                    height="52"
                >
            </a>
            <button type="button" class="site-nav__toggle" aria-expanded="false" aria-controls="primary-nav" aria-label="Open menu">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <nav class="site-nav" id="primary-nav" aria-label="Primary">
                <ul class="site-nav__list">
${items}
                </ul>
            </nav>
        </div>
    </header>`;
}

function renderFooter(depth) {
    return `    <footer class="site-footer">
        <div class="container site-footer__inner">
            <p class="site-footer__brand">&copy; ${new Date().getFullYear()} Leanne Digital</p>
            <nav class="site-footer__nav" aria-label="Footer">
                <a href="/privacy-policy/">Privacy Policy</a>
                <a href="/sitemap/">Sitemap</a>
            </nav>
        </div>
    </footer>`;
}

function renderHead({ title, description, depth, extraCss = [] }) {
    const prefix = assetPrefix(depth);
    const cssLinks = [
        'tokens.css',
        'base.css',
        'header.css',
        'footer.css',
        ...extraCss,
    ]
        .map((file) => `    <link rel="stylesheet" href="${prefix}css/${file}">`)
        .join('\n');

    return `<!DOCTYPE html>
<html lang="en-CA">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Leanne Digital</title>
    <meta name="description" content="${description}">
${renderFavicons(prefix)}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Nunito:wght@700;800&family=Open+Sans:wght@400;700&display=swap" rel="stylesheet">
${cssLinks}
</head>`;
}

function renderComingSoon(page, depth) {
    const prefix = assetPrefix(depth);
    return `${renderHead({
        title: page.title,
        description: `${page.description} This page is coming soon.`,
        depth,
        extraCss: ['coming-soon.css'],
    })}
<body class="page-inner">
${renderNav(depth, page.path)}
    <main class="coming-soon">
        <div class="container coming-soon__inner">
            <p class="coming-soon__eyebrow">Coming soon</p>
            <h1 class="coming-soon__title">${page.title}</h1>
            <p class="coming-soon__lead">We're rebuilding leanne.digital. This page will be back shortly with updated content.</p>
            <a class="coming-soon__cta" href="/">Back to home</a>
        </div>
    </main>
${renderFooter(depth)}
    <script src="${prefix}js/site-nav.js" defer></script>
</body>
</html>
`;
}

function renderSitemapPage(pages, depth) {
    const grouped = {
        Main: pages.filter((p) => ['/about/', '/portfolio/', '/blog/', '/contact/'].includes(p.path)),
        Services: pages.filter((p) => SERVICE_LINKS.some((s) => s.path === p.path)),
        Other: pages.filter(
            (p) =>
                !['/about/', '/portfolio/', '/blog/', '/contact/'].includes(p.path) &&
                !SERVICE_LINKS.some((s) => s.path === p.path) &&
                p.path !== '/sitemap/'
        ),
    };

    const sections = Object.entries(grouped)
        .map(([label, items]) => {
            const links = items
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((p) => `                        <li><a href="${p.path}">${p.title}</a></li>`)
                .join('\n');
            return `                <section class="sitemap-page__section">
                    <h2>${label}</h2>
                    <ul>
${links}
                    </ul>
                </section>`;
        })
        .join('\n');

    return `${renderHead({
        title: 'Sitemap',
        description: 'Browse all pages on leanne.digital.',
        depth,
        extraCss: ['coming-soon.css', 'sitemap-page.css'],
    })}
<body class="page-inner">
${renderNav(depth, '/sitemap/')}
    <main class="coming-soon sitemap-page">
        <div class="container coming-soon__inner">
            <p class="coming-soon__eyebrow">Site map</p>
            <h1 class="coming-soon__title">All pages</h1>
            <p class="coming-soon__lead">Most pages are being rebuilt. Use this list to preview the new site structure.</p>
            <div class="sitemap-page__grid">
${sections}
            </div>
        </div>
    </main>
${renderFooter(depth)}
    <script src="${assetPrefix(depth)}js/site-nav.js" defer></script>
</body>
</html>
`;
}

function writePage(relativeDir, filename, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), html, 'utf8');
}

const uniquePages = [...new Map(COMING_SOON_PAGES.map((p) => [p.path, p])).values()];

for (const page of uniquePages) {
    const slug = page.path.replace(/^\/|\/$/g, '');
    const depth = slug ? 1 : 0;

    if (BUILT_PAGES.has(page.path)) {
        continue;
    }

    if (page.path === '/sitemap/') {
        writePage(slug, 'index.html', renderSitemapPage(uniquePages, depth));
        continue;
    }

    writePage(slug, 'index.html', renderComingSoon(page, depth));
}

console.log(`Generated ${uniquePages.length} coming-soon pages.`);
