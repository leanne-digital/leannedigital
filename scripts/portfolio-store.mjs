import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILTER_LABELS, tagsToLabelLine } from './portfolio-filters.mjs';
import { generatePortfolio } from './generate-portfolio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data', 'portfolio-projects.json');
const IMAGE_DIR = path.join(ROOT, 'assets', 'images', 'portfolio');
const ALLOWED_TAGS = new Set(Object.keys(FILTER_LABELS));
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function readJson(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function slugify(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function uniqueSlug(base, used) {
    if (!base) {
        const error = new Error('A title or slug is required');
        error.status = 400;
        throw error;
    }
    if (!used.has(base)) return base;
    let i = 2;
    while (used.has(`${base}-${i}`)) i += 1;
    return `${base}-${i}`;
}

function cleanTags(tags) {
    const list = Array.isArray(tags) ? tags : String(tags || '').split(',');
    return [...new Set(list.map((tag) => String(tag || '').trim()).filter((tag) => ALLOWED_TAGS.has(tag)))];
}

function fail(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

export function loadProjects() {
    return readJson(DATA_FILE, []);
}

export function getProject(slug) {
    return loadProjects().find((project) => project.slug === slug) || null;
}

function saveProjects(projects) {
    writeJson(DATA_FILE, projects);
}

function publicPath(slug) {
    return `/projects/${slug}/`;
}

async function writeImage(input) {
    if (!input?.dataUrl) return null;
    const match = String(input.dataUrl).match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) fail('Upload a PNG, JPEG, WebP, or GIF image');
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length) fail('That image file was empty');
    if (buffer.length > MAX_IMAGE_BYTES) fail('Images must be 6 MB or smaller');

    const original = slugify(path.parse(String(input.filename || 'portfolio')).name) || 'portfolio';
    const stamp = Date.now().toString(36);
    let filename = `${original}-${stamp}.webp`;
    let body = buffer;
    try {
        const sharp = (await import('sharp')).default;
        body = await sharp(buffer).rotate().webp({ quality: 82 }).toBuffer();
    } catch {
        const ext = (match[1].split('/')[1] || 'png').replace('jpeg', 'jpg');
        filename = `${original}-${stamp}.${ext}`;
    }
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    fs.writeFileSync(path.join(IMAGE_DIR, filename), body);
    return `/assets/images/portfolio/${filename}`;
}

function recordFrom(input, current = null) {
    const title = String(input.title || current?.title || '').trim();
    if (!title) fail('Project title is required');
    const tags = cleanTags(input.tags ?? current?.tags);
    const featuredImage = String(input.featuredImage || current?.featuredImage || '').trim();
    return {
        ...(current || {}),
        slug: current?.slug,
        path: current?.path,
        title,
        seoTitle: String(input.seoTitle ?? current?.seoTitle ?? '').trim(),
        description: String(input.description ?? current?.description ?? '').trim(),
        tags,
        categoriesLine: tagsToLabelLine(tags),
        featuredImage,
        overview: String(input.overview ?? current?.overview ?? ''),
        websiteUrl: String(input.websiteUrl ?? current?.websiteUrl ?? '').trim(),
        hidden: Boolean(input.hidden ?? current?.hidden),
    };
}

export async function createProject(input = {}) {
    const projects = loadProjects();
    const used = new Set(projects.map((project) => project.slug));
    const slug = uniqueSlug(slugify(input.slug || input.title), used);
    const imagePath = await writeImage(input.image);
    const record = recordFrom({ ...input, featuredImage: imagePath || input.featuredImage }, null);
    record.slug = slug;
    record.path = publicPath(slug);
    if (imagePath) record.featuredImage = imagePath;
    projects.push(record);
    projects.sort((a, b) => a.title.localeCompare(b.title));
    saveProjects(projects);
    generatePortfolio();
    return getProject(slug);
}

export async function updateProject(slug, input = {}) {
    const projects = loadProjects();
    const index = projects.findIndex((project) => project.slug === slug);
    if (index < 0) fail('Project not found', 404);
    const imagePath = await writeImage(input.image);
    const record = recordFrom(
        { ...input, featuredImage: imagePath || input.featuredImage || projects[index].featuredImage },
        projects[index]
    );
    record.slug = projects[index].slug;
    record.path = projects[index].path;
    if (imagePath) record.featuredImage = imagePath;
    projects[index] = record;
    saveProjects(projects);
    generatePortfolio();
    return record;
}

export async function deleteProject(slug) {
    const current = getProject(slug);
    if (!current) fail('Project not found', 404);
    saveProjects(loadProjects().filter((project) => project.slug !== slug));
    const dir = path.join(ROOT, 'projects', slug);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    generatePortfolio();
    return current;
}
