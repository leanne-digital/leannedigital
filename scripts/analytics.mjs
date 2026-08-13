import { LILIPADD } from './site-config.mjs';

/**
 * Lilipadd loader. Publish still replaces __PLATFORM_URL__ and __SITE_KEY__.
 * If those tokens go live unreplaced, fall back to the production hub instead of
 * requesting a relative "__PLATFORM_URL__" path (which 404s and breaks login).
 */
export function renderLilipaddSnippet() {
    const fallbackUrl = LILIPADD.platformUrl;
    const fallbackKey = LILIPADD.siteKey;
    return `    <script data-key="__SITE_KEY__">
    (function () {
        var url = "__PLATFORM_URL__";
        var key = (document.currentScript && document.currentScript.getAttribute("data-key")) || "";
        if (!/^https?:/i.test(url)) url = ${JSON.stringify(fallbackUrl)};
        if (!/^lp_/.test(key)) key = ${JSON.stringify(fallbackKey)};
        if (!key) return;
        var script = document.createElement("script");
        script.src = url;
        script.setAttribute("data-key", key);
        script.defer = true;
        document.head.appendChild(script);
    })();
    </script>`;
}

/** data-lp-event attribute for conversion tracking. */
export function lpEvent(name) {
    return name ? ` data-lp-event="${name}"` : '';
}
