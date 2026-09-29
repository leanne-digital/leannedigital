import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATABASE_FILE = process.env.INTAKE_DB_PATH || path.join(ROOT, 'runtime', 'intake', 'intake.sqlite');

const optionalText = (max = 5000) => z.string().trim().max(max).optional().default('');
const choice = (values) => z.union([z.enum(values), z.literal('')]).optional().default('');
const choiceList = (values) => z.array(z.enum(values)).max(values.length).optional().default([]);

export const mittohneeSchema = z.object({
    name: z.string().trim().min(1, 'Your name is required.').max(160),
    businessName: z.string().trim().min(1, 'Business name is required.').max(200),
    email: z.string().trim().email('Enter a valid email address.').max(254),
    ownsDomain: choice(['yes', 'no', 'not-sure']),
    currentDomain: optionalText(255),
    desiredDomain: optionalText(255),
    hasWebsite: choice(['yes', 'no']),
    websiteAddress: optionalText(500),
    businessTypes: choiceList(['service', 'product', 'both', 'other']),
    businessTypeOther: optionalText(200),
    services: optionalText(),
    products: optionalText(),
    productCount: choice(['1-10', '11-25', '26-50', '50+', 'not-sure']),
    idealCustomer: optionalText(),
    customerLocations: choiceList(['local-community', 'manitoba', 'canada', 'online', 'other']),
    customerLocationOther: optionalText(200),
    customerProblem: optionalText(),
    customerResult: optionalText(),
    businessValues: optionalText(),
    differentiator: optionalText(),
    statementProvides: optionalText(1000),
    statementFor: optionalText(1000),
    statementOutcome: optionalText(1000),
    consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required.' }) }),
    website: optionalText(200),
}).strict();

let database;

function db() {
    if (database) return database;
    fs.mkdirSync(path.dirname(DATABASE_FILE), { recursive: true });
    database = new DatabaseSync(DATABASE_FILE);
    database.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS intake_clients (
            slug TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS intake_submissions (
            id TEXT PRIMARY KEY,
            client_slug TEXT NOT NULL REFERENCES intake_clients(slug),
            form_slug TEXT NOT NULL,
            submitted_at TEXT NOT NULL,
            name TEXT NOT NULL,
            business_name TEXT NOT NULL,
            email TEXT NOT NULL,
            business_types TEXT NOT NULL,
            customer_locations TEXT NOT NULL,
            searchable_text TEXT NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS intake_submissions_client_date
            ON intake_submissions(client_slug, submitted_at DESC);
        CREATE INDEX IF NOT EXISTS intake_submissions_business_name
            ON intake_submissions(client_slug, business_name COLLATE NOCASE);
    `);
    database.prepare('INSERT OR IGNORE INTO intake_clients (slug, name) VALUES (?, ?)')
        .run('red-river-college', 'Red River College');
    return database;
}

function searchable(data) {
    return Object.values(data)
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toLowerCase();
}

export function saveMittohneeSubmission(input) {
    const data = mittohneeSchema.parse(input);
    if (data.website) return { accepted: true, id: null };
    const row = {
        id: randomUUID(),
        clientSlug: 'red-river-college',
        formSlug: 'mittohnee',
        submittedAt: new Date().toISOString(),
        ...data,
    };
    db().prepare(`
        INSERT INTO intake_submissions
        (id, client_slug, form_slug, submitted_at, name, business_name, email,
         business_types, customer_locations, searchable_text, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        row.id,
        row.clientSlug,
        row.formSlug,
        row.submittedAt,
        row.name,
        row.businessName,
        row.email,
        JSON.stringify(row.businessTypes),
        JSON.stringify(row.customerLocations),
        searchable(row),
        JSON.stringify(row),
    );
    return { accepted: true, id: row.id, submittedAt: row.submittedAt };
}

function safeJson(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
}

export function listMittohneeSubmissions(filters = {}) {
    const clauses = ['client_slug = ?', 'form_slug = ?'];
    const values = ['red-river-college', 'mittohnee'];
    const search = String(filters.search || '').trim().toLowerCase();
    const businessType = String(filters.businessType || '').trim();
    const customerLocation = String(filters.customerLocation || '').trim();
    const dateFrom = String(filters.dateFrom || '').trim();
    const dateTo = String(filters.dateTo || '').trim();
    if (search) { clauses.push('searchable_text LIKE ?'); values.push(`%${search}%`); }
    if (businessType) { clauses.push('business_types LIKE ?'); values.push(`%"${businessType}"%`); }
    if (customerLocation) { clauses.push('customer_locations LIKE ?'); values.push(`%"${customerLocation}"%`); }
    if (dateFrom) { clauses.push('submitted_at >= ?'); values.push(`${dateFrom}T00:00:00.000Z`); }
    if (dateTo) { clauses.push('submitted_at <= ?'); values.push(`${dateTo}T23:59:59.999Z`); }
    const limit = Math.min(250, Math.max(1, Number(filters.limit) || 100));
    const rows = db().prepare(`
        SELECT id, submitted_at, name, business_name, email, business_types,
               customer_locations, payload
        FROM intake_submissions
        WHERE ${clauses.join(' AND ')}
        ORDER BY submitted_at DESC
        LIMIT ?
    `).all(...values, limit);
    const submissions = rows.map((row) => ({
        ...safeJson(row.payload, {}),
        id: row.id,
        submittedAt: row.submitted_at,
        name: row.name,
        businessName: row.business_name,
        email: row.email,
        businessTypes: safeJson(row.business_types, []),
        customerLocations: safeJson(row.customer_locations, []),
    }));
    return { submissions, count: submissions.length };
}

export function closeIntakeDatabase() {
    if (!database) return;
    database.close();
    database = undefined;
}
