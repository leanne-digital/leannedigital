import nodemailer from 'nodemailer';
import { CONTACT_EMAIL } from '../scripts/seo.mjs';

export function mailConfigured() {
    return Boolean(process.env.SMTP_HOST);
}

export async function sendMail({ to, subject, text, html, replyTo } = {}) {
    const host = process.env.SMTP_HOST;
    if (!host || !to) return false;
    const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_PORT || '587') === '465',
        auth:
            process.env.SMTP_USER && process.env.SMTP_PASS
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
    });
    await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || CONTACT_EMAIL,
        to,
        replyTo,
        subject,
        text,
        html,
    });
    return true;
}
