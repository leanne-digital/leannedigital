/** Normalize Elementor markup into layout classes the static CSS understands. */

export const DEFAULT_CALENDLY_URL = 'https://calendly.com/leannedigitaldesign/30min?primary_color=4ec3cc';

const CALENDLY_BY_SLUG = {
    'free-website-visibility-strategy-session':
        'https://calendly.com/leannedigitaldesign/free-website-strategy-call?primary_color=4ec3cc',
};

export function mapElementorClasses(classStr) {
    const classes = classStr.split(/\s+/).filter(Boolean);
    const mapped = new Set();
    const has = (token) => classes.some((name) => name === token || name.includes(token));

    if (has('elementor-widget-heading')) mapped.add('ld-widget-heading');
    if (has('elementor-widget-text-editor')) mapped.add('ld-widget-text');
    if (has('elementor-widget-image')) mapped.add('ld-widget-image');
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
        const mapped = mapElementorClasses(classStr);
        return mapped ? ` class="${mapped}"` : '';
    });
}

export function normalizeServiceHtml(html) {
    let output = html;

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
    output = output.replace(/<div><\/div>/g, '');

    return output.trim();
}

export function renderCalendlyWidget(url = DEFAULT_CALENDLY_URL) {
    return `<div class="calendly-inline-widget service-booking__widget" data-url="${url}" style="min-width:320px;height:700px;"></div>`;
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
    }

    if (!output.startsWith('<div class="ld-section"')) {
        output = `<div class="ld-section">${output}</div>`;
    }

    return output;
}

export function pageNeedsCalendly(sections) {
    return sections.some((section) => /calendly\.com/i.test(section));
}
