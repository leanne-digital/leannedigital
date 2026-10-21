import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date');
export const workLogSchema = z.object({
    clientSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    projectId: z.string().max(100).optional().default(''),
    reportSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    workedOn: date,
    title: z.string().trim().min(1).max(200),
    details: z.string().trim().min(1).max(20000),
    status: z.enum(['completed', 'awaiting_client', 'in_progress']),
}).strict().refine(row => row.workedOn.slice(0, 7) === row.month, 'Work date must fall within the report month');

function withDatabase(action) {
    const file = process.env.CLIENT_WORK_LOG_DB_PATH || (process.env.OAUTH_DATA_DIR
        ? path.resolve(process.env.OAUTH_DATA_DIR, '../client-work-log/work-log.sqlite')
        : path.join(ROOT, 'runtime/client-work-log/work-log.sqlite'));
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(file);
    try {
        fs.chmodSync(file, 0o600);
        db.exec(`PRAGMA busy_timeout = 5000;
            CREATE TABLE IF NOT EXISTS client_work_log (
                id TEXT PRIMARY KEY, client_slug TEXT NOT NULL, report_month TEXT NOT NULL,
                report_slug TEXT NOT NULL, worked_on TEXT NOT NULL, fingerprint TEXT NOT NULL UNIQUE,
                payload TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS client_work_log_month ON client_work_log(client_slug, report_month);`);
        return action(db);
    } finally { db.close(); }
}

export function listClientWorkLogs({ clientSlug, month, reportSlug } = {}) {
    if (!clientSlug) throw new Error('Client is required');
    const where = ['client_slug = ?'];
    const args = [clientSlug];
    if (month) { where.push('report_month = ?'); args.push(month); }
    if (reportSlug) { where.push('report_slug = ?'); args.push(reportSlug); }
    return withDatabase(db => db.prepare(`SELECT payload FROM client_work_log WHERE ${where.join(' AND ')} ORDER BY worked_on, id`).all(...args).map(row => JSON.parse(row.payload)));
}

export function appendClientWorkLog(input, actor = 'staff') {
    const data = workLogSchema.parse(input);
    const normalize = value => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    const fingerprint = createHash('sha256').update(JSON.stringify([data.clientSlug, data.workedOn, normalize(data.title), normalize(data.details)])).digest('hex');
    return withDatabase(db => {
        db.exec('BEGIN IMMEDIATE');
        try {
            const existing = db.prepare('SELECT payload FROM client_work_log WHERE fingerprint = ?').get(fingerprint);
            if (existing) {
                db.exec('COMMIT');
                return { created: false, entry: JSON.parse(existing.payload) };
            }
            const entry = { id: randomUUID(), ...data, createdAt: new Date().toISOString(), createdBy: actor };
            db.prepare('INSERT INTO client_work_log VALUES (?, ?, ?, ?, ?, ?, ?)').run(entry.id, data.clientSlug, data.month, data.reportSlug, data.workedOn, fingerprint, JSON.stringify(entry));
            db.exec('COMMIT');
            return { created: true, entry };
        } catch (error) { db.exec('ROLLBACK'); throw error; }
    });
}
