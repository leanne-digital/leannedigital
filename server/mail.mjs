import nodemailer from 'nodemailer';
import { CONTACT_EMAIL } from '../scripts/seo.mjs';

export function mailConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail({ to, bcc, subject, text, html, replyTo } = {}) {
    const host = process.env.SMTP_HOST;
    if (!mailConfigured() || !to) throw new Error('Email delivery is not configured.');
    const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_PORT || '587') === '465',
        requireTLS: String(process.env.SMTP_PORT || '587') !== '465',
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        auth:
            process.env.SMTP_USER && process.env.SMTP_PASS
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
    });
    const result = await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || CONTACT_EMAIL,
        to,
        bcc,
        replyTo,
        subject,
        text,
        html,
    });
    if (!result.accepted?.length || result.rejected?.length) {
        throw new Error('The mail server did not accept all recipients.');
    }
    return true;
}
