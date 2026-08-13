import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { faqsForPath, htmlHasVisibleFaq, renderFaqSection } from './seo.mjs';
import { transformHtml } from './lilipadd-slots.mjs';
import { bakeSeoIntoTree } from './bake-seo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
    { file: 'index.html', path: '/', depth: 0 },
    { file: 'about/index.html', path: '/about/', depth: 1 },
    { file: 'contact/index.html', path: '/contact/', depth: 1 },
];

const FOOTER_LINKS = `                <div class="site-footer__column">
                    <span class="site-footer__column-title">Brand Design</span>
                    <p class="site-footer__links"><a href="/winnipeg-logo-design/">Logo Design</a><br><a href="/graphic-design/">Brand Design</a><br><a href="/graphic-design/">Graphic Design</a></p>
                </div>
                <div class="site-footer__column">
                    <span class="site-footer__column-title">Web Design and Technical Support</span>
                    <p class="site-footer__links"><a href="/website-design/">Website Design</a><br><a href="/website-management-support/">Website Hosting</a><br><a href="/website-management-support/">Website Maintenance &amp; Security</a><br><a href="/contact/">Conversion Rate Optimization</a><br><a href="/contact/">Custom Integrations</a></p>
                </div>
                <div class="site-footer__column">
                    <span class="site-footer__column-title">SEO &amp; Visibility</span>
                    <p class="site-footer__links"><a href="/answer-engine-optimization-aeo/">AI Search Optimization (AEO)</a><br><a href="/seo/">Ongoing SEO</a><br><a href="/seo/">Local SEO</a><br><a href="/seo/">Tech SEO</a><br><a href="/google-ads/">Google Ads</a><br><a href="/contact/">Reddit Ads</a></p>
                </div>`;

function ensureFaqCss(html, depth) {
    if (html.includes('css/faq.css')) return html;
    const prefix = depth === 0 ? '' : '../'.repeat(depth);
    return html.replace(
        /<link rel="stylesheet" href="[^"]*footer\.css">/,
        (match) => `    <link rel="stylesheet" href="${prefix}css/faq.css">\n${match}`
    );
}

function ensureSkipAndMain(html) {
    if (!html.includes('skip-link')) {
        html = html.replace(
            /<body([^>]*)>\s*(?:<!-- lp:custom-body-start -->\s*)?<header class="site-header">/,
            '<body$1>\n    <!-- lp:custom-body-start -->\n    <a class="skip-link" href="#main">Skip to content</a>\n    <header class="site-header">'
        );
    }
    html = html.replace(/<main>/, '<main id="main">');
    html = html.replace(/<main class="/, '<main id="main" class="');
    return html;
}

function ensureFaq(html, pagePath) {
    if (htmlHasVisibleFaq(html) || html.includes('page-faq')) return html;
    const block = renderFaqSection(faqsForPath(pagePath));
    return html.replace('    </main>', `${block}    </main>`);
}

function ensureFooterLinks(html) {
    return html.replace(
        /<div class="site-footer__column">\s*<span class="site-footer__column-title">Brand Design<\/span>[\s\S]*?<span class="site-footer__column-title">SEO &amp; Visibility<\/span>[\s\S]*?<\/div>/,
        FOOTER_LINKS
    );
}

function main() {
    for (const page of PAGES) {
        const filePath = path.join(ROOT, page.file);
        if (!fs.existsSync(filePath)) continue;
        let html = fs.readFileSync(filePath, 'utf8');
        html = ensureFaqCss(html, page.depth);
        html = ensureSkipAndMain(html);
        html = ensureFaq(html, page.path);
        html = ensureFooterLinks(html);
        html = transformHtml(html);
        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`Lilipadd-patched ${page.file}`);
    }
    const baked = bakeSeoIntoTree();
    console.log(`Baked SEO titles into ${baked.changed}/${baked.files} pages.`);
}

main();
