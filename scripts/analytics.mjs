/** Lilipadd platform loader — publish replaces the placeholders. */
export function renderLilipaddSnippet() {
    return `    <script src="__PLATFORM_URL__" data-key="__SITE_KEY__" defer></script>`;
}

/** data-lp-event attribute for conversion tracking. */
export function lpEvent(name) {
    return name ? ` data-lp-event="${name}"` : '';
}
