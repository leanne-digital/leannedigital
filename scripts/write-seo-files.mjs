import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_LINKS, SITE_URL } from './site-config.mjs';
import {
    escapeHtml,
    renderFullFooter,
    renderHead,
    renderNav,
    renderPageScripts,
} from './layout.mjs';
import { faqsForPath, renderFaqSection, writeSeoFiles } from './seo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sitemapTitles() {
    const titles = {
        '/': 'Home',
        '/about/': 'About',
        '/contact/': 'Contact',
        '/portfolio/': 'Portfolio',
        '/blog/': 'Blog',
        '/privacy-policy/': 'Privacy Policy',
        '/sitemap/': 'Sitemap',
        '/google-ads/': 'Google Ads',
    };
    for (const link of SERVICE_LINKS) titles[link.path] = link.title;
    for (const post of loadJson('data/blog-posts.json')) titles[post.path] = post.title;
    for (const project of loadJson('data/portfolio-projects.json')) titles[project.path] = project.title;
    return titles;
}

function displayTitle(page, titles) {
    return titles[page.path] || page.title || page.path;
}

function groupSitemapPages(pages) {
    const blogPaths = new Set(loadJson('data/blog-posts.json').map((post) => post.path));
    const projectPaths = new Set(loadJson('data/portfolio-projects.json').map((project) => project.path));
    const servicePaths = new Set([...SERVICE_LINKS.map((link) => link.path), '/google-ads/']);
    const groups = {
        Pages: [],
        Services: [],
        Blog: [],
        Portfolio: [],
    };

    for (const page of pages) {
        if (blogPaths.has(page.path)) groups.Blog.push(page);
        else if (projectPaths.has(page.path)) groups.Portfolio.push(page);
        else if (servicePaths.has(page.path)) groups.Services.push(page);
        else groups.Pages.push(page);
    }

    return groups;
}

function renderList(items, titles) {
    return [...items]
        .sort((a, b) => {
            if (a.path === '/') return -1;
            if (b.path === '/') return 1;
            return displayTitle(a, titles).localeCompare(displayTitle(b, titles));
        })
        .map((page) => `                    <li><a href="${page.path}">${escapeHtml(displayTitle(page, titles))}</a></li>`)
        .join('\n');
}

function writeHtmlSitemap(pages) {
    const titles = sitemapTitles();
    const groups = groupSitemapPages(pages);
    const sections = Object.entries(groups)
        .filter(([, items]) => items.length)
        .map(
            ([label, items]) => `            <section class="legal-page__section">
                <h2>${escapeHtml(label)}</h2>
                <ul>
${renderList(items, titles)}
                </ul>
            </section>`
        )
        .join('\n');

    const html = `${renderHead({
        title: 'HTML Sitemap of Pages, Services & Blog | Leanne Digital',
        description: 'A simple list of pages and posts on Leanne Digital, including services, portfolio, and blog.',
        depth: 1,
        extraCss: ['legal.css'],
        canonical: `${SITE_URL}/sitemap/`,
        path: '/sitemap/',
    })}
<body class="page-inner">
    <!-- lp:custom-body-start -->
${renderNav(1, '/sitemap/')}
    <main id="main" class="legal-page legal-page--wide">
        <div class="container legal-page__inner">
            <h1>Sitemap</h1>
            <p>Every public page and post on this site. Search engines should use the <a href="/sitemap.xml">XML sitemap</a>.</p>
            <div class="legal-page__grid">
${sections}
            </div>
        </div>
${renderFaqSection(faqsForPath('/sitemap/'))}
    </main>
${renderFullFooter(1)}
${renderPageScripts(1)}
    <!-- lp:custom-body-end -->
</body>
</html>
`;

    const dir = path.join(ROOT, 'sitemap');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

const pages = writeSeoFiles();
writeHtmlSitemap(pages);
console.log(`Wrote robots.txt, sitemap.xml, llms.txt, and /sitemap/ (${pages.length} public URLs).`);
