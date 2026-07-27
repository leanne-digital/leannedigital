import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    assetPrefix,
    escapeHtml,
    renderFullFooter,
    renderHead,
    renderNav,
} from './layout.mjs';
import { slugFromServicePath } from './service-pages.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'service-pages.json');
const SITE = 'https://leannedigital.com';

function depthFromDir(relativeDir) {
    if (!relativeDir) return 0;
    return relativeDir.split('/').filter(Boolean).length;
}

function writePage(relativeDir, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function renderHeroButtons(buttons) {
    if (!buttons.length) {
        return `                        <a class="ld-btn" href="/contact/">Let's Chat!</a>`;
    }

    return buttons
        .map((button) => {
            const href = button.href.startsWith('http') ? button.href : button.href || '/contact/';
            const external =
                href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `                        <a class="ld-btn" href="${escapeHtml(href)}"${external}>${escapeHtml(button.text)}</a>`;
        })
        .join('\n');
}

function renderHero(page, depth) {
    const prefix = assetPrefix(depth);
    const image = page.hero.image
        ? `<img class="service-hero__photo" src="${prefix}${page.hero.image.replace(/^\//, '')}" alt="" width="625" height="1006" loading="eager">`
        : '';

    return `        <section class="service-hero section--navy" aria-labelledby="service-heading">
            <div class="container service-hero__grid">
                <div class="service-hero__content">
                    <h1 class="service-hero__title" id="service-heading">${escapeHtml(page.hero.title)}</h1>
                    <div class="service-hero__lead">${page.hero.lead}</div>
                    <div class="service-hero__actions">
${renderHeroButtons(page.hero.buttons)}
                    </div>
                </div>
                <div class="service-hero__media">${image}</div>
            </div>
        </section>`;
}

function renderSections(sections) {
    return sections
        .map(
            (section, index) => `        <section class="service-section section--navy${index % 2 ? ' service-section--alt' : ''}">
            <div class="container">
                <div class="service-section__panel">
                    <div class="service-section__content">${section}</div>
                </div>
            </div>
        </section>`
        )
        .join('\n');
}

function renderContactCta(depth) {
    const prefix = assetPrefix(depth);
    return `        <section class="contact section--navy" id="contact" aria-labelledby="service-contact-heading">
            <div class="container">
                <div class="contact__panel">
                    <div class="contact__intro">
                        <h2 class="contact__title" id="service-contact-heading">Ready to get started?</h2>
                        <div class="contact__copy">
                            <p>Tell us what you are building and we will help you figure out the best next step.</p>
                        </div>
                        <a class="ld-btn" href="/contact/">Book A Call With mE</a>
                    </div>
                    <form class="contact-form" action="/contact/" method="get" aria-label="Service contact form">
                        <div class="contact-form__field">
                            <label for="service-contact-email">Email</label>
                            <input type="email" id="service-contact-email" name="email" placeholder="Email" required autocomplete="email">
                        </div>
                        <div class="contact-form__field">
                            <label for="service-contact-message">Message</label>
                            <textarea id="service-contact-message" name="message" rows="4" placeholder="Message"></textarea>
                        </div>
                        <button class="ld-btn" type="submit">Send A Message (I'll respond!)</button>
                    </form>
                </div>
            </div>
        </section>`;
}

function renderServicePage(page, depth) {
    const prefix = assetPrefix(depth);

    return `${renderHead({
        title: `${escapeHtml(page.title)} | Leanne Digital`,
        description: escapeHtml(page.description || page.title),
        depth,
        extraCss: ['services.css', 'service-page.css', 'contact.css'],
        canonical: `${SITE}${page.path}`,
    })}
<body class="page-inner">
${renderNav(depth, page.path)}
    <main>
${renderHero(page, depth)}
${renderSections(page.sections)}
${renderContactCta(depth)}
    </main>
${renderFullFooter(depth)}
    <script src="${prefix}js/site-nav.js" defer></script>
</body>
</html>
`;
}

function main() {
    if (!fs.existsSync(DATA_FILE)) {
        console.error('Missing data/service-pages.json — run: node scripts/import-services.mjs');
        process.exit(1);
    }

    const pages = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    for (const page of pages) {
        const dir = slugFromServicePath(page.path);
        writePage(dir, renderServicePage(page, depthFromDir(dir)));
    }

    console.log(`Generated ${pages.length} service pages.`);
}

main();
