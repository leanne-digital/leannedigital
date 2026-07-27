import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_PAGE_PATHS, slugFromServicePath } from './service-pages.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SERVICE_IMG_DIR = path.join(ROOT, 'assets', 'images', 'services');
const DATA_FILE = path.join(ROOT, 'data', 'service-pages.json');
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

function extractParentSections(html) {
    const mainMatch = html.match(/<main[^>]*\bid="main"[\s\S]*?<\/main>/i);
    const scope = mainMatch ? mainMatch[0] : html;
    const entryMatch = scope.match(
        /class="entry-content clear"[\s\S]*?<\/div><!-- \.entry-content \.clear -->/i
    );
    if (!entryMatch) return [];

    const entryHtml = entryMatch[0];
    const sections = [];
    const regex =
        /<div class="elementor-element elementor-element-[a-f0-9]+ e-flex e-con-boxed e-con e-parent"[\s\S]*?(?=<div class="elementor-element elementor-element-[a-f0-9]+ e-flex e-con-boxed e-con e-parent"|$)/gi;

    for (const match of entryHtml.matchAll(regex)) {
        const block = match[0].trim();
        if (/\bid="contact"/i.test(block)) continue;
        if (block.length > 80) sections.push(block);
    }

    return sections;
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
    const dest = path.join(SERVICE_IMG_DIR, filename);

    if (!fs.existsSync(dest)) {
        const response = await fetch(normalized);
        if (!response.ok) {
            console.warn(`  ! Could not download ${normalized} (${response.status})`);
            return null;
        }
        fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
    }

    const localPath = `/assets/images/services/${filename}`;
    downloadedImages.set(normalized, localPath);
    return localPath;
}

async function rewriteHtml(html) {
    let output = html;

    output = output.replace(/<span style="color:\s*#4EC3CC[^"]*">/gi, '<span class="service-accent">');
    output = output.replace(/<span style="color:\s*#4ec3cc[^"]*">/gi, '<span class="service-accent">');
    output = output.replace(/<strong style="color:\s*#4ec3cc[^"]*">/gi, '<strong class="service-accent">');
    output = output.replace(/<!--[\s\S]*?-->/g, '');

    output = output.replace(/\sclass="[^"]*"/gi, '');
    output = output.replace(/\sdata-[a-z0-9_-]+="[^"]*"/gi, '');
    output = output.replace(/\s(srcset|sizes|fetchpriority|decoding|loading|style)="[^"]*"/gi, '');
    output = output.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    output = output.replace(/<img([^>]*?)>/gi, (tag) => {
        const srcMatch = tag.match(/\ssrc="([^"]+)"/i);
        if (!srcMatch) return tag;
        return tag.replace(srcMatch[0], ` src="{{SRC:${srcMatch[1]}}}"`);
    });
    output = output.replace(/href=(["'])(\/wp-content\/uploads\/[^"']+)\1/gi, (_, quote, wpPath) => {
        const absolute = `${BASE_URL}${wpPath}`;
        return `href=${quote}{{SRC:${absolute}}}${quote}`;
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

    const wpPaths = [...new Set([...output.matchAll(/\/wp-content\/uploads\/[^\s"'<>]+/g)].map((m) => m[0]))];
    for (const wpPath of wpPaths) {
        const local = await downloadImage(`${BASE_URL}${wpPath}`);
        if (local) output = output.split(wpPath).join(local);
    }

    output = output.replace(/https:\/\/leannedigital\.com/g, '');
    output = output.replace(/href="#contact"/gi, 'href="#contact"');
    output = output.replace(/href="\/contact"/gi, 'href="/contact/"');
    output = output.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
    output = output.replace(/\s+/g, ' ');
    output = output.replace(/>\s+</g, '><');
    output = output.replace(/<p><\/p>/g, '');

    return output.trim();
}

function parseHero(sectionHtml) {
    const titleMatch = sectionHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? stripTags(titleMatch[1]) : '';
    const afterTitle = titleMatch
        ? sectionHtml.slice(sectionHtml.indexOf(titleMatch[0]) + titleMatch[0].length)
        : sectionHtml;
    const leadMatch = afterTitle.match(
        /widget-text-editor[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>\s*<\/div>/i
    );
    const lead = leadMatch ? leadMatch[1].trim() : '';

    const buttons = [...sectionHtml.matchAll(
        /elementor-button[^>]*href="([^"]+)"[\s\S]*?elementor-button-text">([^<]+)</gi
    )].map((match) => ({
        href: match[1].replace(BASE_URL, '').replace(/^\/contact$/, '/contact/'),
        text: stripTags(match[2]),
    }));

    const images = [...sectionHtml.matchAll(/<img[^>]+src="([^"]+)"/gi)]
        .map((match) => match[1])
        .filter((src) => !src.includes('teal-stars') && !src.includes('.svg'));

    return {
        title,
        lead,
        image: images.at(-1) || '',
        buttons,
    };
}

function pageTitle(html) {
    const raw = metaContent(html, 'og:title') || html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
    return raw.replace(/\s*[-|]\s*Leanne Digital\s*$/i, '').trim();
}

async function importService(servicePath) {
    const slug = slugFromServicePath(servicePath);
    const url = `${BASE_URL}${servicePath}`;
    console.log(`Importing ${slug}…`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url} (${response.status})`);
    }

    const html = await response.text();
    const sections = extractParentSections(html);
    const heroSection = sections[0] || '';
    const heroRaw = parseHero(heroSection);
    const heroImage = heroRaw.image ? await downloadImage(heroRaw.image) : '';

    const hero = {
        title: heroRaw.title || pageTitle(html),
        lead: await rewriteHtml(heroRaw.lead),
        image: heroImage,
        buttons: heroRaw.buttons,
    };

    const bodySections = [];
    for (const section of sections.slice(1)) {
        const cleaned = await rewriteHtml(section);
        if (cleaned.length > 40) bodySections.push(cleaned);
    }

    return {
        slug,
        path: servicePath,
        title: pageTitle(html),
        description: metaContent(html, 'og:description') || metaContent(html, 'description'),
        hero,
        sections: bodySections,
    };
}

async function main() {
    fs.mkdirSync(SERVICE_IMG_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

    const pages = [];
    for (const servicePath of SERVICE_PAGE_PATHS) {
        pages.push(await importService(servicePath));
    }

    fs.writeFileSync(DATA_FILE, `${JSON.stringify(pages, null, 2)}\n`, 'utf8');
    console.log(`\nImported ${pages.length} service pages → ${path.relative(ROOT, DATA_FILE)}`);
    console.log(`Downloaded ${downloadedImages.size} images → assets/images/services/`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
