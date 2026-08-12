import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    assetPrefix,
    escapeHtml,
    formatDisplayDate,
    renderFullFooter,
    renderHead,
    renderNav,
    renderPageScripts,
} from './layout.mjs';
import { unwrapInternalLinksInHeadings } from './service-html-normalize.mjs';
import { faqsForPath, renderFaqSection, rewriteLegacyLinks } from './seo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'blog-posts.json');
const POSTS_PER_PAGE = 12;
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

function renderBlogCard(post, depth) {
    const prefix = assetPrefix(depth);
    const image = post.featuredImage
        ? `<img class="blog-card__image" src="${prefix}${post.featuredImage.replace(/^\//, '')}" alt="" width="640" height="360" loading="lazy">`
        : '';

    return `                <article class="blog-card">
                    <a class="blog-card__media" href="${post.path}">${image}</a>
                    <div class="blog-card__body">
                        <p class="blog-card__category">${escapeHtml(post.category)}</p>
                        <h2 class="blog-card__title"><a href="${post.path}">${escapeHtml(post.title)}</a></h2>
                        <p class="blog-card__excerpt">${escapeHtml(post.excerpt)}</p>
                        <p class="blog-card__meta">
                            <a class="blog-card__read-more" href="${post.path}">Read More »</a>
                            <time datetime="${post.datePublished}">${escapeHtml(post.dateDisplay)}</time>
                        </p>
                    </div>
                </article>`;
}

function renderPagination(currentPage, totalPages, depth) {
    if (totalPages <= 1) return '';

    const items = [];
    for (let page = 1; page <= totalPages; page += 1) {
        const href = page === 1 ? '/blog/' : `/blog/page/${page}/`;
        const current = page === currentPage ? ' aria-current="page"' : '';
        items.push(`                <a class="blog-pagination__link${page === currentPage ? ' is-current' : ''}" href="${href}"${current}>${page}</a>`);
    }

    return `            <nav class="blog-pagination" aria-label="Blog pages">
${items.join('\n')}
            </nav>`;
}

function renderBlogIndex(posts, page, depth) {
    const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
    const start = (page - 1) * POSTS_PER_PAGE;
    const pagePosts = posts.slice(start, start + POSTS_PER_PAGE);
    const prefix = assetPrefix(depth);
    const pagePath = page === 1 ? '/blog/' : `/blog/page/${page}/`;
    const title =
        page === 1
            ? 'Winnipeg Design Blog &amp; Insights | Leanne Digital'
            : `Blog — Page ${page} | Leanne Digital`;
    const description =
        'Leanne Digital is a Winnipeg-based studio helping small businesses grow through smart web design, development, SEO, and branding. Explore tips, insights, and inspiration.';

    const cards = pagePosts.map((post) => renderBlogCard(post, depth)).join('\n');

    return `${renderHead({
        title,
        description,
        depth,
        extraCss: ['blog.css'],
        canonical: `${SITE}${pagePath}`,
    })}
<body class="page-inner">
${renderNav(depth, '/blog/')}
    <main id="main">
        <section class="blog-hero section--navy" aria-labelledby="blog-heading">
            <div class="container">
                <h1 class="blog-hero__title" id="blog-heading">Blog</h1>
                <p class="blog-hero__lead">${description}</p>
            </div>
        </section>
        <section class="blog-list section--navy" aria-label="Blog posts">
            <div class="container">
                <div class="blog-grid">
${cards}
                </div>
${renderPagination(page, totalPages, depth)}
            </div>
        </section>
${renderFaqSection(faqsForPath('/blog/'))}
    </main>
${renderFullFooter(depth)}
${renderPageScripts(depth)}
</body>
</html>
`;
}

function renderPostPage(post, posts, depth) {
    const prefix = assetPrefix(depth);
    const index = posts.findIndex((item) => item.slug === post.slug);
    const prev = index < posts.length - 1 ? posts[index + 1] : null;
    const next = index > 0 ? posts[index - 1] : null;

    const featured = post.featuredImage
        ? `<figure class="blog-post__featured">
                <img src="${prefix}${post.featuredImage.replace(/^\//, '')}" alt="" width="1024" height="578" loading="eager">
            </figure>`
        : '';

    const nav = [];
    if (prev) {
        nav.push(`                    <a class="blog-post-nav__link blog-post-nav__link--prev" href="${prev.path}">
                        <span class="blog-post-nav__label">Previous</span>
                        <span class="blog-post-nav__title">${escapeHtml(prev.title)}</span>
                    </a>`);
    }
    if (next) {
        nav.push(`                    <a class="blog-post-nav__link blog-post-nav__link--next" href="${next.path}">
                        <span class="blog-post-nav__label">Next</span>
                        <span class="blog-post-nav__title">${escapeHtml(next.title)}</span>
                    </a>`);
    }

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.datePublished,
        dateModified: post.dateModified,
        author: { '@type': 'Person', name: post.author },
        publisher: {
            '@type': 'Organization',
            name: 'Leanne Digital',
            url: SITE,
        },
        mainEntityOfPage: `${SITE}${post.path}`,
        image: post.featuredImage ? `${SITE}${post.featuredImage}` : undefined,
    };

    return `${renderHead({
        title: `${escapeHtml(post.title)} | Leanne Digital`,
        description: escapeHtml(post.description),
        depth,
        extraCss: ['blog-post.css'],
        canonical: `${SITE}${post.path}`,
    })}
<body class="page-inner">
${renderNav(depth, '')}
    <main id="main">
        <article class="blog-post section--navy">
            <header class="blog-post__header">
                <div class="container blog-post__header-inner">
                    <p class="blog-post__category">${escapeHtml(post.category)}</p>
                    <h1 class="blog-post__title">${escapeHtml(post.title)}</h1>
                    <p class="blog-post__meta">
                        <span>${escapeHtml(post.author)}</span>
                        <time datetime="${post.datePublished}">${escapeHtml(formatDisplayDate(post.datePublished))}</time>
                    </p>
                    ${featured}
                </div>
            </header>
            <div class="container blog-post__content">
                <div class="blog-prose">
                    ${unwrapInternalLinksInHeadings(rewriteLegacyLinks(post.content))}
                </div>
                <nav class="blog-post-nav" aria-label="Post navigation">
${nav.join('\n')}
                </nav>
                <p class="blog-post__back"><a href="/blog/">← Back to Blog</a></p>
            </div>
        </article>
${renderFaqSection(faqsForPath(post.path, [
    {
        question: `What is “${post.title}” about?`,
        answer: post.excerpt || post.description || 'A practical article from the Leanne Digital blog.',
    },
    {
        question: 'Who wrote this article?',
        answer: `${post.author} at Leanne Digital, a Winnipeg digital marketing studio.`,
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
        console.error('Missing data/blog-posts.json — run: node scripts/import-blog.mjs');
        process.exit(1);
    }

    const posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);

    writePage('blog', renderBlogIndex(posts, 1, depthFromDir('blog')));

    for (let page = 2; page <= totalPages; page += 1) {
        const dir = `blog/page/${page}`;
        writePage(dir, renderBlogIndex(posts, page, depthFromDir(dir)));
    }

    for (const post of posts) {
        writePage(post.slug, renderPostPage(post, posts, 1));
    }

    console.log(`Generated blog index (${totalPages} page(s)) and ${posts.length} posts.`);
}

main();
