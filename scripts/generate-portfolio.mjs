import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    assetPrefix,
    escapeHtml,
    renderFullFooter,
    renderHead,
    renderNav,
    renderPageScripts,
} from './layout.mjs';
import { PORTFOLIO_FILTERS } from './portfolio-filters.mjs';
import { faqsForPath, renderFaqSection } from './seo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'portfolio-projects.json');
const SITE = 'https://leannedigital.com';

function depthFromDir(relativeDir) {
    if (!relativeDir) return 0;
    return relativeDir.split('/').filter(Boolean).length;
}

function writePage(relativeDir, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function renderFilterGroups() {
    return PORTFOLIO_FILTERS.map((group) => {
        const options = group.options
            .map(
                (option) => `                            <label class="portfolio-filter__check">
                                <input type="checkbox" value="${option.value}">
                                <span>${escapeHtml(option.label)}</span>
                            </label>`
            )
            .join('\n');

        return `                    <div class="portfolio-filter__group" data-tax="${group.id}">
                        <p class="portfolio-filter__heading">${escapeHtml(group.label)}</p>
                        <div class="portfolio-filter__options">
${options}
                        </div>
                    </div>`;
    }).join('\n');
}

function renderPortfolioCard(project, depth) {
    const prefix = assetPrefix(depth);
    const image = project.featuredImage
        ? `<img class="portfolio-card__image" src="${prefix}${project.featuredImage.replace(/^\//, '')}" alt="" width="640" height="890" loading="lazy">`
        : '';
    const tags = project.tags.join(',');

    return `                <article class="portfolio-card" data-tags="${escapeHtml(tags)}">
                    <a class="portfolio-card__media" href="${project.path}">${image}</a>
                    <div class="portfolio-card__body">
                        <h2 class="portfolio-card__title"><a href="${project.path}">${escapeHtml(project.title)}</a></h2>
                        <p class="portfolio-card__categories">${escapeHtml(project.categoriesLine)}</p>
                    </div>
                </article>`;
}

function renderPortfolioIndex(projects, depth) {
    const prefix = assetPrefix(depth);
    const cards = projects.map((project) => renderPortfolioCard(project, depth)).join('\n');

    return `${renderHead({
        title: 'Creative Design &amp; SEO Portfolio | Leanne Digital',
        description:
            'Explore our portfolio of web design, graphic design, and SEO projects. See how Leanne Digital transforms brands with modern websites, compelling visuals, and results-driven SEO strategies.',
        depth,
        extraCss: ['portfolio.css'],
        canonical: `${SITE}/portfolio/`,
    })}
<body class="page-inner">
${renderNav(depth, '/portfolio/')}
    <main id="main">
        <section class="portfolio-hero section--navy" aria-labelledby="portfolio-heading">
            <div class="container">
                <h1 class="portfolio-hero__title" id="portfolio-heading">Our Portfolio</h1>
                <p class="portfolio-hero__lead">We create websites and graphics that are as solid behind the scenes as they are stunning on the surface. Every project is built with strategy, clean code, and <a href="/5-easy-seo-fixes-you-can-do-today-on-your-wordpress-site/">SEO</a> in mind — so your brand looks great and performs even better.</p>
            </div>
        </section>
        <section class="portfolio-layout section--navy" aria-label="Portfolio projects">
            <div class="container portfolio-layout__grid">
                <aside class="portfolio-filters" id="portfolio-filters" aria-label="Filter projects">
${renderFilterGroups()}
                    <button type="button" class="portfolio-filter__clear">Clear All</button>
                </aside>
                <div class="portfolio-grid" id="portfolio-grid">
${cards}
                </div>
            </div>
        </section>
${renderFaqSection(faqsForPath('/portfolio/'))}
    </main>
${renderFullFooter(depth)}
${renderPageScripts(depth, `
    <script src="${prefix}js/portfolio-filters.js" defer></script>`)}
</body>
</html>
`;
}

function renderProjectPage(project, projects, depth) {
    const prefix = assetPrefix(depth);
    const featured = project.featuredImage
        ? `<figure class="project__featured">
                <img src="${prefix}${project.featuredImage.replace(/^\//, '')}" alt="" width="1032" height="1439" loading="eager">
            </figure>`
        : '';

    const websiteButton = project.websiteUrl
        ? `<a class="ld-btn project__website" href="${escapeHtml(project.websiteUrl)}" target="_blank" rel="noopener noreferrer">View Website</a>`
        : '';

    const overview = project.overview
        ? `<div class="project__overview">
                <h2 class="project__overview-title">Project Overview</h2>
                <div class="project-prose">${project.overview}</div>
                ${websiteButton}
            </div>`
        : '';

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: project.title,
        description: project.description,
        image: project.featuredImage ? `${SITE}${project.featuredImage}` : undefined,
        url: `${SITE}${project.path}`,
        creator: {
            '@type': 'Organization',
            name: 'Leanne Digital',
            url: SITE,
        },
    };

    return `${renderHead({
        title: `${escapeHtml(project.title)} | Leanne Digital`,
        description: escapeHtml(project.description || project.title),
        depth,
        extraCss: ['project.css'],
        canonical: `${SITE}${project.path}`,
    })}
<body class="page-inner">
${renderNav(depth, '')}
    <main id="main">
        <article class="project section--navy">
            <header class="project__header">
                <div class="container project__header-inner">
                    <p class="project__categories">${escapeHtml(project.categoriesLine)}</p>
                    <h1 class="project__title">${escapeHtml(project.title)}</h1>
                    <a class="project__back-link" href="/portfolio/">View All Projects</a>
                </div>
            </header>
            <section class="project__body">
                <div class="container">
                    <div class="project__panel">
                        <div class="project__content">
                            ${overview}
                            ${featured}
                        </div>
                    </div>
                </div>
            </section>
        </article>
${renderFaqSection(faqsForPath(project.path, [
    {
        question: `What is the ${project.title} project?`,
        answer: project.description || `${project.title} is a Leanne Digital portfolio project.`,
    },
    {
        question: 'Can you create similar work for my business?',
        answer: 'Yes. Get in touch with what you need and we will talk through whether a similar website, brand, or SEO project is a fit.',
    },
]))}
    </main>
${renderFullFooter(depth)}
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
${renderPageScripts(depth)}
</body>
</html>
`;
}

function main() {
    if (!fs.existsSync(DATA_FILE)) {
        console.error('Missing data/portfolio-projects.json — run: node scripts/import-portfolio.mjs');
        process.exit(1);
    }

    const projects = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    writePage('portfolio', renderPortfolioIndex(projects, depthFromDir('portfolio')));

    for (const project of projects) {
        writePage(`projects/${project.slug}`, renderProjectPage(project, projects, depthFromDir(`projects/${project.slug}`)));
    }

    console.log(`Generated portfolio index and ${projects.length} project pages.`);
}

main();
