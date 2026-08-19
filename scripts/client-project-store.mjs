import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getClient, loadClients } from './client-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECTS_FILE = path.join(ROOT, 'data', 'client-projects.json');
const UPDATES_FILE = path.join(ROOT, 'data', 'client-project-updates.json');

export const PROJECT_STATUSES = ['active', 'paused', 'completed', 'cancelled'];
export const SERVICE_TYPES = [
    'seo',
    'aeo',
    'website',
    'hosting',
    'maintenance',
    'management',
    'google-ads',
    'development',
    'design',
    'custom',
];

function readJson(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stamp() {
    return new Date().toISOString();
}

function fail(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

function nextId(rows) {
    return Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1;
}

function money(value, fallback = 0) {
    if (value == null || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeServiceType(value) {
    const raw = String(value || 'custom').trim().toLowerCase().replace(/\s+/g, '-');
    if (raw === 'google_ads' || raw === 'ads') return 'google-ads';
    if (raw === 'web' || raw === 'web-design' || raw === 'web-development') return 'website';
    if (raw === 'graphic-design' || raw === 'graphic') return 'design';
    return raw || 'custom';
}

function normalizeStatus(value, fallback = 'active') {
    const status = String(value || fallback).trim().toLowerCase();
    if (!PROJECT_STATUSES.includes(status)) fail(`Status must be ${PROJECT_STATUSES.join(', ')}`);
    return status;
}

function monthlyEquivalent(fee, frequency) {
    const amount = money(fee, 0);
    return frequency === 'yearly' ? Math.round((amount / 12) * 100) / 100 : amount;
}

function defaultName(client, serviceType) {
    const labels = {
        seo: 'SEO',
        aeo: 'Technical SEO/AEO',
        website: 'Web development',
        hosting: 'Hosting',
        maintenance: 'Site maintenance',
        management: 'Site management',
        'google-ads': 'Google Ads',
        development: 'Web development',
        design: 'Graphic design',
        custom: 'Project',
    };
    return `${client.name} — ${labels[serviceType] || serviceType}`;
}

export function loadClientProjects() {
    return readJson(PROJECTS_FILE, []);
}

export function loadProjectUpdates() {
    return readJson(UPDATES_FILE, []);
}

function saveProjects(projects) {
    writeJson(PROJECTS_FILE, projects);
}

function saveUpdates(updates) {
    writeJson(UPDATES_FILE, updates);
}

export function getClientProject(id) {
    return loadClientProjects().find((row) => String(row.id) === String(id)) || null;
}

export function updatesForProject(projectId) {
    return loadProjectUpdates()
        .filter((row) => String(row.projectId) === String(projectId))
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function resolveClient(input) {
    const needle = input.clientId || input.clientSlug || input.client || input.slug;
    if (!needle) fail('clientId or clientSlug is required');
    const client = getClient(needle);
    if (!client) fail('Client not found', 404);
    return client;
}

function toRecord(input, current = null) {
    const client = current
        ? getClient(current.clientSlug) || getClient(current.clientId) || resolveClient(input)
        : resolveClient(input);
    const serviceType = normalizeServiceType(input.serviceType ?? current?.serviceType);
    const billingFrequency =
        String(input.billingFrequency ?? current?.billingFrequency ?? 'monthly').toLowerCase() === 'yearly'
            ? 'yearly'
            : 'monthly';
    const fee = money(input.fee ?? input.monthlyFee ?? current?.fee, current?.fee || 0);
    const status = normalizeStatus(input.status ?? current?.status, 'active');
    return {
        id: current?.id,
        clientId: client.id ?? current?.clientId ?? client.slug,
        clientSlug: client.slug,
        clientName: client.name,
        name: String(input.name || current?.name || defaultName(client, serviceType)).trim(),
        serviceType,
        status,
        fee,
        billingFrequency,
        monthlyFee: monthlyEquivalent(fee, billingFrequency),
        startDate: String(input.startDate ?? current?.startDate ?? stamp().slice(0, 10)).slice(0, 10),
        endDate: input.endDate === '' || input.endDate === null ? null : (input.endDate ?? current?.endDate ?? null),
        notes: String(input.notes ?? current?.notes ?? ''),
        createdAt: current?.createdAt || stamp(),
        updatedAt: stamp(),
    };
}

export function addProjectUpdate(projectId, input = {}) {
    const project = getClientProject(projectId);
    if (!project) fail('Project not found', 404);
    const updates = loadProjectUpdates();
    const row = {
        id: nextId(updates),
        projectId: project.id,
        message: String(input.message || '').trim() || `Status set to ${input.status || project.status}`,
        status: input.status ? normalizeStatus(input.status, project.status) : null,
        createdAt: stamp(),
        createdBy: input.createdBy || null,
    };
    updates.push(row);
    saveUpdates(updates);
    return row;
}

export function createClientProject(input = {}, actor = {}) {
    const projects = loadClientProjects();
    const record = toRecord(input);
    record.id = nextId(projects);
    projects.push(record);
    saveProjects(projects);
    addProjectUpdate(record.id, {
        message: input.notes || `Created ${record.name}`,
        status: record.status,
        createdBy: actor.createdBy || actor.email || null,
    });
    return getClientProject(record.id);
}

export function updateClientProject(id, input = {}, actor = {}) {
    const projects = loadClientProjects();
    const index = projects.findIndex((row) => String(row.id) === String(id));
    if (index < 0) fail('Project not found', 404);
    const previous = projects[index];
    const record = toRecord({ ...previous, ...input }, previous);
    record.id = previous.id;
    record.createdAt = previous.createdAt;
    if (record.status === 'completed' || record.status === 'cancelled') {
        record.endDate = record.endDate || stamp().slice(0, 10);
    }
    if (record.status === 'active' || record.status === 'paused') {
        if (input.endDate === undefined && (previous.status === 'completed' || previous.status === 'cancelled')) {
            record.endDate = null;
        }
    }
    projects[index] = record;
    saveProjects(projects);
    if (input.message || record.status !== previous.status) {
        addProjectUpdate(record.id, {
            message: input.message || `Updated ${record.name}`,
            status: record.status !== previous.status ? record.status : null,
            createdBy: actor.createdBy || actor.email || null,
        });
    }
    return getClientProject(record.id);
}

export function setProjectStatus(id, status, actor = {}) {
    return updateClientProject(
        id,
        {
            status,
            message: actor.message || `Project ${status}`,
        },
        actor
    );
}

export function projectProgress(project) {
    const status = String(project?.status || '').toLowerCase();
    if (status === 'completed') return 100;
    if (status === 'cancelled') return 0;
    if (status === 'paused') return 40;
    const startRaw = project.startDate || project.createdAt;
    const start = startRaw ? new Date(startRaw) : null;
    if (!start || Number.isNaN(start.getTime())) return 20;
    const days = Math.max(0, (Date.now() - start.getTime()) / 86400000);
    return Math.max(15, Math.min(85, Math.round(15 + days * 0.9)));
}

export function presentProject(project, user) {
    if (!project) return null;
    const progress = Number.isFinite(Number(project.progress))
        ? Math.max(0, Math.min(100, Math.round(Number(project.progress))))
        : projectProgress(project);
    if (user?.role === 'staff') return { ...project, progress };
    return {
        id: project.id,
        name: project.name,
        serviceType: project.serviceType,
        status: project.status,
        startDate: project.startDate,
        notes: project.notes || '',
        progress,
    };
}

export function listClientProjects(filters = {}) {
    const clientNeedle = String(filters.client || filters.clientId || filters.clientSlug || '').trim();
    const serviceType = filters.serviceType ? normalizeServiceType(filters.serviceType) : '';
    const status = filters.status ? String(filters.status).toLowerCase() : '';
    return loadClientProjects().filter((row) => {
        if (clientNeedle && String(row.clientId) !== clientNeedle && row.clientSlug !== clientNeedle) return false;
        if (serviceType && row.serviceType !== serviceType) return false;
        if (status && row.status !== status) return false;
        return true;
    });
}

export function seedProjectsFromClientServices() {
    const clients = loadClients();
    const projects = loadClientProjects();
    const have = new Set(projects.map((row) => `${row.clientSlug}:${row.serviceType}`));
    let added = 0;
    for (const client of clients) {
        const services = client.services || [];
        const types = services.length
            ? services
            : (client.reports || []).length
                ? [{ type: 'seo', amount: 0, cycle: 'monthly' }]
                : [];
        for (const service of types) {
            const serviceType = normalizeServiceType(service.type);
            const key = `${client.slug}:${serviceType}`;
            if (have.has(key)) continue;
            const fee = money(service.amount, 0);
            const billingFrequency = service.cycle === 'yearly' ? 'yearly' : 'monthly';
            const record = toRecord({
                clientId: client.slug,
                serviceType,
                name: defaultName(client, serviceType),
                fee,
                billingFrequency,
                status: 'active',
                startDate: (client.started || client.createdAt || stamp()).toString().slice(0, 10),
                notes: service.label || '',
            });
            record.id = nextId(projects);
            projects.push(record);
            have.add(key);
            added += 1;
        }
    }
    if (added) saveProjects(projects);
    return { added, total: projects.length };
}

export function projectActiveInMonth(project, yearMonth) {
    const [year, month] = String(yearMonth).split('-').map(Number);
    if (!year || !month) fail('month must be YYYY-MM');
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const projectStart = new Date(`${project.startDate}T00:00:00Z`);
    if (Number.isNaN(projectStart.getTime()) || projectStart > end) return false;
    if (project.endDate) {
        const projectEnd = new Date(`${project.endDate}T00:00:00Z`);
        if (!Number.isNaN(projectEnd.getTime()) && projectEnd < start) return false;
    }
    if (project.status === 'cancelled' && project.endDate) {
        const projectEnd = new Date(`${project.endDate}T00:00:00Z`);
        if (!Number.isNaN(projectEnd.getTime()) && projectEnd < start) return false;
    }
    if (project.status !== 'active') return false;
    return true;
}
