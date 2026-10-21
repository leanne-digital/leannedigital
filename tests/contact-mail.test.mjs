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
        const { handleContact, contactSpamReason } = await import(pathToFileURL(modulePath));
        let count = 0;
        const submit = (body = {}) => handleContact({ socket: { remoteAddress: `test-${count++}` } }, {
            name: 'SMTP test', email: 'visitor@example.com', message: 'Test inquiry', service: 'Other', ...body,
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
        assert.equal(message.subject, 'Leanne Digital Contact Form - Other Inquiry');
        assert.match(message.text, /Company Name: \(not provided\)/);
        for (const service of ['Speaking Engagements', 'AI and Automations']) {
            assert.equal((await submit({ service, companyName: ' Example Company ', currentWebsite: ' example.com ' })).ok, true);
            assert.equal(message.subject, `Leanne Digital Contact Form - ${service} Inquiry`);
            assert.match(message.text, /Company Name: Example Company\nCurrent Website: example.com/);
        }
        const saved = JSON.parse(fs.readFileSync(path.join(fixture, 'data/contact-inbox.jsonl'), 'utf8').trim().split('\n').at(-1));
        assert.equal(saved.companyName, 'Example Company');
        assert.equal(saved.currentWebsite, 'example.com');
        await assert.rejects(submit({ companyName: {} }), { status: 400 });
        await assert.rejects(submit({ currentWebsite: 'x'.repeat(501) }), { status: 400 });
        const deliveredMessage = message;
        const inboxBeforeSpam = fs.readFileSync(path.join(fixture, 'data/contact-inbox.jsonl'), 'utf8');
        const observedSpam = ['ZvszFbepAZERseLWckQQkLEL', 'JrkkcUBcHFcCEAzyIkKBsX',
            'qQymbuvCgbidGxDrQPyF', 'yMBOrAFnkXJEoRXjPs'];
        for (const spam of observedSpam) {
            assert.equal((await submit({ message: spam })).ok, true);
        }
        assert.equal(message, deliveredMessage, 'quarantined submissions must not send email');
        assert.equal(fs.readFileSync(path.join(fixture, 'data/contact-inbox.jsonl'), 'utf8'), inboxBeforeSpam);
        const quarantined = fs.readFileSync(path.join(fixture, 'data/contact-spam.jsonl'), 'utf8')
            .trim().split('\n').map(JSON.parse);
        assert.equal(quarantined.length, 4);
        assert.ok(quarantined.every((entry) => entry.spamReason === 'random-mixed-case-message'));
        for (const legitimate of [
            'I received a quote in March and need to connect',
            'I am in need of a revised quote from March for my business funding',
            'I am looking for a WordPress / AI / Local SEO role (remote)',
            'https://example.com/MyProject', 'WEBSITEDESIGNINQUIRY',
            'websitedesigninquiry', 'Bonjour, je souhaite un devis.',
        ]) {
            assert.equal(contactSpamReason({ name: '', service: '', message: legitimate }), '');
        }
        assert.equal(contactSpamReason({ name: 'Customer', message: observedSpam[0] }), 'random-mixed-case-message');
        assert.equal(contactSpamReason({ service: 'Web Design', message: observedSpam[0] }), 'random-mixed-case-message');
        for (const field of ['name', 'email', 'message', 'service']) {
            for (const value of ['', '   ', null, undefined, {}, []]) {
                await assert.rejects(submit({ [field]: value }), { status: 400 });
            }
        }
        await assert.rejects(submit({ service: 'Made-up service' }), { status: 400 });
        await assert.rejects(submit({ message: 'a'.repeat(5001) }), { status: 400 });
        for (const trap of ['honey', '_honey', 'company_website', 'website']) {
            await assert.rejects(submit({ [trap]: 'bot-filled' }), { status: 400 });
        }
        assert.equal(message, deliveredMessage, 'invalid submissions must not send email');
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


test('site generation preserves the SMTP form handler', async () => {
    const { transformHtml } = await import('../scripts/lilipadd-slots.mjs');
    const html = fs.readFileSync(new URL('../contact/index.html', import.meta.url), 'utf8');
    const generated = transformHtml(html);
    assert.match(generated, /action="\/api\/contact"/);
    assert.match(generated, /data-contact-backend="smtp"/);
    assert.match(generated, /src="\/js\/contact-form.js\?v=smtp-4"/);
    assert.doesNotMatch(generated, /data-lp-form="contact"/);
});

test('all public contact pages use one handler and retain it after generation', async () => {
    const { normalizeContactForms } = await import('../scripts/contact-forms.mjs');
    const { transformHtml } = await import('../scripts/lilipadd-slots.mjs');
    const pages = ['index.html', 'about/index.html', 'contact/index.html', 'google-ads/index.html',
        'graphic-design/index.html', 'indigenous-graphic-design/index.html', 'seo/index.html',
        'website-design/index.html', 'website-management-support/index.html', 'winnipeg-logo-design/index.html'];
    for (const page of pages) {
        const html = fs.readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
        for (const content of [html, transformHtml(html)]) {
            assert.match(content, /action="\/api\/contact"/, page);
            assert.match(content, /data-contact-backend="smtp"/, page);
            assert.doesNotMatch(content, /data-lp-form=|class="contact-form lp-form"/, page);
            assert.equal((content.match(/src="[^"]*contact-form\.js/g) || []).length, 1, page);
            for (const field of ['name', 'email', 'message', 'service']) {
                const tag = content.match(new RegExp('<(?:input|textarea|select)\\b[^>]*name="' + field + '"[^>]*>'))?.[0];
                assert.ok(tag && /\srequired(?:\s|>|=)/.test(tag), `${page}: ${field} required`);
            }
            assert.equal((content.match(/name="_honey"/g) || []).length, 1, `${page}: one honeypot`);
            assert.match(content, /<option value="">Select a service<\/option>/, page);
            for (const service of ['Speaking Engagements', 'AI and Automations']) {
                assert.ok(content.includes(`<option value="${service}">${service}</option>`), page);
            }
            for (const field of ['companyName', 'currentWebsite']) {
                const tags = [...content.matchAll(new RegExp('<input\\b[^>]*name="' + field + '"[^>]*>', 'g'))];
                assert.equal(tags.length, 1, `${page}: ${field}`);
                assert.doesNotMatch(tags[0][0], /\srequired(?:\s|>|=)/);
            }
            assert.ok(content.indexOf('name="companyName"') < content.indexOf('name="currentWebsite"'), page);
        }
        assert.equal(normalizeContactForms(normalizeContactForms(html)), normalizeContactForms(html), page);
    }
    const intake = fs.readFileSync(new URL('../mittohnee/index.html', import.meta.url), 'utf8');
    assert.equal(normalizeContactForms(intake), intake);
});
