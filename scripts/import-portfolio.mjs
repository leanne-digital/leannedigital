import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILTER_LABELS, tagsToLabelLine } from './portfolio-filters.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROJECT_IMG_DIR = path.join(ROOT, 'assets', 'images', 'portfolio');
const DATA_FILE = path.join(ROOT, 'data', 'portfolio-projects.json');
const SITEMAP = path.join(ROOT, '_import', 'simply-static', 'projects-sitemap.xml');
const PORTFOLIO_HTML = path.join(ROOT, '_import', 'portfolio-live.html');
const BASE_URL = 'https://leannedigital.com';

const downloadedImages = new Map();

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

function parseSlugsFromSitemap(xml) {
    return [...xml.matchAll(/<loc>\/projects\/([^/]+)\/<\/loc>/g)].map((match) => match[1]);
}

function parsePortfolioCards(html) {
    const cards = new Map();
    const blocks = html.split('data-elementor-type="loop-item"').slice(1);

    for (const block of blocks) {
        const tagsMatch = block.match(/data-tags="([^"]+)"/i);
        const slugMatch = block.match(/\/projects\/([^/"']+)\//i);
        const titleMatch = block.match(
            /<h3 class="elementor-heading-title[^"]*"><a[^>]*>([\s\S]*?)<\/a><\/h3>/i
        );
        const imageMatch = block.match(/<img[^>]+src="([^"]+)"/i);
        const categoriesMatch = block.match(/class="pf-categories-line">([^<]+)</i);

        if (!slugMatch) continue;

        const slug = slugMatch[1];
        cards.set(slug, {
            tags: tagsMatch ? tagsMatch[1].split(',').map((tag) => tag.trim()) : [],
            title: titleMatch ? stripTags(titleMatch[1]) : '',
            thumbRemote: imageMatch ? imageMatch[1] : '',
            categoriesLine: categoriesMatch ? decodeEntities(categoriesMatch[1].trim()) : '',
        });
    }

    return cards;
}

function extractTagsFromHentry(html) {
    const mainMatch = html.match(/<main[^>]*\bid="main"[\s\S]*?<\/main>/i);
    const scope = mainMatch ? mainMatch[0] : html;
    const hentry = scope.match(/\bhentry\s+([^"]+)/i) || scope.match(/class="[^"]*\bhentry\b([^"]*)"/i);
    if (!hentry) return [];

    return hentry[1]
        .trim()
        .split(/\s+/)
        .filter((token) => /^(web_design|graphic_design|industry|seo)-/.test(token));
}

function extractTitle(html) {
    const mainMatch = html.match(/<main[^>]*\bid="main"[\s\S]*?<\/main>/i);
    const scope = mainMatch ? mainMatch[0] : html;
    const h1 = scope.match(/<h1 class="elementor-heading-title[^"]*"[^>]*>(?:<a[^>]*>)?([^<]+)/i);
    if (h1) return stripTags(h1[1]);
    const title = metaContent(html, 'og:title') || html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
    return title.replace(/\s*[-|]\s*Leanne Digital\s*$/i, '').trim();
}

function extractOverview(html) {
    const mainMatch = html.match(/<main[^>]*\bid="main"[\s\S]*?<\/main>/i);
    const scope = mainMatch ? mainMatch[0] : html;
    const boilerplate = 'We create websites and graphics that are as solid behind the scenes';

    const overviewHeading = scope.match(
        /Project Overview[\s\S]*?widget-text-editor[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>\s*<\/div>\s*<div class="elementor-element[^"]* elementor-widget elementor-widget-button/i
    );
    if (overviewHeading) return overviewHeading[1].trim();

    const editors = [...scope.matchAll(
        /widget-text-editor[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>\s*<\/div>/gi
    )];

    for (const match of editors) {
        const content = match[1].trim();
        if (!content || content.includes(boilerplate)) continue;
        if (content.length > 120) return content;
    }

    return '';
}

function extractWebsiteUrl(html) {
    const mainMatch = html.match(/<main[^>]*\bid="main"[\s\S]*?<\/main>/i);
    const scope = mainMatch ? mainMatch[0] : html;
    const match =
        scope.match(
            /elementor-button[^>]*href="(https?:\/\/[^"]+)"[\s\S]*?VIEW WEBSITE/i
        ) ||
        scope.match(/VIEW WEBSITE[\s\S]*?href="(https?:\/\/[^"]+)"/i);
    return match ? match[1] : '';
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
    const dest = path.join(PROJECT_IMG_DIR, filename);

    if (!fs.existsSync(dest)) {
        const response = await fetch(normalized);
        if (!response.ok) {
            console.warn(`  ! Could not download ${normalized} (${response.status})`);
            return null;
        }
        fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
    }

    const localPath = `/assets/images/portfolio/${filename}`;
    downloadedImages.set(normalized, localPath);
    return localPath;
}

async function rewriteContentHtml(html) {
    let output = html;

    output = output.replace(/\sclass="[^"]*"/gi, '');
    output = output.replace(/\sdata-[a-z0-9_-]+="[^"]*"/gi, '');
    output = output.replace(/\s(srcset|sizes|fetchpriority|decoding|loading)="[^"]*"/gi, '');
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
    output = output.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
    output = output.replace(/\s+/g, ' ');
    output = output.replace(/>\s+</g, '><');
    output = output.replace(/<p><\/p>/g, '');

    return output.trim();
}

async function importProject(slug, card) {
    const url = `${BASE_URL}/projects/${slug}/`;
    console.log(`Importing ${slug}…`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url} (${response.status})`);
    }

    const html = await response.text();
    const title = card?.title || extractTitle(html);
    const tags = card?.tags?.length ? card.tags : extractTagsFromHentry(html);
    const description = metaContent(html, 'og:description') || metaContent(html, 'description');
    const featuredRemote =
        card?.thumbRemote ||
        metaContent(html, 'og:image') ||
        html.match(/theme-post-featured-image[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1] ||
        html.match(/widget-image[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1] ||
        '';
    const featuredImage = featuredRemote ? await downloadImage(featuredRemote) : '';
    const overview = await rewriteContentHtml(extractOverview(html));
    const websiteUrl = extractWebsiteUrl(html);
    const categoriesLine = card?.categoriesLine || tagsToLabelLine(tags);

    return {
        slug,
        path: `/projects/${slug}/`,
        title,
        description,
        tags,
        categoriesLine,
        featuredImage,
        overview,
        websiteUrl,
    };
}

async function main() {
    fs.mkdirSync(PROJECT_IMG_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

    const sitemap = fs.readFileSync(SITEMAP, 'utf8');
    const slugs = parseSlugsFromSitemap(sitemap);
    const portfolioHtml = fs.readFileSync(PORTFOLIO_HTML, 'utf8');
    const cards = parsePortfolioCards(portfolioHtml);
    const projects = [];

    for (const slug of slugs) {
        projects.push(await importProject(slug, cards.get(slug)));
    }

    projects.sort((a, b) => a.title.localeCompare(b.title));

    fs.writeFileSync(DATA_FILE, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
    console.log(`\nImported ${projects.length} projects → ${path.relative(ROOT, DATA_FILE)}`);
    console.log(`Downloaded ${downloadedImages.size} images → assets/images/portfolio/`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
