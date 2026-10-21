import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendMail } from './mail.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = path.join(ROOT, 'data', 'contact-inbox.jsonl');
const QUARANTINE = path.join(ROOT, 'data', 'contact-spam.jsonl');

// Match the observed bot campaign conservatively. Ordinary sentences, URLs
// and non-Latin messages remain eligible for human review.
export function contactSpamReason(entry) {
    if (!/^[a-zA-Z]{16,80}$/.test(entry.message)) return '';
    const transitions = [...entry.message].slice(1).filter((character, index) =>
        (character === character.toUpperCase()) !==
        (entry.message[index] === entry.message[index].toUpperCase())).length;
    return transitions >= 6 ? 'random-mixed-case-message' : '';
}

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
    return value.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
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

function saveInbox(entry, file = INBOX) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function sendContactMail(entry) {
    return sendMail({
        to: 'leanne@leannedigital.com',
        bcc: 'gary@leannedigital.com',
        replyTo: entry.email,
        subject: `Leanne Digital Contact Form - ${entry.service} Inquiry`,
        text: [
            `Name: ${entry.name || '(not provided)'}`,
            `Email: ${entry.email}`,
            `Company Name: ${entry.companyName || '(not provided)'}`,
            `Current Website: ${entry.currentWebsite || '(not provided)'}`,
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
    if (['honey', '_honey', 'company_website', 'website'].some(key => body[key])) {
        const error = new Error('Spam check failed. Please try again.');
        error.status = 400;
        throw error;
    }
    for (const [field, max] of [['name', 120], ['email', 254], ['message', 5000], ['service', 120]]) {
        if (typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > max) {
            const error = new Error(`Please enter ${field === 'email' ? 'a valid email address' : field === 'service' ? 'a service' : `your ${field}`} (maximum ${max} characters).`);
            error.status = 400;
            throw error;
        }
    }
    const email = body.email.trim().toLowerCase();
    const message = body.message.trim();
    for (const [field, max] of [['companyName', 200], ['currentWebsite', 500]]) {
        if (body[field] != null && (typeof body[field] !== 'string' || body[field].trim().length > max)) {
            const error = new Error(`Invalid ${field === 'companyName' ? 'company name' : 'current website'} (maximum ${max} characters).`);
            error.status = 400;
            throw error;
        }
    }
    if (!['Web Design', 'Graphic Design', 'SEO Strategy and Marketing', 'Website Maintenance', 'Custom Application', 'Speaking Engagements', 'AI and Automations', 'Other'].includes(body.service.trim())) {
        const error = new Error('Please select a service from the list.');
        error.status = 400;
        throw error;
    }
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
        companyName: (body.companyName || '').trim(),
        currentWebsite: (body.currentWebsite || '').trim(),
        service: String(body.service || '').trim().slice(0, 120),
        message: message.slice(0, 5000),
        page: String(body.page || '').slice(0, 200),
        ip,
    };
    const spamReason = contactSpamReason(entry);
    if (spamReason) {
        saveInbox({ ...entry, spamReason }, QUARANTINE);
        return { ok: true, message: 'Thanks — your message has been received.' };
    }
    saveInbox(entry);
    try {
        await sendContactMail(entry);
    } catch (error) {
        console.error('Contact email failed:', error.code || 'SMTP_DELIVERY_FAILED');
        const failure = new Error('Could not send your message. Please try again shortly.');
        failure.status = 503;
        throw failure;
    }
    return { ok: true, message: 'Thanks — your message is on its way.' };
}
