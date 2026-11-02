import fs from 'node:fs';
import { renderSeoReportBody } from './seo-report-template.mjs';

// Reuse the existing October route's shell. Never regenerate September.
const slug = 'seo-report-shift-physiotherapy-october-2026';
const record = JSON.parse(fs.readFileSync(`data/client-reports/shift-physiotherapy/${slug}.json`, 'utf8'));
const target = `clients/shift-physiotherapy/${slug}/index.html`;
const shellPath = fs.existsSync(target) ? target : 'tmp/shift-october-live.html';
const shell = fs.readFileSync(shellPath, 'utf8');
if ((shell.match(/<article class="seo-report/g) || []).length !== 1) throw new Error('Expected exactly one report');
const html = shell.replace(/<article class="seo-report[\s\S]*?<\/article>/, renderSeoReportBody(record));
fs.mkdirSync(`clients/shift-physiotherapy/${slug}`, { recursive: true });
fs.writeFileSync(target, html);
console.log(`Updated ${target}`);
