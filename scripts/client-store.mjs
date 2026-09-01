import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isLddProvider } from './portal-options.mjs';

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
    management: { label: 'Static site management', cycle: 'monthly' },
    website: { label: 'Web development', cycle: 'monthly' },
    development: { label: 'Web development', cycle: 'monthly' },
    design: { label: 'Graphic design', cycle: 'monthly' },
    updates: { label: 'Site updates', cycle: 'monthly' },
    ads: { label: 'Paid ads management', cycle: 'monthly' },
    integrations: { label: 'Integrations', cycle: 'monthly' },
    automations: { label: 'Automations', cycle: 'monthly' },
    'project-management': { label: 'Project management', cycle: 'monthly' },
};

export const ADMIN_SERVICE_TYPES = [
    'website',
    'development',
    'maintenance',
    'hosting',
    'design',
    'management',
    'updates',
    'ads',
    'integrations',
    'automations',
    'project-management',
];

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

export function normalizeCredentials(input) {
    const list = Array.isArray(input) ? input : [];
    return list
        .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const kind = ['hosting', 'domain', 'email', 'app'].includes(row.kind) ? row.kind : 'app';
            const label = String(row.label || '').trim();
            const url = String(row.url || '').trim();
            const username = String(row.username || '').trim();
            const password = String(row.password || '');
            const notes = String(row.notes || '').trim();
            if (!label && !url && !username && !password && !notes) return null;
            return { kind, label, url, username, password, notes };
        })
        .filter(Boolean);
}

export function normalizeClientApps(input) {
    const list = Array.isArray(input) ? input : [];
    return list
        .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const label = String(row.label || '').trim();
            const url = String(row.url || '').trim();
            const username = String(row.username || '').trim();
            const password = String(row.password || '');
            const notes = String(row.notes || '').trim();
            if (!label && !url && !username && !password && !notes) return null;
            return {
                id: String(row.id || '').trim() || `app-${randomBytes(6).toString('hex')}`,
                label: label || 'Other service',
                url,
                username,
                password,
                notes,
            };
        })
        .filter(Boolean);
}

export function normalizeOnboarding(input = {}, current = {}) {
    const src = input && typeof input === 'object' ? input : {};
    const prev = current && typeof current === 'object' ? current : {};
    const servicesNeeded = Array.isArray(src.servicesNeeded)
        ? src.servicesNeeded.map((item) => String(item).trim()).filter(Boolean)
        : prev.servicesNeeded || [];
    const socialsIn = src.socials && typeof src.socials === 'object' ? src.socials : {};
    const socialsPrev = prev.socials && typeof prev.socials === 'object' ? prev.socials : {};
    const completedAt =
        src.completedAt === null
            ? null
            : src.completedAt || prev.completedAt || null;
    return {
        completedAt,
        goals: String(src.goals ?? prev.goals ?? '').trim(),
        notes: String(src.notes ?? prev.notes ?? '').trim(),
        preferredContact: String(src.preferredContact ?? prev.preferredContact ?? 'email').trim() || 'email',
        googleAnalytics: String(src.googleAnalytics ?? prev.googleAnalytics ?? '').trim(),
        searchConsole: String(src.searchConsole ?? prev.searchConsole ?? '').trim(),
        servicesNeeded,
        socials: {
            facebook: String(socialsIn.facebook ?? socialsPrev.facebook ?? '').trim(),
            instagram: String(socialsIn.instagram ?? socialsPrev.instagram ?? '').trim(),
            linkedin: String(socialsIn.linkedin ?? socialsPrev.linkedin ?? '').trim(),
            googleBusiness: String(socialsIn.googleBusiness ?? socialsPrev.googleBusiness ?? '').trim(),
        },
    };
}

export function hostingFromProvider(provider, current = {}) {
    const name = String(provider || '').trim();
    const ldd = isLddProvider(name);
    return {
        type: ldd ? 'LDD' : current.type || 'External',
        provider: name || current.provider || null,
        lddHosted: ldd || Boolean(current.lddHosted),
    };
}

function moneyField(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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

function servicesFromInput(input = {}, current = []) {
    const services = [...(input.services || current)];
    const add = (type, amount, cycle) => {
        if (amount == null) return;
        const existing = services.findIndex((service) => service.type === type);
        if (amount === '' || Number(amount) === 0) {
            if (existing >= 0) services.splice(existing, 1);
            return;
        }
        const next = makeService(type, amount, cycle);
        if (existing >= 0) services[existing] = { ...services[existing], ...next };
        else services.push(next);
    };
    add('hosting', input.hostingAmount, input.hostingCycle || 'yearly');
    add('seo', input.seoAmount, input.seoCycle);
    add('aeo', input.aeoAmount, input.aeoCycle);
    add('maintenance', input.maintenanceAmount, input.maintenanceCycle);
    add('management', input.managementAmount, input.managementCycle || 'monthly');
    if (Array.isArray(input.serviceTypes)) {
        const wanted = new Set(
            input.serviceTypes
                .map((type) => String(type || '').trim().toLowerCase())
                .filter(Boolean)
                .map((type) => {
                    if (type === 'web-development') return 'website';
                    if (type === 'graphic-design') return 'design';
                    if (type === 'site-updates') return 'updates';
                    if (type === 'google-ads' || type === 'paid-ads') return 'ads';
                    return type;
                })
        );
        for (const type of wanted) {
            if (!services.some((service) => service.type === type)) services.push(makeService(type));
        }
        const dated = services.filter((service) => {
            if (!ADMIN_SERVICE_TYPES.includes(service.type) && !['seo', 'aeo'].includes(service.type)) return true;
            if (wanted.has(service.type)) return true;
            return Number(service.amount) > 0;
        });
        applyServiceDates(dated, 'hosting', input, 'hostingLastBilled', 'hostingNextBillDate');
        applyServiceDates(dated, 'seo', input, 'seoLastBilled', 'seoNextBillDate');
        applyServiceDates(dated, 'aeo', input, 'aeoLastBilled', 'aeoNextBillDate');
        applyServiceDates(dated, 'maintenance', input, 'maintenanceLastBilled', 'maintenanceNextBillDate');
        applyServiceDates(dated, 'management', input, 'managementLastBilled', 'managementNextBillDate');
        return dated;
    }
    applyServiceDates(services, 'hosting', input, 'hostingLastBilled', 'hostingNextBillDate');
    return services;
}

function applyServiceDates(services, type, input, lastKey, nextKey) {
    const row = services.find((service) => service.type === type);
    if (!row) return;
    if (lastKey in input) {
        if (input[lastKey]) row.lastBilled = input[lastKey];
        else delete row.lastBilled;
    }
    if (nextKey in input) {
        if (input[nextKey]) row.nextBillDate = input[nextKey];
        else delete row.nextBillDate;
    }
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
            phone: overlay.phone || current.phone,
            website: overlay.website || current.website,
            googleDrive: overlay.googleDrive || current.googleDrive,
            bio: overlay.bio || current.bio,
            includes: overlay.includes || current.includes,
            reports: overlay.reports || current.reports || [],
            services: mergeServices(current.services, overlay.services),
            credentials: overlay.credentials || current.credentials || [],
            clientApps: overlay.clientApps || current.clientApps || [],
            domainProvider: overlay.domainProvider || current.domainProvider,
            emailProvider: overlay.emailProvider || current.emailProvider,
            onboarding: overlay.onboarding || current.onboarding,
            discount: overlay.discount ?? current.discount ?? 0,
            taxAmount: overlay.taxAmount ?? current.taxAmount ?? 0,
        });
    }

    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function upsertClientReport(slug, report) {
    const current = getClient(slug);
    if (!current) {
        const error = new Error('Client not found');
        error.status = 404;
        throw error;
    }
    const reports = [...(current.reports || [])];
    const meta = {
        slug: String(report.slug || '').trim(),
        title: String(report.title || '').trim(),
        monthKey: String(report.monthKey || '').slice(0, 7),
        kind: report.kind || 'seo',
    };
    if (!meta.slug || !meta.title) {
        const error = new Error('Report slug and title are required');
        error.status = 400;
        throw error;
    }
    const index = reports.findIndex((row) => row.slug === meta.slug);
    if (index >= 0) reports[index] = { ...reports[index], ...meta };
    else reports.unshift(meta);
    reports.sort((a, b) => String(b.monthKey || b.slug || '').localeCompare(String(a.monthKey || a.slug || '')));
    upsertOverlay({ ...current, reports });
    return getClient(slug);
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
        phone: record.phone || null,
        location: record.location || null,
        website: record.website || null,
        googleDrive: record.googleDrive || null,
        platform: record.platform || 'WordPress',
        domainProvider: record.domainProvider || null,
        emailProvider: record.emailProvider || null,
        hosting: record.hosting || { type: 'External', provider: null, lddHosted: false },
        currency: record.currency || 'CAD',
        services: record.services || [],
        credentials: record.credentials || [],
        clientApps: record.clientApps || [],
        onboarding: record.onboarding || null,
        discount: Number(record.discount) || 0,
        taxAmount: Number(record.taxAmount) || 0,
        archivedAt: record.archivedAt || null,
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
        (record.credentials || []).length ||
        record.discount ||
        record.taxAmount ||
        record.googleDrive ||
        record.started;
    const overlays = readJson(OVERLAY_FILE, []);
    const index = overlays.findIndex((row) => row.slug === record.slug);
    if (!hasOverlay && index < 0) return;
    if (!hasOverlay && index >= 0 && !overlayServices.length) {
        overlays[index] = { ...overlays[index], services: [] };
        writeJson(OVERLAY_FILE, overlays);
        return;
    }
    const next = {
        ...(index >= 0 ? overlays[index] : {}),
        slug: record.slug,
        name: record.name,
        currency: record.currency || 'CAD',
        services: overlayServices,
        credentials: record.credentials || (index >= 0 ? overlays[index].credentials : []) || [],
        discount: Number(record.discount) || 0,
        taxAmount: Number(record.taxAmount) || 0,
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
        phone: input.phone || null,
        location: input.location || null,
        website: input.website || null,
        googleDrive: input.googleDrive || null,
        platform: input.platform || 'WordPress',
        domainProvider: input.domainProvider || null,
        emailProvider: input.emailProvider || null,
        hosting: input.hosting || {
            type: hostingService ? 'LDD' : 'External',
            provider: hostingService ? 'LDD Self Hosting' : input.hostingProvider || null,
            lddHosted: Boolean(hostingService),
        },
        currency: input.currency || 'CAD',
        services,
        credentials: normalizeCredentials(input.credentials),
        clientApps: normalizeClientApps(input.clientApps),
        onboarding: normalizeOnboarding(input.onboarding),
        discount: moneyField(input.discount, 0),
        taxAmount: moneyField(input.taxAmount, 0),
        bio: input.bio || '',
        started: input.started || new Date().toISOString().slice(0, 10),
        createdAt: stamp(),
    };
    upsertPortal(record);
    upsertOverlay(record);
    await regeneratePages();
    return getClient(slug);
}

export async function updateClient(slugOrId, input, { regenerate = true } = {}) {
    const current = getClient(slugOrId);
    if (!current) {
        const error = new Error('Client not found');
        error.status = 404;
        throw error;
    }
    const incomingServices = servicesFromInput(input, current.services);
    const record = {
        ...current,
        name: input.name || current.name,
        contactName: input.contactName ?? current.contactName,
        email: input.email ?? current.email,
        phone: 'phone' in input ? input.phone || null : current.phone,
        location: input.location ?? current.location,
        website: input.website ?? current.website,
        googleDrive: input.googleDrive ?? current.googleDrive,
        platform: input.platform || current.platform,
        domainProvider: 'domainProvider' in input ? input.domainProvider || null : current.domainProvider,
        emailProvider: 'emailProvider' in input ? input.emailProvider || null : current.emailProvider,
        hosting: input.hosting
            ? input.hosting
            : input.hostingProvider
              ? hostingFromProvider(input.hostingProvider, current.hosting)
              : current.hosting,
        currency: input.currency || current.currency,
        bio: input.bio ?? current.bio,
        services: incomingServices,
        credentials: 'credentials' in input ? normalizeCredentials(input.credentials) : current.credentials || [],
        clientApps: 'clientApps' in input ? normalizeClientApps(input.clientApps) : current.clientApps || [],
        onboarding: 'onboarding' in input ? normalizeOnboarding(input.onboarding, current.onboarding) : current.onboarding,
        discount: 'discount' in input ? moneyField(input.discount, 0) : Number(current.discount) || 0,
        taxAmount: 'taxAmount' in input ? moneyField(input.taxAmount, 0) : Number(current.taxAmount) || 0,
        archivedAt: 'archivedAt' in input ? input.archivedAt || null : current.archivedAt || null,
    };
    upsertPortal(record);
    upsertOverlay(record);
    if (regenerate) await regeneratePages();
    return getClient(current.slug);
}

export async function updateClientPortalProfile(slugOrId, input) {
    return updateClient(slugOrId, input, { regenerate: false });
}

export async function archiveClient(slugOrId) {
    return updateClient(slugOrId, { archivedAt: new Date().toISOString() }, { regenerate: false });
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
