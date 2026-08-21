import { PRIMARY_NAV, SERVICE_LINKS, SITE_URL } from './site-config.mjs';
import { renderFavicons } from './favicons.mjs';
import { lpEvent, renderLilipaddSnippet } from './analytics.mjs';
import { renderSeoBlock } from './seo.mjs';

export function assetPrefix(depth) {
    return depth === 0 ? '' : '../'.repeat(depth);
}

export function renderNav(depth, currentPath) {
    const prefix = assetPrefix(depth);

    const items = PRIMARY_NAV.map((item) => {
        if (item.type === 'services') {
            const links = SERVICE_LINKS.map(
                (link) =>
                    `                    <li><a href="${link.path}"${currentPath === link.path ? ' aria-current="page"' : ''}>${link.title}</a></li>`
            ).join('\n');
            return `                <li class="site-nav__item site-nav__item--has-menu">
                    <button type="button" class="site-nav__trigger" aria-expanded="false" aria-haspopup="true">
                        ${item.title}
                        <svg class="site-nav__chevron" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M2.5 4.5 6 8l3.5-3.5"/></svg>
                    </button>
                    <ul class="site-nav__submenu">
${links}
                    </ul>
                </li>`;
        }
        const current = currentPath === item.path ? ' aria-current="page"' : '';
        return `                <li class="site-nav__item"><a href="${item.path}"${current}>${item.title}</a></li>`;
    }).join('\n');

    return `    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
        <div class="container site-header__inner">
            <a class="site-logo" href="/" aria-label="Leanne Digital home">
                <img
                    class="site-logo__image"
                    src="${prefix}assets/images/brand/leanne-digital-logo-white.webp"
                    alt="Leanne Digital"
                    width="184"
                    height="52"
                >
            </a>
            <button type="button" class="site-nav__toggle" aria-expanded="false" aria-controls="primary-nav" aria-label="Open menu">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <nav class="site-nav" id="primary-nav" aria-label="Primary">
                <ul class="site-nav__list">
${items}
                </ul>
            </nav>
        </div>
    </header>`;
}

export function renderFullFooter(depth) {
    const prefix = assetPrefix(depth);
    return `    <footer class="site-footer">
        <div class="site-footer__main">
            <div class="container site-footer__grid">
                <div class="site-footer__brand-col">
                    <a href="/" aria-label="Leanne Digital home">
                        <img src="${prefix}assets/images/brand/leanne-digital-logo-white.webp" alt="Leanne Digital" width="184" height="52" loading="lazy">
                    </a>
                    <p class="site-footer__about">Leanne Digital, formerly Leanne Digital Design, is an Indigenous-owned brand and digital marketing agency based in Winnipeg, Manitoba, on Treaty 1 territory. We help businesses and Indigenous organizations build strong, beautiful brands online and get them seen through website design, SEO, branding, and digital marketing support.</p>
                    <div class="site-footer__social">
                        <a href="https://www.facebook.com/Leanne.Digital" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                            <img src="${prefix}assets/images/social/facebook.svg" alt="" width="33" height="33">
                        </a>
                        <a href="https://www.linkedin.com/company/leanne-digital-design/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                            <img src="${prefix}assets/images/social/linkedin.svg" alt="" width="33" height="33">
                        </a>
                        <a href="https://www.instagram.com/leannedigitaldesign/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                            <img src="${prefix}assets/images/social/instagram.svg" alt="" width="32" height="33">
                        </a>
                    </div>
                    <a class="ld-btn" href="/contact/"${lpEvent('footer_contact_cta')}>CONTACT ME TODAY!</a>
                </div>
                <div class="site-footer__column">
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
                </div>
            </div>
        </div>
        <div class="site-footer__bar">
            <div class="container">
                Copyright &copy; ${new Date().getFullYear()} Leanne Digital |
                <a href="/privacy-policy/">Privacy Policy</a> |
                <a href="/sitemap/">Sitemap</a> |
                Powered by <a href="/">Leanne Digital</a>
            </div>
        </div>
    </footer>`;
}

export function renderHead({
    depth,
    extraCss = [],
    title = '',
    description = '',
    canonical = '',
    path = '',
    robots = 'index,follow',
    ogImage,
    schema,
}) {
    const prefix = assetPrefix(depth);
    const CSS_V = '20260820e';
    const cssLinks = [
        'tokens.css',
        'base.css',
        'header.css',
        'page-inner.css',
        'buttons.css',
        'faq.css',
        ...extraCss,
        'footer.css',
    ]
        .map((file) => `    <link rel="stylesheet" href="${prefix}css/${file}?v=${CSS_V}">`)
        .join('\n');
    const canonicalUrl = canonical || (path ? `${SITE_URL}${path === '/' ? '/' : path}` : '');
    const seo = title
        ? `${renderSeoBlock({
            title,
            description,
            canonical: canonicalUrl,
            robots,
            ogImage,
            schema,
        })}\n`
        : '';

    return `<!DOCTYPE html>
<html lang="en-CA">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- lp:seo -->
${seo}    <!-- lp:custom-head -->
${renderFavicons(prefix)}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Nunito:wght@700;800&family=Open+Sans:wght@400;700&display=swap" rel="stylesheet">
${cssLinks}
${renderLilipaddSnippet()}
</head>`;
}

export function renderPageScripts(depth, extra = '') {
    const prefix = assetPrefix(depth);
    return `    <script src="${prefix}js/site-nav.js" defer></script>
${extra}`;
}

export function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function formatDisplayDate(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    });
}
