import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BLOG_IMG_DIR = path.join(ROOT, 'assets', 'images', 'blog');
const DATA_FILE = path.join(ROOT, 'data', 'blog-posts.json');
const SITEMAP = path.join(ROOT, '_import', 'simply-static-new', 'post-sitemap.xml');
const IMPORT_ROOT = path.join(ROOT, '_import', 'simply-static-new');
const BASE_URL = 'https://leannedigital.com';

const downloadedImages = new Map();

function parseSlugsFromSitemap(xml) {
    return [...xml.matchAll(/<loc>\/([^/]+)\/<\/loc>/g)]
        .map((match) => match[1])
        .filter((slug) => slug !== 'blog');
}

function decodeEntities(text) {
    return text
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, '–')
        .replace(/&#8212;/g, '—')
        .replace(/&#038;/g, '&')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
}

function stripTags(html) {
    return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function metaContent(html, property) {
    const match = html.match(
        new RegExp(`<meta\\s+(?:property|name)="${property}"\\s+content="([^"]*)"`, 'i')
    );
    return match ? decodeEntities(match[1]) : '';
}

function extractJsonLdArticle(html) {
    const match = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (!match) return null;
    try {
        const graph = JSON.parse(match[1]);
        const nodes = graph['@graph'] || [graph];
        return nodes.find((node) => node['@type'] === 'Article') || null;
    } catch {
        return null;
    }
}

function extractTitle(html) {
    const mainMatch = html.match(/<main[^>]*\bid="main"[\s\S]*?<\/main>/i);
    const scope = mainMatch ? mainMatch[0] : html;
    const h1 = scope.match(
        /elementor-widget-theme-post-title[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i
    );
    if (h1) return stripTags(h1[1]);
    const title = metaContent(html, 'og:title') || html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
    return title.replace(/\s*[-|]\s*Leanne Digital\s*$/i, '').trim();
}

function extractCategory(html, article) {
    if (article?.articleSection) {
        const section = article.articleSection;
        if (typeof section === 'string') return section;
        const values = Object.values(section);
        if (values.length) return values[0];
    }
    const classes = html.match(/class="[^"]*category-([a-z0-9-]+)/i);
    if (!classes) return 'Blog';
    const slug = classes[1];
    if (slug === 'uncategorized') return 'Blog';
    return slug
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function extractBalancedDivInner(html, openDivIndex) {
    const gt = html.indexOf('>', openDivIndex);
    if (gt < 0) return '';
    let i = gt + 1;
    let depth = 1;
    const lower = html.toLowerCase();
    while (i < html.length && depth > 0) {
        const nextOpen = lower.indexOf('<div', i);
        const nextClose = lower.indexOf('</div>', i);
        if (nextClose < 0) return html.slice(gt + 1).trim();
        if (nextOpen !== -1 && nextOpen < nextClose) {
            const after = html[nextOpen + 4];
            if (after === ' ' || after === '>' || after === '\n' || after === '\t' || after === '/') {
                depth += 1;
            }
            i = nextOpen + 4;
            continue;
        }
        depth -= 1;
        if (depth === 0) return html.slice(gt + 1, nextClose).trim();
        i = nextClose + 6;
    }
    return html.slice(gt + 1).trim();
}

function extractContent(html) {
    const mainMatch = html.match(/<main\b[^>]*>[\s\S]*<\/main>/i);
    const scope = mainMatch ? mainMatch[0] : html;
    const markerIndex = scope.search(/data-widget_type="theme-post-content\.default"/i);
    if (markerIndex >= 0) {
        const container = scope.indexOf('elementor-widget-container', markerIndex);
        if (container >= 0) {
            const divStart = scope.lastIndexOf('<div', container);
            const inner = extractBalancedDivInner(scope, divStart);
            if (inner.length > 40) return inner;
        }
    }

    const entryIndex = scope.search(/<div[^>]*class="[^"]*entry-content[^"]*"/i);
    if (entryIndex >= 0) {
        const inner = extractBalancedDivInner(scope, entryIndex);
        if (inner.length > 40) return inner;
    }
    return '';
}

function flattenPostHtml(html) {
    const blocks = [];
    const pattern =
        /<ul\b[^>]*>[\s\S]*?<\/ul>|<ol\b[^>]*>[\s\S]*?<\/ol>|<blockquote\b[^>]*>[\s\S]*?<\/blockquote>|<figure\b[^>]*>[\s\S]*?<\/figure>|<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>|<p\b[^>]*>[\s\S]*?<\/p>|<img\b[^>]*>|<hr\s*\/?>/gi;
    let match;
    while ((match = pattern.exec(html))) {
        blocks.push(match[0]);
    }
    return blocks.join('');
}

function imageBasename(url) {
    const absolute = url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    return path.basename(new URL(absolute).pathname);
}

function localizeUploadPath(url) {
    const cleaned = String(url || '').split('?')[0].replace(/^https?:\/\/leannedigital\.com/i, '');
    if (!cleaned.startsWith('/wp-content/uploads/')) return null;
    const filename = path.basename(cleaned);
    const from = path.join(IMPORT_ROOT, cleaned.replace(/^\//, '').replaceAll('/', path.sep));
    const dest = path.join(BLOG_IMG_DIR, filename);
    if (fs.existsSync(from) && !fs.existsSync(dest)) {
        fs.copyFileSync(from, dest);
    }
    return `/assets/images/blog/${filename}`;
}

async function downloadImage(url) {
    const absolute = url.startsWith('http')
        ? url.split('?')[0]
        : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url.split('?')[0]}`;
    if (downloadedImages.has(absolute)) {
        return downloadedImages.get(absolute);
    }

    const localCopy = localizeUploadPath(absolute);
    if (localCopy && fs.existsSync(path.join(ROOT, localCopy.replace(/^\//, '')))) {
        downloadedImages.set(absolute, localCopy);
        return localCopy;
    }

    const filename = imageBasename(absolute);
    const dest = path.join(BLOG_IMG_DIR, filename);

    if (!fs.existsSync(dest)) {
        try {
            const response = await fetch(absolute);
            if (!response.ok) {
                console.warn(`  ! Could not download ${absolute} (${response.status})`);
                return localCopy;
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(dest, buffer);
        } catch {
            console.warn(`  ! Could not download ${absolute}`);
            return localCopy;
        }
    }

    const localPath = `/assets/images/blog/${filename}`;
    downloadedImages.set(absolute, localPath);
    return localPath;
}

async function rewriteContentHtml(html) {
    let output = flattenPostHtml(html);
    if (!output) output = html;

    output = output.replace(/\sclass="[^"]*"/gi, '');
    output = output.replace(/\sdata-[a-z0-9_-]+="[^"]*"/gi, '');
    output = output.replace(/\s(srcset|sizes|fetchpriority|decoding|loading|itemprop|role|tabindex|aria-[a-z-]+)="[^"]*"/gi, '');
    output = output.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    output = output.replace(/<figure[^>]*>/gi, '<figure>');
    output = output.replace(/<img([^>]*?)>/gi, (tag) => {
        const srcMatch = tag.match(/\ssrc="([^"]+)"/i);
        if (!srcMatch) return tag;
        return tag.replace(srcMatch[0], ` src="{{SRC:${srcMatch[1]}}}"`);
    });

    const srcMatches = [...output.matchAll(/\{\{SRC:([^}]+)\}\}/g)];
    for (const match of srcMatches) {
        const original = match[1];
        const absolute = original.startsWith('http')
            ? original
            : `${BASE_URL}${original.startsWith('/') ? '' : '/'}${original}`;
        const local = await downloadImage(absolute);
        output = output.replace(match[0], local || absolute.replace(BASE_URL, ''));
    }

    output = output.replace(/https:\/\/leannedigital\.com/g, '');
    output = output.replace(/href="\/\/leannedigital\.com/g, 'href="');
    output = output.replace(/\/wp-content\/uploads\/[^"']+/g, (match) => {
        const filename = path.basename(match);
        return `/assets/images/blog/${filename}`;
    });

    output = output.replace(/<a>\s*/g, '<a href="#">');
    output = output.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
    output = output.replace(/\s+/g, ' ');
    output = output.replace(/>\s+</g, '><');
    output = output.replace(/<p><\/p>/g, '');

    return output.trim();
}

function buildExcerpt(contentHtml, description, maxLength = 180) {
    const text = stripTags(contentHtml);
    const source = text || description || '';
    if (source.length <= maxLength) return source;
    return `${source.slice(0, maxLength).replace(/\s+\S*$/, '')}…`;
}

async function importPost(slug) {
    const localFile = path.join(IMPORT_ROOT, slug, 'index.html');
    console.log(`Importing ${slug}…`);
    if (!fs.existsSync(localFile)) {
        throw new Error(`Missing Simply Static export: ${localFile}`);
    }
    const html = fs.readFileSync(localFile, 'utf8');
    const article = extractJsonLdArticle(html);
    const title = extractTitle(html);
    const description = metaContent(html, 'og:description') || metaContent(html, 'description');
    const rawContent = extractContent(html);
    const content = await rewriteContentHtml(rawContent);
    const featuredRemote =
        metaContent(html, 'og:image') ||
        html.match(/theme-post-featured-image[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1] ||
        '';
    const featuredImage = featuredRemote ? await downloadImage(featuredRemote) : '';

    const datePublished = article?.datePublished || '';
    const dateModified = article?.dateModified || datePublished;
    const category = extractCategory(html, article);
    const excerpt = buildExcerpt(content, description);

    return {
        slug,
        path: `/${slug}/`,
        title,
        description,
        excerpt,
        category,
        datePublished,
        dateModified,
        dateDisplay: datePublished
            ? new Date(datePublished).toLocaleDateString('en-CA', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
              })
            : '',
        featuredImage,
        content,
        author: article?.author?.name || 'Leanne Jones',
    };
}

async function main() {
    fs.mkdirSync(BLOG_IMG_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

    const sitemap = fs.readFileSync(SITEMAP, 'utf8');
    const slugs = parseSlugsFromSitemap(sitemap);
    const posts = [];

    for (const slug of slugs) {
        posts.push(await importPost(slug));
    }

    posts.sort((a, b) => new Date(b.datePublished) - new Date(a.datePublished));

    fs.writeFileSync(DATA_FILE, `${JSON.stringify(posts, null, 2)}\n`, 'utf8');
    console.log(`\nImported ${posts.length} posts → ${path.relative(ROOT, DATA_FILE)}`);
    console.log(`Downloaded ${downloadedImages.size} images → assets/images/blog/`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
