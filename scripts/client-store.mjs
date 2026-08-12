import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTAL_FILE = path.join(ROOT, 'data', 'portal-clients.json');
const OVERLAY_FILE = path.join(ROOT, 'data', 'clients.json');

const SLUG_ALIASES = {
    'oatley-vigmond-personal-injury-firm': 'oatley-vigmond',
};

const SERVICE_DEFAULTS = {
    hosting: { label: 'LDD Hosting', cycle: 'yearly' },
    seo: { label: 'Monthly SEO', cycle: 'monthly' },
    aeo: { label: 'Technical SEO & AEO', cycle: 'monthly' },
    maintenance: { label: 'Website Maintenance & Protection', cycle: 'monthly' },
};

export function slugify(name) {
    const slug = String(name || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return SLUG_ALIASES[slug] || slug;
}

function readJson(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function uniqueSlug(base, used) {
    if (!used.has(base)) return base;
    let i = 2;
    while (used.has(`${base}-${i}`)) i += 1;
    return `${base}-${i}`;
}

function nextId(portal) {
    const ids = portal.map((row) => Number(row.id) || 0);
    return Math.max(99, ...ids) + 1;
}

function stamp() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function makeService(type, amount, cycle) {
    const defaults = SERVICE_DEFAULTS[type] || { label: type, cycle: 'monthly' };
    const service = {
        type,
        label: defaults.label,
        amount: amount == null || amount === '' ? undefined : Number(amount),
        cycle: cycle || defaults.cycle,
    };
    if (!service.amount && service.amount !== 0) delete service.amount;
    return service;
}

function servicesFromInput(input = {}) {
    const services = [...(input.services || [])];
    const add = (type, amount, cycle) => {
        if (amount == null || amount === '') return;
        const existing = services.findIndex((service) => service.type === type);
        const next = makeService(type, amount, cycle);
        if (existing >= 0) services[existing] = { ...services[existing], ...next };
        else services.push(next);
    };
    add('hosting', input.hostingAmount, input.hostingCycle || 'yearly');
    add('seo', input.seoAmount, input.seoCycle);
    add('aeo', input.aeoAmount, input.aeoCycle);
    add('maintenance', input.maintenanceAmount, input.maintenanceCycle);
    return services;
}

function mergeServices(current = [], incoming = []) {
    const map = new Map(current.map((service) => [service.type, service]));
    for (const service of incoming) {
        map.set(service.type, { ...map.get(service.type), ...service });
    }
    return [...map.values()];
}

export function loadClients() {
    const overlays = readJson(OVERLAY_FILE, []);
    const portal = readJson(PORTAL_FILE, []);
    const bySlug = new Map();

    for (const row of portal) {
        bySlug.set(row.slug, {
            ...row,
            reports: [],
            services: row.services || [],
        });
    }

    for (const overlay of overlays) {
        const current = bySlug.get(overlay.slug);
        if (!current) {
            bySlug.set(overlay.slug, {
                services: [],
                reports: [],
                ...overlay,
            });
            continue;
        }
        bySlug.set(overlay.slug, {
            ...current,
            ...overlay,
            hosting: overlay.hosting || current.hosting,
            contactName: overlay.contactName || current.contactName,
            email: overlay.email || current.email,
            website: overlay.website || current.website,
            googleDrive: overlay.googleDrive || current.googleDrive,
            bio: overlay.bio || current.bio,
            includes: overlay.includes || current.includes,
            reports: overlay.reports || current.reports || [],
            services: mergeServices(current.services, overlay.services),
        });
    }

    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getClient(slugOrId) {
    const needle = String(slugOrId);
    return (
        loadClients().find(
            (client) => client.slug === needle || String(client.id) === needle
        ) || null
    );
}

function upsertPortal(record) {
    const portal = readJson(PORTAL_FILE, []);
    const index = portal.findIndex((row) => row.slug === record.slug || row.id === record.id);
    const next = {
        id: record.id,
        slug: record.slug,
        name: record.name,
        contactName: record.contactName || null,
        email: record.email || null,
        location: record.location || null,
        website: record.website || null,
        googleDrive: record.googleDrive || null,
        platform: record.platform || 'WordPress',
        hosting: record.hosting || { type: 'External', provider: null, lddHosted: false },
        currency: record.currency || 'CAD',
        services: (record.services || []).filter((service) => service.type === 'hosting'),
        createdAt: record.createdAt || stamp(),
    };
    if (index >= 0) portal[index] = { ...portal[index], ...next };
    else portal.push(next);
    writeJson(PORTAL_FILE, portal);
}

function upsertOverlay(record) {
    const overlayServices = (record.services || []).filter((service) => service.type !== 'hosting');
    const hasOverlay =
        record.bio ||
        record.includes ||
        record.reports ||
        overlayServices.length ||
        record.googleDrive ||
        record.started;
    const overlays = readJson(OVERLAY_FILE, []);
    const index = overlays.findIndex((row) => row.slug === record.slug);
    if (!hasOverlay && index < 0) return;
    const next = {
        ...(index >= 0 ? overlays[index] : {}),
        slug: record.slug,
        name: record.name,
        currency: record.currency || 'CAD',
        services: overlayServices.length
            ? overlayServices
            : index >= 0
                ? overlays[index].services
                : [],
        reports: record.reports || (index >= 0 ? overlays[index].reports : []) || [],
    };
    if (record.bio) next.bio = record.bio;
    if (record.includes) next.includes = record.includes;
    if (record.started) next.started = record.started;
    if (record.asset) next.asset = record.asset;
    if (record.website) next.website = record.website;
    if (record.googleDrive) next.googleDrive = record.googleDrive;
    if (index >= 0) overlays[index] = next;
    else overlays.push(next);
    writeJson(OVERLAY_FILE, overlays);
}

export async function regeneratePages() {
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'generate-clients.mjs')], {
            cwd: ROOT,
            stdio: 'ignore',
        });
        child.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`generate-clients exited ${code}`));
        });
        child.on('error', reject);
    });
}

export async function createClient(input) {
    const name = String(input.name || '').trim();
    if (!name) {
        const error = new Error('name is required');
        error.status = 400;
        throw error;
    }

    const portal = readJson(PORTAL_FILE, []);
    const overlays = readJson(OVERLAY_FILE, []);
    const used = new Set([...portal, ...overlays].map((row) => row.slug));
    const slug = uniqueSlug(slugify(input.slug || name), used);
    const services = servicesFromInput(input);
    const hostingService = services.find((service) => service.type === 'hosting');
    const record = {
        id: nextId(portal),
        slug,
        name,
        contactName: input.contactName || null,
        email: input.email || null,
        location: input.location || null,
        website: input.website || null,
        googleDrive: input.googleDrive || null,
        platform: input.platform || 'WordPress',
        hosting: input.hosting || {
            type: hostingService ? 'LDD' : 'External',
            provider: hostingService ? 'LDD Self Hosting' : null,
            lddHosted: Boolean(hostingService),
        },
        currency: input.currency || 'CAD',
        services,
        bio: input.bio || '',
        started: input.started || new Date().toISOString().slice(0, 10),
        createdAt: stamp(),
    };
    upsertPortal(record);
    upsertOverlay(record);
    await regeneratePages();
    return getClient(slug);
}

export async function updateClient(slugOrId, input) {
    const current = getClient(slugOrId);
    if (!current) {
        const error = new Error('Client not found');
        error.status = 404;
        throw error;
    }
    const incomingServices = servicesFromInput(input);
    const record = {
        ...current,
        name: input.name || current.name,
        contactName: input.contactName ?? current.contactName,
        email: input.email ?? current.email,
        location: input.location ?? current.location,
        website: input.website ?? current.website,
        googleDrive: input.googleDrive ?? current.googleDrive,
        platform: input.platform || current.platform,
        hosting: input.hosting || current.hosting,
        currency: input.currency || current.currency,
        bio: input.bio ?? current.bio,
        services: incomingServices.length
            ? mergeServices(current.services, incomingServices)
            : current.services,
    };
    upsertPortal(record);
    upsertOverlay(record);
    await regeneratePages();
    return getClient(current.slug);
}

export async function deleteClient(slugOrId) {
    const current = getClient(slugOrId);
    if (!current) {
        const error = new Error('Client not found');
        error.status = 404;
        throw error;
    }
    writeJson(
        PORTAL_FILE,
        readJson(PORTAL_FILE, []).filter((row) => row.slug !== current.slug)
    );
    writeJson(
        OVERLAY_FILE,
        readJson(OVERLAY_FILE, []).filter((row) => row.slug !== current.slug)
    );
    const pageDir = path.join(ROOT, 'clients', current.slug);
    if (fs.existsSync(pageDir)) fs.rmSync(pageDir, { recursive: true, force: true });
    await regeneratePages();
    return current;
}
