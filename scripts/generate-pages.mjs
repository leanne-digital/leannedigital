import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMING_SOON_PAGES, BUILT_PAGES, SITE_URL } from './site-config.mjs';
import {
    escapeHtml,
    renderFullFooter,
    renderHead,
    renderNav,
    renderPageScripts,
} from './layout.mjs';
import { faqsForPath, renderFaqSection } from './seo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function writePage(relativeDir, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function renderComingSoon(page, depth) {
    return `${renderHead({
        title: `${escapeHtml(page.title)} | Leanne Digital`,
        description: escapeHtml(`${page.description} This page is coming soon.`),
        depth,
        extraCss: ['coming-soon.css'],
        canonical: `${SITE_URL}${page.path}`,
        path: page.path,
        robots: 'noindex, follow',
    })}
<body class="page-inner">
${renderNav(depth, page.path)}
    <main id="main" class="coming-soon">
        <div class="container coming-soon__inner">
            <p class="coming-soon__eyebrow">Coming soon</p>
            <h1 class="coming-soon__title">${escapeHtml(page.title)}</h1>
            <p class="coming-soon__lead">We're rebuilding this page. In the meantime, send a message and we can still help.</p>
            <a class="coming-soon__cta" href="/contact/">Contact us</a>
        </div>
${renderFaqSection(faqsForPath(page.path))}
    </main>
${renderFullFooter(depth)}
${renderPageScripts(depth)}
</body>
</html>
`;
}

function renderThankYou(depth) {
    return `${renderHead({
        depth,
        extraCss: ['coming-soon.css'],
    })}
<body class="page-inner">
    <!-- lp:custom-body-start -->
${renderNav(depth, '/thank-you/')}
    <main id="main" class="coming-soon">
        <div class="container coming-soon__inner">
            <p class="coming-soon__eyebrow">Message received</p>
            <h1 class="coming-soon__title">Thank you</h1>
            <p class="coming-soon__lead">We got your message and will reply soon.</p>
            <a class="coming-soon__cta" href="/">Back to home</a>
        </div>
${renderFaqSection(faqsForPath('/thank-you/'))}
    </main>
${renderFullFooter(depth)}
${renderPageScripts(depth)}
    <!-- lp:custom-body-end -->
</body>
</html>
`;
}

function renderPrivacyPolicy(depth) {
    const faqs = faqsForPath('/privacy-policy/');
    return `${renderHead({
        title: 'Privacy Policy | Leanne Digital',
        description: 'How Leanne Digital collects and uses information, including Google Analytics data, when you visit our website or contact us.',
        depth,
        extraCss: ['legal.css'],
        canonical: `${SITE_URL}/privacy-policy/`,
        path: '/privacy-policy/',
    })}
<body class="page-inner">
${renderNav(depth, '/privacy-policy/')}
    <main id="main" class="legal-page">
        <div class="container legal-page__inner">
            <h1>Privacy Policy</h1>
            <p class="legal-page__updated">Last updated: August 12, 2026</p>
            <p>Leanne Digital (“we”, “us”) is an Indigenous-owned digital marketing studio in Winnipeg, Manitoba. This policy explains what we collect when you use <a href="https://leannedigital.com">leannedigital.com</a>.</p>

            <h2>Information we collect</h2>
            <p>We collect information in three ways:</p>
            <ul>
                <li><strong>Contact forms.</strong> If you send a message, we collect your name, email address, message, the service you selected (if any), and the page you sent it from.</li>
                <li><strong>Google Analytics.</strong> We use Google Analytics (gtag.js, measurement ID G-K29LV069TN) to understand how people use this site. Google may collect pages you visit, how long you stay, your device and browser, approximate location, referring website, and similar usage data. This is done with cookies and similar technologies.</li>
                <li><strong>Spam protection.</strong> Forms may use Google reCAPTCHA, which can collect device and interaction data to tell people from bots.</li>
            </ul>

            <h2>Google Analytics</h2>
            <p>We do collect user data with Google Analytics. That data helps us see which pages are useful, where traffic comes from, and how the site is performing. Google processes this information under its own policies. You can learn more in the <a href="https://policies.google.com/privacy" rel="noopener noreferrer">Google Privacy Policy</a> and opt out with the <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer">Google Analytics opt-out browser add-on</a>. You can also block or delete cookies in your browser.</p>

            <h2>How we use this information</h2>
            <p>We use it to reply to inquiries, run and improve the website, measure traffic, and prevent spam or abuse. We do not sell your personal information.</p>

            <h2>How long we keep it</h2>
            <p>Form messages are kept as long as needed to respond and follow up. Analytics data is kept according to our Google Analytics settings and Google’s retention rules.</p>

            <h2>Contact</h2>
            <p>Questions about this policy: <a href="mailto:leanne@leannedigital.com">leanne@leannedigital.com</a>.</p>
        </div>
${renderFaqSection(faqs)}
    </main>
${renderFullFooter(depth)}
${renderPageScripts(depth)}
</body>
</html>
`;
}

const uniquePages = [...new Map(COMING_SOON_PAGES.map((p) => [p.path, p])).values()];

for (const page of uniquePages) {
    const slug = page.path.replace(/^\/|\/$/g, '');
    const depth = slug ? 1 : 0;

    if (BUILT_PAGES.has(page.path)) continue;
    if (page.path === '/sitemap/') continue;
    if (page.path === '/privacy-policy/') {
        writePage(slug, renderPrivacyPolicy(depth));
        continue;
    }

    writePage(slug, renderComingSoon(page, depth));
}

writePage('thank-you', renderThankYou(1));

console.log(`Generated ${uniquePages.length} utility pages + thank-you.`);
