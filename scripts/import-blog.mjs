import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BLOG_IMG_DIR = path.join(ROOT, 'assets', 'images', 'blog');
const DATA_FILE = path.join(ROOT, 'data', 'blog-posts.json');
const SITEMAP = path.join(ROOT, '_import', 'simply-static', 'post-sitemap.xml');
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

function extractContent(html) {
    const mainMatch = html.match(/<main[^>]*\bid="main"[\s\S]*?<\/main>/i);
    const scope = mainMatch ? mainMatch[0] : html;

    const match = scope.match(
        /elementor-widget-theme-post-content[^>]*data-widget_type="theme-post-content\.default"[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>\s*<\/div>/i
    );
    return match ? match[1].trim() : '';
}

function imageBasename(url) {
    const pathname = new URL(url).pathname;
    return path.basename(pathname);
}

async function downloadImage(url) {
    const normalized = url.split('?')[0];
    if (downloadedImages.has(normalized)) {
        return downloadedImages.get(normalized);
    }

    const filename = imageBasename(normalized);
    const dest = path.join(BLOG_IMG_DIR, filename);

    if (!fs.existsSync(dest)) {
        const response = await fetch(normalized);
        if (!response.ok) {
            console.warn(`  ! Could not download ${normalized} (${response.status})`);
            return null;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(dest, buffer);
    }

    const localPath = `/assets/images/blog/${filename}`;
    downloadedImages.set(normalized, localPath);
    return localPath;
}

async function rewriteContentHtml(html) {
    let output = html;

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

    output = output.replace(/<h3/g, '<h2');
    output = output.replace(/<\/h3>/g, '</h2>');
    output = output.replace(/<h4/g, '<h3');
    output = output.replace(/<\/h4>/g, '</h3>');
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
    const url = `${BASE_URL}/${slug}/`;
    console.log(`Importing ${slug}…`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url} (${response.status})`);
    }
    const html = await response.text();
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
    const excerpt = buildExcerpt(rawContent, description);

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
