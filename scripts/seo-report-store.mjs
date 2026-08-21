import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getClient, regeneratePages, slugify, upsertClientReport } from './client-store.mjs';
import { asParagraphs, renderSeoReportBody } from './seo-report-template.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS_DIR = path.join(ROOT, 'data', 'client-reports');
const ASSET_DIR = path.join(ROOT, 'assets', 'clients');
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

function fail(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function jsonPath(clientSlug, reportSlug) {
    return path.join(REPORTS_DIR, clientSlug, `${reportSlug}.json`);
}

export function monthParts(monthKey) {
    const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const monthIndex = Number(match[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) return null;
    return { year: match[1], monthIndex, monthName: MONTHS[monthIndex] };
}

export function monthLabelFromKey(monthKey) {
    const parts = monthParts(monthKey);
    if (!parts) return String(monthKey || '');
    return `${parts.monthName.toUpperCase()} ${parts.year}`;
}

export function titleFromMonthKey(monthKey) {
    const parts = monthParts(monthKey);
    if (!parts) return String(monthKey || 'SEO report');
    return `${parts.monthName} ${parts.year}`;
}

export function reportSlugFor(clientSlug, monthKey) {
    const parts = monthParts(monthKey);
    if (!parts) fail('Choose a month and year for this report');
    return `seo-report-${clientSlug}-${parts.monthName.toLowerCase()}-${parts.year}`;
}

export function loadReportRecord(clientSlug, reportSlug) {
    const file = jsonPath(clientSlug, reportSlug);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function listStructuredReports(clientSlug) {
    const dir = path.join(REPORTS_DIR, clientSlug);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            try {
                return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .sort((a, b) => String(b.monthKey || '').localeCompare(String(a.monthKey || '')));
}

export function previousReport(clientSlug, monthKey) {
    return listStructuredReports(clientSlug).find((row) => String(row.monthKey || '') < String(monthKey || '')) || null;
}

async function writeImage(clientSlug, input, fallbackName) {
    if (!input?.dataUrl) return '';
    const match = String(input.dataUrl).match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) fail('Upload a PNG, JPEG, WebP, or GIF screenshot');
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length) fail('That screenshot was empty');
    if (buffer.length > MAX_IMAGE_BYTES) fail('Screenshots must be 6 MB or smaller');
    const original = slugify(path.parse(String(input.filename || fallbackName)).name) || fallbackName;
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
    const dir = path.join(ASSET_DIR, clientSlug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), body);
    return `/assets/clients/${clientSlug}/${filename}`;
}

async function writePdf(clientSlug, input, fallbackName) {
    if (!input?.dataUrl) return '';
    const match = String(input.dataUrl).match(/^data:(application\/pdf|application\/octet-stream);base64,([A-Za-z0-9+/=\s]+)$/i);
    const filenameHint = String(input.filename || '');
    if (!match || (match[1].toLowerCase() === 'application/octet-stream' && !/\.pdf$/i.test(filenameHint))) {
        fail('Upload the Ubersuggest keyword report as a PDF');
    }
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length) fail('That PDF was empty');
    if (buffer.length > MAX_PDF_BYTES) fail('PDFs must be 12 MB or smaller');
    const original = slugify(path.parse(filenameHint || fallbackName).name) || fallbackName;
    const filename = `${original}-${Date.now().toString(36)}.pdf`;
    const dir = path.join(ASSET_DIR, clientSlug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), buffer);
    return `/assets/clients/${clientSlug}/${filename}`;
}

function cleanLog(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((row) => ({
            date: String(row?.date || '').slice(0, 10),
            keyword: String(row?.keyword || '').trim(),
            source: String(row?.source || '').trim(),
            target: String(row?.target || 'Page').trim() || 'Page',
            linksAdded: String(row?.linksAdded ?? row?.notes ?? '').trim(),
        }))
        .filter((row) => row.date || row.keyword || row.source || row.linksAdded);
}

function companyNameFor(client) {
    return String(client.name || '')
        .replace(/\bLtd\.?$/i, 'LTD.')
        .replace(/\bInc\.?$/i, 'INC.')
        .toUpperCase();
}

function buildRecord(client, input, current, previous, assets) {
    const monthKey = String(input.monthKey || current?.monthKey || '').slice(0, 7);
    if (!monthParts(monthKey)) fail('Choose a month and year for this report');
    const slug = current?.slug || reportSlugFor(client.slug, monthKey);
    const title = titleFromMonthKey(monthKey);
    const monthLabel = monthLabelFromKey(monthKey);
    const pdfHref = assets.keywordPdf || current?.keywordPdf?.href || current?.keywords?.pdf?.href || '';
    const pdfLabel = `Download ${monthLabel} keyword report`;
    const adsEnabled = input.hasGoogleAds == null ? current?.googleAds?.enabled !== false : Boolean(input.hasGoogleAds);
    return {
        slug,
        kind: 'seo',
        monthKey,
        title,
        monthLabel,
        companyName: String(input.companyName || current?.companyName || companyNameFor(client)).trim(),
        clientName: client.name,
        campaignIntro: asParagraphs(
            String(input.campaignIntro ?? '').trim()
                ? input.campaignIntro
                : current?.campaignIntro || previous?.campaignIntro || ''
        ),
        keywordPdf: pdfHref ? { href: pdfHref, label: pdfLabel } : null,
        monthlyRecap: asParagraphs(input.monthlyRecap ?? current?.monthlyRecap ?? ''),
        technicalSeo: {
            lastMonthImage:
                assets.techLastMonth ||
                current?.technicalSeo?.lastMonthImage ||
                previous?.technicalSeo?.thisMonthImage ||
                '',
            thisMonthImage: assets.techThisMonth || current?.technicalSeo?.thisMonthImage || '',
            recap: asParagraphs(input.technicalRecap ?? current?.technicalSeo?.recap ?? ''),
            internalLinks: cleanLog(input.internalLinks ?? current?.technicalSeo?.internalLinks),
        },
        keywords: {
            thisMonthImage: assets.keywordsThisMonth || current?.keywords?.thisMonthImage || '',
            lastMonthImage:
                assets.keywordsLastMonth ||
                current?.keywords?.lastMonthImage ||
                previous?.keywords?.thisMonthImage ||
                '',
            twoMonthsAgoImage:
                assets.keywordsTwoMonthsAgo ||
                current?.keywords?.twoMonthsAgoImage ||
                previous?.keywords?.lastMonthImage ||
                '',
            recap: asParagraphs(input.keywordsRecap ?? current?.keywords?.recap ?? ''),
            pdf: pdfHref ? { href: pdfHref, label: pdfLabel } : null,
        },
        newContent: {
            log: cleanLog(input.contentLog ?? current?.newContent?.log),
            recap: asParagraphs(input.contentRecap ?? current?.newContent?.recap ?? ''),
        },
        googleAds: {
            enabled: adsEnabled,
            na: !adsEnabled,
            image: adsEnabled ? assets.adsImage || current?.googleAds?.image || '' : '',
            recap: adsEnabled ? asParagraphs(input.adsRecap ?? current?.googleAds?.recap ?? '') : [],
        },
        nextSteps: asParagraphs(input.nextSteps ?? current?.nextSteps ?? ''),
        updatedAt: new Date().toISOString(),
    };
}

export async function saveSeoReport(clientSlug, input = {}) {
    const client = getClient(clientSlug);
    if (!client) fail('Client not found', 404);
    const monthKey = String(input.monthKey || '').slice(0, 7);
    const slug = String(input.slug || '').trim() || reportSlugFor(client.slug, monthKey);
    const current = loadReportRecord(client.slug, slug);
    const previous = previousReport(client.slug, monthKey || current?.monthKey);
    const assets = {
        techThisMonth: await writeImage(client.slug, input.techThisMonth, `${slug}-tech`),
        keywordsThisMonth: await writeImage(client.slug, input.keywordsThisMonth, `${slug}-keywords`),
        adsImage: await writeImage(client.slug, input.adsImage, `${slug}-ads`),
        keywordPdf: await writePdf(client.slug, input.keywordPdf, `${slug}-keywords`),
        techLastMonth: await writeImage(client.slug, input.techLastMonth, `${slug}-tech-last`),
        keywordsLastMonth: await writeImage(client.slug, input.keywordsLastMonth, `${slug}-keywords-last`),
        keywordsTwoMonthsAgo: await writeImage(client.slug, input.keywordsTwoMonthsAgo, `${slug}-keywords-older`),
    };
    const record = buildRecord(client, { ...input, monthKey: monthKey || current?.monthKey }, current, previous, assets);
    writeJson(jsonPath(client.slug, record.slug), record);
    upsertClientReport(client.slug, {
        slug: record.slug,
        title: record.title,
        monthKey: record.monthKey,
        kind: 'seo',
    });
    await regeneratePages();
    return record;
}

export { renderSeoReportBody };
