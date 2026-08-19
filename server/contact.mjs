import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTACT_EMAIL } from '../scripts/seo.mjs';
import { sendMail } from './mail.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = path.join(ROOT, 'data', 'contact-inbox.jsonl');

const hits = new Map();

function rateLimited(ip) {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const current = (hits.get(ip) || []).filter((time) => now - time < windowMs);
    current.push(now);
    hits.set(ip, current);
    return current.length > 8;
}

function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function verifyRecaptcha(token, ip) {
    const secret = String(process.env.RECAPTCHA_SECRET_KEY || '').trim();
    if (!secret) return true;
    if (!token) return false;
    const body = new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
    });
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const data = await res.json().catch(() => ({}));
    return Boolean(data.success) && Number(data.score || 0) >= 0.4;
}

function saveInbox(entry) {
    fs.mkdirSync(path.dirname(INBOX), { recursive: true });
    fs.appendFileSync(INBOX, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function sendContactMail(entry) {
    return sendMail({
        to: process.env.MAIL_TO || CONTACT_EMAIL,
        replyTo: entry.email,
        subject: `Website inquiry${entry.service ? ` — ${entry.service}` : ''} from ${entry.name || entry.email}`,
        text: [
            `Name: ${entry.name || '(not provided)'}`,
            `Email: ${entry.email}`,
            `Service: ${entry.service || '(not provided)'}`,
            `Page: ${entry.page || '/'}`,
            '',
            entry.message || '(no message)',
        ].join('\n'),
    });
}

export async function handleContact(req, body) {
    const ip = String(req.socket?.remoteAddress || 'unknown');
    if (rateLimited(ip)) {
        const error = new Error('Please wait a few minutes before sending another message.');
        error.status = 429;
        throw error;
    }
    if (body.honey) {
        return { ok: true, message: 'Thanks — your message is on its way.' };
    }
    const email = String(body.email || '').trim().toLowerCase();
    const message = String(body.message || '').trim();
    if (!looksLikeEmail(email)) {
        const error = new Error('A valid email is required.');
        error.status = 400;
        throw error;
    }
    const allowed = await verifyRecaptcha(body.recaptchaToken, ip);
    if (!allowed) {
        const error = new Error('Spam check failed. Please try again.');
        error.status = 400;
        throw error;
    }
    const entry = {
        at: new Date().toISOString(),
        name: String(body.name || '').trim().slice(0, 120),
        email,
        service: String(body.service || '').trim().slice(0, 120),
        message: message.slice(0, 5000),
        page: String(body.page || '').slice(0, 200),
        ip,
    };
    saveInbox(entry);
    try {
        await sendContactMail(entry);
    } catch (error) {
        console.error('Contact email failed:', error.message);
    }
    return { ok: true, message: 'Thanks — your message is on its way.' };
}
