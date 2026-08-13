import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    assetPrefix,
    escapeHtml,
    renderFullFooter,
    renderHead,
    renderNav,
    renderPageScripts,
} from './layout.mjs';
import { lpEvent } from './analytics.mjs';
import { SITE_URL } from './site-config.mjs';
import { slugFromServicePath } from './service-pages.mjs';
import {
    pageNeedsCalendly,
    postProcessSection,
} from './service-html-normalize.mjs';
import {
    renderVisibilityStrategyBody,
    renderVisibilityStrategyHero,
} from './service-page-visibility.mjs';
import {
    extractFaqsFromHtml,
    faqsForPath,
    htmlHasVisibleFaq,
    renderFaqSchemaOnly,
    renderFaqSection,
} from './seo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'service-pages.json');

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
        return `                        <a class="ld-btn" href="/contact/"${lpEvent('service_hero_cta')}>Let's Chat!</a>`;
    }

    return buttons
        .map((button, index) => {
            const href = button.href.startsWith('http') ? button.href : button.href || '/contact/';
            const external =
                href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
            const track =
                !href.startsWith('http') && href.includes('contact')
                    ? lpEvent('service_hero_cta')
                    : href.includes('calendly') || href.includes('strategy')
                      ? lpEvent('strategy_session_click')
                      : '';
            const ghost = index > 0 ? ' ld-btn--ghost' : '';
            return `                        <a class="ld-btn${ghost}" href="${escapeHtml(href)}"${external}${track}>${escapeHtml(button.text)}</a>`;
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

function renderSections(sections, slug) {
    return sections
        .map(
            (section, index) => `        <section class="service-section section--navy${index % 2 ? ' service-section--alt' : ''}">
            <div class="container">
                <div class="service-section__content">${postProcessSection(section, { slug })}</div>
            </div>
        </section>`
        )
        .join('\n');
}

function isClosingContactSection(html) {
    if (/ld-accordion/i.test(html)) return false;
    if (/calendly\.com/i.test(html)) return false;
    if (/ld-card-num|ld-pricing-card|ld-process-step|ld-team-card/i.test(html)) return false;
    const hasHeading = /<h2[\s\S]*?<\/h2>/i.test(html);
    const hasText = /ld-widget-text/i.test(html);
    const hasFormOrButton = /<form[\s\S]*?<\/form>/i.test(html) || /ld-widget-button/i.test(html);
    return hasHeading && hasText && hasFormOrButton;
}

function recoverContactIntroFromImport(slug) {
    const file = path.join(ROOT, '_import', 'simply-static-new', slug, 'index.html');
    if (!fs.existsSync(file)) return null;
    const html = fs.readFileSync(file, 'utf8');
    const idx = html.search(/\bid=["']contact["']/i);
    if (idx < 0) return null;
    const chunk = html.slice(idx, idx + 6000);
    const titleMatch = chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (!titleMatch) return null;
    const title = titleMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const textMatch = chunk.match(/elementor-widget-text-editor[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>/i);
    let copy = textMatch ? textMatch[1].trim() : '';
    if (copy && !/<p[\s>]/i.test(copy)) copy = `<p>${copy}</p>`;
    const btnMatch = chunk.match(/elementor-button-text">([^<]+)</i);
    return {
        title,
        copy: copy || '<p>Tell us what you are building and we will help you figure out the best next step.</p>',
        buttonHref: '/contact/',
        buttonText: btnMatch ? btnMatch[1].trim() : 'Book A Call With Me',
    };
}

function extractContactIntro(sectionHtml) {
    const titleMatch = sectionHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const title = titleMatch
        ? titleMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : 'Ready to get started?';

    const textMatch = sectionHtml.match(/<div class="ld-widget-text"><div>([\s\S]*?)<\/div><\/div>/i);
    let copy = textMatch ? textMatch[1].trim() : '';
    if (copy && !/<p[\s>]/i.test(copy)) {
        copy = `<p>${copy}</p>`;
    }
    if (!copy) {
        copy = '<p>Tell us what you are building and we will help you figure out the best next step.</p>';
    }

    const btnMatch = sectionHtml.match(/<a class="ld-btn"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    const buttonHref = btnMatch?.[1] || '/contact/';
    const buttonText = btnMatch
        ? btnMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : 'Book A Call With Me';

    return { title, copy, buttonHref, buttonText };
}

function renderContactCta(depth, intro = {}) {
    const title = intro.title || 'Ready to get started?';
    const copy = intro.copy || '<p>Tell us what you are building and we will help you figure out the best next step.</p>';
    const buttonHref = intro.buttonHref || '/contact/';
    const buttonText = intro.buttonText || 'Book A Call With Me';

    return `        <section class="contact section--navy" aria-labelledby="service-contact-heading">
            <div class="container">
                <div class="contact__panel">
                    <div class="contact__intro">
                        <h2 class="contact__title" id="service-contact-heading">${escapeHtml(title)}</h2>
                        <div class="contact__copy">
                            ${copy}
                        </div>
                        <a class="ld-btn" href="${escapeHtml(buttonHref)}"${lpEvent('service_contact_cta')}>${escapeHtml(buttonText)}</a>
                    </div>
                    <form class="contact-form lp-form" id="contact" method="post" action="/thank-you/" data-lp-form="contact" aria-label="Service contact form">
                        <input type="text" name="website" class="contact-form__honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">
                        <p class="contact-form__status" data-lp-form-message hidden></p>
                        <div class="contact-form__field">
                            <label for="service-contact-email">Email</label>
                            <input type="email" id="service-contact-email" name="email" placeholder="Email" required autocomplete="email">
                        </div>
                        <div class="contact-form__field">
                            <label for="service-contact-message">Message</label>
                            <textarea id="service-contact-message" name="message" rows="4" placeholder="Message"></textarea>
                        </div>
                        <button class="ld-btn" type="submit"${lpEvent('service_form_submit')}>Send A Message (I'll respond!)</button>
                    </form>
                </div>
            </div>
        </section>`;
}

function renderServicePage(page, depth) {
    const prefix = assetPrefix(depth);
    const isVisibilityPage = page.slug === 'free-website-visibility-strategy-session';
    const sections = [...page.sections];
    let contactIntro = null;
    if (sections.length && isClosingContactSection(sections[sections.length - 1])) {
        contactIntro = extractContactIntro(sections.pop());
    } else if (!isVisibilityPage) {
        contactIntro = recoverContactIntroFromImport(page.slug);
    }
    const bodySections = isVisibilityPage ? renderVisibilityStrategyBody(depth) : renderSections(sections, page.slug);
    const heroSection = isVisibilityPage ? renderVisibilityStrategyHero(page) : renderHero(page, depth);
    const needsCalendly = !isVisibilityPage && pageNeedsCalendly(page.sections);
    const extraScripts = isVisibilityPage || needsCalendly
        ? `\n    <script src="https://assets.calendly.com/assets/external/widget.js" async></script>`
        : '';

    const extracted = extractFaqsFromHtml(`${bodySections}`);
    const faqs = faqsForPath(page.path, extracted);
    const faqBlock = htmlHasVisibleFaq(bodySections)
        ? renderFaqSchemaOnly(extracted.length ? extracted : faqs)
        : renderFaqSection(faqs);

    return `${renderHead({
        title: `${escapeHtml(page.seoTitle || page.title)} | Leanne Digital`,
        description: escapeHtml(page.description || page.title),
        depth,
        extraCss: ['services.css', 'service-page.css', 'contact.css'],
        canonical: `${SITE_URL}${page.path}`,
        path: page.path,
    })}
<body class="page-inner">
${renderNav(depth, page.path)}
    <main id="main">
${heroSection}
${bodySections}
${faqBlock}
${isVisibilityPage || needsCalendly ? '' : renderContactCta(depth, contactIntro)}
    </main>
${renderFullFooter(depth)}
${renderPageScripts(depth, extraScripts)}
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
