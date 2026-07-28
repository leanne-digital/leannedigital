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

function preserveIconListIcons(html) {
    return html.replace(
        /<span class="elementor-icon-list-icon">\s*<svg([^>]*)>[\s\S]*?<\/svg>\s*<\/span>/gi,
        (_, svgAttrs) => {
            const name = iconNameFromSvgAttrs(svgAttrs);
            return `<span class="ld-icon ld-icon--${name}" aria-hidden="true"></span>`;
        }
    );
}

function preserveIconWidgets(html) {
    return html.replace(
        /<div class="elementor-icon">\s*<svg([^>]*)>[\s\S]*?<\/svg>\s*<\/div>/gi,
        (_, svgAttrs) => {
            const name = iconNameFromSvgAttrs(svgAttrs);
            return `<div class="elementor-icon"><span class="ld-icon ld-icon--${name}" aria-hidden="true"></span></div>`;
        }
    );
}

function markProblemCards(html) {
    return html.replace(
        /<div class="(elementor-element[^"]*e-con-full[^"]*)"([^>]*data-settings="[^"]*background_background[^"]*classic[^"]*"[^>]*)>/gi,
        '<div class="$1 ld-problem-card"$2>'
    );
}

function tagProblemCardMeta(html) {
    return html.replace(
        /<div class="ld-icon-list"><div><ul><li><span class="(ld-icon[^"]*)"[^>]*><\/span><span>(\d{2})<\/span><\/li><\/ul><\/div><\/div>/gi,
        '<div class="ld-card-meta"><div><ul><li><span class="$1" aria-hidden="true"></span><span class="ld-card-num">$2</span></li></ul></div></div>'
    );
}

function tagChecklists(html) {
    return html.replace(
        /<div class="ld-icon-list"><div><ul>((?:<li>[\s\S]*?<\/li>){2,})<\/ul><\/div><\/div>/gi,
        '<div class="ld-icon-list ld-icon-list--checks"><div><ul>$1</ul></div></div>'
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
                name.startsWith('ld-icon')
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
    output = output.replace(/<svg[\s\S]*?<\/svg>/gi, '');

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

export function postProcessSection(section, { slug } = {}) {
    let output = section;
    const calendlyUrl = CALENDLY_BY_SLUG[slug] || DEFAULT_CALENDLY_URL;

    output = output.replace(/<form[\s\S]*?<\/form>/gi, (formHtml) => {
        if (/calendly/i.test(formHtml)) return formHtml;
        return '<p class="service-section__cta"><a class="ld-btn" href="/contact/">Book A Call With Me</a></p>';
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
    }

    if (!/\bld-section\b/.test(output.slice(0, 120))) {
        output = `<div class="ld-section">${output}</div>`;
    }

    return output;
}

export function pageNeedsCalendly(sections) {
    return sections.some((section) => /calendly\.com/i.test(section));
}
