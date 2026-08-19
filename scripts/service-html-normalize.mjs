/** Normalize Elementor markup into layout classes the static CSS understands. */

export const DEFAULT_CALENDLY_URL = 'https://calendly.com/leannedigitaldesign/30min?primary_color=4ec3cc';

const CALENDLY_BY_SLUG = {
    'free-website-visibility-strategy-session':
        'https://calendly.com/leannedigitaldesign/free-website-strategy-call?primary_color=4ec3cc',
};

const ICON_CLASS_PATTERN = /\s(e-f(?:a[rs]|ab|al|ad)-[a-z0-9-]+)\b/i;

function iconNameFromSvgAttrs(svgAttrs) {
    const match = svgAttrs.match(ICON_CLASS_PATTERN);
    if (!match) return 'circle';
    return match[1].replace(/^e-f(?:a[rs]|ab|al|ad)-/, '');
}

function simplifyIconSvg(svg) {
    const viewBox = svg.match(/viewBox="([^"]+)"/i)?.[1] || '0 0 512 512';
    const path = svg.match(/<path[^>]*\sd="([^"]+)"/i)?.[1];
    if (!path) return svg;
    return `<svg viewBox="${viewBox}" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;
}

function wrapIconSvg(svg) {
    const openTag = svg.match(/^<svg[^>]*>/i)?.[0] || '';
    const name = iconNameFromSvgAttrs(openTag);
    return `<span class="ld-icon ld-icon--${name}" aria-hidden="true">${simplifyIconSvg(svg)}</span>`;
}

function preserveIconListIcons(html) {
    return html.replace(
        /<span class="elementor-icon-list-icon">\s*(<svg[\s\S]*?<\/svg>)\s*<\/span>/gi,
        (_, svg) => wrapIconSvg(svg)
    );
}

function preserveIconWidgets(html) {
    return html.replace(
        /<div class="elementor-icon">\s*(<svg[\s\S]*?<\/svg>)\s*<\/div>/gi,
        (_, svg) => `<div class="elementor-icon">${wrapIconSvg(svg)}</div>`
    );
}

function stripLeftoverSvgs(html) {
    const saved = [];
    const withPlaceholders = html.replace(
        /<span class="ld-icon[^"]*"[^>]*>[\s\S]*?<\/span>/gi,
        (match) => {
            saved.push(match);
            return `{{LDICON:${saved.length - 1}}}`;
        }
    );
    const stripped = withPlaceholders.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    return stripped.replace(/\{\{LDICON:(\d+)\}\}/g, (_, index) => saved[Number(index)]);
}

function markProblemCards(html) {
    return html.replace(
        /<div class="(elementor-element[^"]*e-con-full[^"]*)"([^>]*data-settings="[^"]*background_background[^"]*classic[^"]*"[^>]*)>/gi,
        '<div class="$1 ld-problem-card"$2>'
    );
}

function tagProblemCardMeta(html) {
    return html.replace(
        /<div class="ld-icon-list(?: ld-icon-list--checks)?"><div><ul><li>(<span class="ld-icon[^"]*"[^>]*>[\s\S]*?<\/span>)<span>(\d{2})<\/span><\/li><\/ul><\/div><\/div>/gi,
        '<div class="ld-card-meta"><div><ul><li>$1<span class="ld-card-num">$2</span></li></ul></div></div>'
    );
}

function flattenButtonMarkup(html) {
    return html.replace(/<a class="ld-btn"([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, inner) => {
        const text = inner.replace(/<\/?(?:span|strong|em|b|i)[^>]*>/gi, '').trim();
        return `<a class="ld-btn"${attrs}>${text}</a>`;
    });
}

function isInternalHref(href) {
    const value = (href || '').trim();
    if (!value) return false;
    if (value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:')) return false;
    if (/^https?:\/\//i.test(value)) return /leannedigital\.com/i.test(value);
    return value.startsWith('/');
}

export function unwrapInternalLinksInHeadings(html) {
    return html.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, level, attrs, inner) => {
        const unwrapped = inner.replace(/<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi, (link, linkAttrs, text) => {
            const href = linkAttrs.match(/href="([^"]*)"/i)?.[1] || '';
            return isInternalHref(href) ? text : link;
        });
        return `<h${level}${attrs}>${unwrapped}</h${level}>`;
    });
}

function removeEmptyColumns(html) {
    return html.replace(/<div class="ld-col">\s*<div>\s*<div>\s*<\/div>\s*<\/div>\s*<\/div>/gi, '');
}

function tagChecklists(html) {
    return html.replace(
        /<div class="ld-icon-list"><div><ul>((?:<li>[\s\S]*?<\/li>){2,})<\/ul><\/div><\/div>/gi,
        (full, items) => {
            const labels = [...items.matchAll(/<li>[\s\S]*?<span>([^<]*)<\/span><\/li>/g)].map((match) =>
                match[1].trim()
            );
            if (labels.length && labels.every((label) => /^\d{2}$/.test(label))) return full;
            return `<div class="ld-icon-list ld-icon-list--checks"><div><ul>${items}</ul></div></div>`;
        }
    );
}

export function mapElementorClasses(classStr) {
    const classes = classStr.split(/\s+/).filter(Boolean);
    const mapped = new Set();
    const has = (token) => classes.some((name) => name === token || name.includes(token));

    if (has('elementor-widget-heading')) mapped.add('ld-widget-heading');
    if (has('elementor-widget-text-editor')) mapped.add('ld-widget-text');
    if (has('elementor-widget-image')) mapped.add('ld-widget-image');
    if (has('elementor-widget-icon-list')) mapped.add('ld-icon-list');
    else if (classes.some((name) => name === 'elementor-widget-icon')) mapped.add('ld-widget-icon');
    if (has('elementor-widget-icon-box')) mapped.add('ld-icon-card');
    if (has('elementor-widget-icon-list')) mapped.add('ld-icon-list');
    if (has('elementor-widget-button')) mapped.add('ld-widget-button');
    if (has('elementor-button-link')) mapped.add('ld-btn');
    if (has('gallery')) mapped.add('ld-gallery');
    if (has('elementor-widget-n-accordion') || has('e-n-accordion')) mapped.add('ld-accordion');
    if (has('e-grid')) mapped.add('ld-grid');

    if (has('e-con-inner')) mapped.add('ld-section-inner');
    else if (has('e-parent') || (has('e-con') && has('e-con-boxed'))) mapped.add('ld-section');
    else if (has('e-child') || has('e-con-full')) mapped.add('ld-col');

    return [...mapped].join(' ');
}

export function normalizeElementorClasses(html) {
    return html.replace(/\sclass="([^"]*)"/gi, (_, classStr) => {
        const classes = classStr.split(/\s+/).filter(Boolean);
        const utilities = classes.filter(
            (name) =>
                name === 'service-accent' ||
                name === 'ld-text-center' ||
                name === 'ld-problem-card' ||
                name.startsWith('ld-icon') ||
                name === 'client-report-table' ||
                name === 'client-report-badge'
        );
        const mapped = mapElementorClasses(classStr);
        const combined = [...utilities, ...(mapped ? mapped.split(/\s+/).filter(Boolean) : [])];
        return combined.length ? ` class="${combined.join(' ')}"` : '';
    });
}

export function normalizeServiceHtml(html) {
    let output = html;

    output = preserveIconListIcons(output);
    output = preserveIconWidgets(output);
    output = markProblemCards(output);
    output = output.replace(/<p style="text-align:\s*center;?[^"]*"/gi, '<p class="ld-text-center"');
    output = output.replace(/<span style="color:\s*#4EC3CC[^"]*">/gi, '<span class="service-accent">');
    output = output.replace(/<span style="color:\s*#4ec3cc[^"]*">/gi, '<span class="service-accent">');
    output = output.replace(/<strong style="color:\s*#4ec3cc[^"]*">/gi, '<strong class="service-accent">');
    output = output.replace(/<!--[\s\S]*?-->/g, '');

    output = normalizeElementorClasses(output);

    output = output.replace(/\sdata-[a-z0-9_-]+="[^"]*"/gi, '');
    output = output.replace(/\s(srcset|sizes|fetchpriority|decoding|loading|style)="[^"]*"/gi, '');
    output = stripLeftoverSvgs(output);

    output = output.replace(
        /<a([^>]*)\sclass="[^"]*elementor-button[^"]*"([^>]*?)>/gi,
        '<a class="ld-btn"$1$2>'
    );
    output = output.replace(/<a role="button"([^>]*)>/gi, '<a class="ld-btn" href="#contact"$1>');
    output = output.replace(/<a class="ld-btn"([^>]*)\sclass="ld-btn"/gi, '<a class="ld-btn"$1');

    output = output.replace(/https:\/\/leannedigital\.com/g, '');
    output = output.replace(/href="\/contact"/gi, 'href="/contact/"');
    output = output.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
    output = output.replace(/\s+/g, ' ');
    output = output.replace(/>\s+</g, '><');
    output = output.replace(/<p><\/p>/g, '');
    while (output.includes('<div></div>')) {
        output = output.replace(/<div><\/div>/g, '');
    }

    output = tagProblemCardMeta(output);
    output = tagChecklists(output);
    output = flattenButtonMarkup(output);

    return output.trim();
}

export function renderCalendlyWidget(url = DEFAULT_CALENDLY_URL) {
    return `<div class="calendly-inline-widget service-booking__widget" data-url="${url}" style="min-width:320px;height:700px;"></div>`;
}

function isCenteredIntroSection(html) {
    return (
        html.includes('ld-section-inner') &&
        !html.includes('ld-col') &&
        html.includes('ld-widget-text') &&
        html.includes('ld-widget-heading') &&
        !html.includes('ld-icon-card') &&
        !html.includes('ld-accordion') &&
        !html.includes('calendly-inline-widget')
    );
}

function tagCenteredIntroColumns(html) {
    return html.replace(
        '<div class="ld-col"><div class="ld-widget-heading"><div><h2>Storytelling Through Design</h2>',
        '<div class="ld-col ld-col--centered-intro"><div class="ld-widget-heading"><div><h2>Storytelling Through Design</h2>'
    );
}

function tagReviewsBlock(html) {
    if (!/What People are saying about working with us/i.test(html)) return html;

    let output = html.replace(
        '<div class="ld-problem-card ld-section"><div class="ld-col"><div class="ld-widget-heading"><div><h2>What People are saying about working with us</h2>',
        '<div class="ld-reviews"><div class="ld-col"><div class="ld-widget-heading"><div><h2>What People are saying about working with us</h2>'
    );

    output = output.replace(
        /<div class="ld-problem-card ld-col">(?=<div class="ld-widget-image"><div><img[^>]*teal-stars)/g,
        '<div class="ld-problem-card ld-col ld-review-card">'
    );

    return output;
}

function isBeliefSection(html) {
    return /actually performs/i.test(html) && /Or the opposite/i.test(html);
}

function tagBeliefLayout() {
    return `<div class="ld-section"><div class="ld-section-inner ld-section-inner--belief">
                <p>We believe businesses should not have to choose between a beautiful website and one that actually performs.</p>
                <p>Too often, we see websites that look amazing but are slow, hard to use, confusing, and never get found online.</p>
                <p><span class="service-accent">Or the opposite</span></p>
                <p>A website that is technically optimized for Google but feels generic, overwhelming, or disconnected from the business behind it.</p>
                <h2>We believe you deserve <span>both.</span></h2>
                <p>A website that feels like you, builds trust, loads quickly, is easy to navigate, and helps people actually find your business.</p>
            </div></div>`;
}

function isCenteredWideSection(html) {
    return /Branding and Visual Identity/i.test(html) && /That People Remember/i.test(html);
}

function isProblemSection(html) {
    return /The problem/i.test(html) && /ld-card-num|ld-card-meta|\b0[1-6]\b/.test(html);
}

function isWhyUsSection(html) {
    return /Why Us/i.test(html) && /We Combine Branding/i.test(html) && /Why We Use WordPress/i.test(html);
}

function isOfferSection(html) {
    return (
        /What We Offer/i.test(html) &&
        /Custom Website Design/i.test(html) &&
        /Ecommerce Integration/i.test(html)
    );
}

function tagProcessSteps(html) {
    return html.replace(/<div class="ld-problem-card ld-col">/g, '<div class="ld-problem-card ld-col ld-process-step">');
}

function isProcessSection(html) {
    return (
        /Our Website Design Process/i.test(html) &&
        /Discovery &amp; Strategy|Discovery & Strategy/i.test(html) &&
        /Launch, Support/i.test(html)
    );
}

function tagTeamCards(html) {
    return html.replace(
        /<div class="ld-problem-card ld-col"><div class="ld-widget-image">/g,
        '<div class="ld-problem-card ld-col ld-team-card"><div class="ld-widget-image">'
    );
}

function isTeamSection(html) {
    return (
        /Our Team/i.test(html) &&
        /Leanne Jones/i.test(html) &&
        /Gary Burns/i.test(html) &&
        /The creative side/i.test(html)
    );
}

function isWhoWeAreSection(html) {
    return /Who We Are/i.test(html) && /Proudly Indigenous/i.test(html);
}

function isFaqSection(html) {
    return /Frequently Asked Questions/i.test(html) && /ld-accordion/i.test(html);
}

function isPricingSection(html) {
    const isSecurity =
        /Choose the Right Security Package/i.test(html) &&
        /Starter/i.test(html) &&
        /Pro Plans/i.test(html) &&
        /Expert/i.test(html);
    const isWebsitePackages =
        /Choose the Right Website Package/i.test(html) &&
        /Static Website/i.test(html) &&
        /AI Managed/i.test(html);
    return isSecurity || isWebsitePackages;
}

function isAiPlatformsSection(html) {
    return /Optimized for Today.s AI Platforms/i.test(html);
}

function isSeoFoundationSection(html) {
    return /Built on a Strong/i.test(html) && /Keyword and topic alignment/i.test(html);
}

function isOrgCardsSection(html) {
    return /Supporting Indigenous Organizations Across Canada/i.test(html) && /Friendship Centres/i.test(html);
}

function isTrustSection(html) {
    return /ldd-trust\.png/i.test(html);
}

function tagPricingCards(html) {
    return html
        .replaceAll(
            '<div class="ld-problem-card ld-col">',
            '<div class="ld-problem-card ld-col ld-pricing-card">'
        )
        .replace(
            '<div class="ld-problem-card ld-col ld-pricing-card"><div class="ld-widget-heading"><div><h2>Pro Plans</h2>',
            '<div class="ld-problem-card ld-col ld-pricing-card ld-pricing-card--featured"><div class="ld-widget-heading"><div><h2>Pro Plans</h2>'
        )
        .replace(
            '<div class="ld-problem-card ld-col ld-pricing-card"><div class="ld-widget-heading"><div><h2>AI Managed</h2>',
            '<div class="ld-problem-card ld-col ld-pricing-card ld-pricing-card--featured"><div class="ld-widget-heading"><div><h2>AI Managed</h2>'
        );
}

export function postProcessSection(section, { slug } = {}) {
    let output = unwrapInternalLinksInHeadings(flattenButtonMarkup(section));
    output = tagProblemCardMeta(output);
    output = tagChecklists(output);
    const calendlyUrl = CALENDLY_BY_SLUG[slug] || DEFAULT_CALENDLY_URL;

    output = output.replace(/<form[\s\S]*?<\/form>/gi, (formHtml) => {
        if (/calendly/i.test(formHtml)) return formHtml;
        if (/ld-widget-button/i.test(output)) return '';
        return '<div class="ld-widget-button"><a class="ld-btn" href="/contact/">Book A Call With Me</a></div>';
    });

    if (/calendly\.com/i.test(output)) {
        output = output.replace(/<script[^>]*calendly[^>]*><\/script>/gi, '');
        output = output.replace(
            /<div class="ld-col">\s*<div>\s*<div>\s*<\/div>\s*<\/div>\s*<\/div>/gi,
            `<div class="ld-col ld-col--calendly">${renderCalendlyWidget(calendlyUrl)}</div>`
        );

        if (!output.includes('calendly-inline-widget')) {
            output = `${output}<div class="ld-col ld-col--calendly">${renderCalendlyWidget(calendlyUrl)}</div>`;
        }

        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--booking">'
        );
    } else if (isTrustSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--trust">'
        );
        output = output.replace(
            /src="\/assets\/images\/services\/ldd-trust\.png" alt=""/,
            'src="/assets/images/services/ldd-trust.webp" alt="Canadian Council for Indigenous Business, CCIB Certified Indigenous Business, The Winnipeg Chamber of Commerce, and Google Reviews"'
        );
    } else if (isBeliefSection(output)) {
        output = tagBeliefLayout();
    } else if (isCenteredWideSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--centered ld-section-inner--centered-wide">'
        );
    } else if (isCenteredIntroSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--centered">'
        );
    } else if (isProblemSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--problem">'
        );
    } else if (isWhyUsSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--why-us">'
        );
    } else if (isOfferSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--offer">'
        );
    } else if (isProcessSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--process">'
        );
        output = tagProcessSteps(output);
    } else if (isTeamSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--team">'
        );
        output = tagTeamCards(output);
    } else if (isWhoWeAreSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--who-we-are">'
        );
    } else if (isFaqSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--faq">'
        );
    } else if (isAiPlatformsSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--ai-platforms">'
        );
    } else if (isSeoFoundationSection(output) || isOrgCardsSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--seo-foundation">'
        );
    } else if (isPricingSection(output)) {
        output = output.replace(
            /<div class="ld-section-inner">/,
            '<div class="ld-section-inner ld-section-inner--pricing">'
        );
        output = tagPricingCards(output);
    }

    output = removeEmptyColumns(output);
    output = tagCenteredIntroColumns(output);
    output = tagReviewsBlock(output);

    if (!/\bld-section\b/.test(output.slice(0, 120))) {
        output = `<div class="ld-section">${output}</div>`;
    }

    return output;
}

export function pageNeedsCalendly(sections) {
    return sections.some((section) => /calendly\.com/i.test(section));
}
