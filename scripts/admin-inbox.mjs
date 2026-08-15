import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX_FILE = path.join(ROOT, 'data', 'contact-inbox.jsonl');
const LEADS_FILE = path.join(ROOT, 'data', 'lead-status.json');
const CALENDLY_FILE = path.join(ROOT, 'data', 'calendly-bookings.json');
const LEAD_STATUSES = new Set(['new', 'contacted', 'won', 'closed']);

function readJson(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function submissionId(entry) {
    return `${entry.at || ''}|${entry.email || ''}|${entry.page || ''}`;
}

export function loadSubmissions() {
    if (!fs.existsSync(INBOX_FILE)) return [];
    const statuses = readJson(LEADS_FILE, {});
    return fs
        .readFileSync(INBOX_FILE, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .map((entry) => {
            const id = submissionId(entry);
            return {
                id,
                ...entry,
                status: LEAD_STATUSES.has(statuses[id]) ? statuses[id] : 'new',
            };
        })
        .reverse();
}

export function setLeadStatus(id, status) {
    const next = String(status || '').trim();
    if (!LEAD_STATUSES.has(next)) {
        const error = new Error('Status must be new, contacted, won, or closed');
        error.status = 400;
        throw error;
    }
    const statuses = readJson(LEADS_FILE, {});
    statuses[id] = next;
    writeJson(LEADS_FILE, statuses);
    return { id, status: next };
}

export function loadCalendlyBookings() {
    return readJson(CALENDLY_FILE, []);
}

export function saveCalendlyBooking(body = {}) {
    const payload = body.payload || body;
    const event = payload.scheduled_event || payload.event || {};
    const invitee = payload.invitee || payload;
    const booking = {
        id: payload.uri || payload.uuid || event.uri || `${Date.now()}`,
        at: new Date().toISOString(),
        eventType: event.name || payload.event_type || body.event || 'Calendly booking',
        startTime: event.start_time || payload.start_time || '',
        endTime: event.end_time || payload.end_time || '',
        inviteeName: invitee.name || payload.name || '',
        inviteeEmail: invitee.email || payload.email || '',
        status: body.event === 'invitee.canceled' ? 'canceled' : 'booked',
    };
    const current = loadCalendlyBookings().filter((row) => row.id !== booking.id);
    current.unshift(booking);
    writeJson(CALENDLY_FILE, current.slice(0, 500));
    return booking;
}
