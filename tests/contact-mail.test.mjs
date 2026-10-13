import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nodemailer from 'nodemailer';
import { sendMail } from '../server/mail.mjs';

test('contact delivery, recipient headers, and failure handling', async () => {
    const originalTransport = nodemailer.createTransport;
    const originalEnv = { ...process.env };
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ld-contact-'));
    let options;
    let message;
    let outcome = { accepted: ['leanne@leannedigital.com', 'gary@leannedigital.com'], rejected: [] };
    nodemailer.createTransport = (config) => {
        options = config;
        return { async sendMail(payload) {
            message = payload;
            if (outcome instanceof Error) throw outcome;
            return outcome;
        } };
    };
    try {
        Object.assign(process.env, {
            SMTP_HOST: 'leannedigital.com', SMTP_PORT: '587',
            SMTP_USER: 'noreply@leannedigital.com', SMTP_PASS: 'test-only',
            MAIL_FROM: 'noreply@leannedigital.com', RECAPTCHA_SECRET_KEY: '',
        });
        fs.mkdirSync(path.join(fixture, 'server'));
        const source = fs.readFileSync(new URL('../server/contact.mjs', import.meta.url), 'utf8')
            .replace("'./mail.mjs'", JSON.stringify(new URL('../server/mail.mjs', import.meta.url).href));
        const modulePath = path.join(fixture, 'server/contact.mjs');
        fs.writeFileSync(modulePath, source);
        const { handleContact } = await import(pathToFileURL(modulePath));
        let count = 0;
        const submit = (body = {}) => handleContact({ socket: { remoteAddress: `test-${count++}` } }, {
            name: 'SMTP test', email: 'visitor@example.com', message: 'Test inquiry', ...body,
        });
        assert.equal((await submit()).ok, true);
        assert.equal(options.host, 'leannedigital.com');
        assert.equal(options.port, 587);
        assert.equal(options.secure, false);
        assert.equal(options.requireTLS, true);
        assert.equal(message.from, 'noreply@leannedigital.com');
        assert.equal(message.to, 'leanne@leannedigital.com');
        assert.equal(message.bcc, 'gary@leannedigital.com');
        assert.equal(message.replyTo, 'visitor@example.com');
        await assert.rejects(submit({ email: 'visitor@example.com,attacker@example.com' }), { status: 400 });
        await assert.rejects(submit({ email: 'visitor@example.com\r\nBcc:attacker@example.com' }), { status: 400 });
        await assert.rejects(submit({ honey: 'spam' }), { status: 400 });
        outcome = new Error('SMTP unavailable');
        await assert.rejects(submit(), { status: 503 });
        outcome = { accepted: ['leanne@leannedigital.com'], rejected: ['gary@leannedigital.com'] };
        await assert.rejects(submit(), { status: 503 });
        outcome = { accepted: [], rejected: [] };
        await assert.rejects(submit(), { status: 503 });
        delete process.env.SMTP_PASS;
        await assert.rejects(sendMail({ to: 'leanne@leannedigital.com' }), /not configured/);
        await assert.rejects(submit(), { status: 503 });
    } finally {
        nodemailer.createTransport = originalTransport;
        for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
        Object.assign(process.env, originalEnv);
        fs.rmSync(fixture, { recursive: true, force: true });
    }
});
