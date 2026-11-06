#!/usr/bin/env node
// Builds the downloadable PDF for each client proposal page.
//
// Each proposal's "Download PDF" button links to a file in its own folder, e.g.
//   proposals/dcd-canada/dcd-canada-website-branding-proposal.pdf
// Re-run this after editing a proposal so the PDF matches the page:
//   npm run portal            (in another terminal, serves http://localhost:4174)
//   npm run proposals:pdf     (all proposals)
//   npm run proposals:pdf -- dcd-canada   (one proposal)
//
// Uses headless Google Chrome and the page's @media print styles (css/proposal.css).
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = process.env.PROPOSAL_BASE_URL || 'http://localhost:4174';
const chrome = process.env.CHROME_PATH || [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
].find(p => fs.existsSync(p));
if (!chrome) throw new Error('Google Chrome not found. Set CHROME_PATH.');

const only = process.argv.slice(2);
const dir = path.join(root, 'proposals');
const slugs = fs.readdirSync(dir).filter(slug => !only.length || only.includes(slug));

let built = 0;
for (const slug of slugs) {
    const page = path.join(dir, slug, 'index.html');
    if (!fs.existsSync(page)) continue;
    const pdf = fs.readFileSync(page, 'utf8').match(/class="proposal-download">\s*<a[^>]+href="([^"]+\.pdf)"/)?.[1];
    if (!pdf) continue; // proposal has no download button
    const out = path.join(dir, slug, pdf);
    execFileSync(chrome, [
        '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
        '--run-all-compositor-stages-before-draw', '--virtual-time-budget=8000',
        `--print-to-pdf=${out}`, `${base}/proposals/${slug}/`,
    ], {stdio: ['ignore', 'ignore', 'pipe']});
    console.log(`✓ ${path.relative(root, out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
    built++;
}
if (!built) console.log('No proposal pages with a Download PDF button found.');
