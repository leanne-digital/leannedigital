/** Keep public inquiry forms on the website's SMTP backend. */
export function normalizeContactForms(html) {
    let found = false;
    let out = html.replace(/<form\b([^>]*\bclass="[^"]*\bcontact-form\b[^"]*"[^>]*)>([\s\S]*?)<\/form>/gi, (_match, attrs, body) => {
        found = true;
        let next = attrs
            .replace(/\sdata-lp-form="[^"]*"/g, '')
            .replace(/\sdata-contact-backend="[^"]*"/g, '')
            .replace(/\saction="[^"]*"/g, '')
            .replace(/\smethod="[^"]*"/g, '')
            .replace(/class="([^"]*)"/, (_class, value) => `class="${value.split(/\s+/).filter((name) => name !== 'lp-form').join(' ')}"`);
        body = body.replace(/data-lp-form-message/g, 'data-form-status')
            .replace(/name="(?:website|company_website)"/g, 'name="_honey"');
        return `<form${next} action="/api/contact" method="post" data-contact-backend="smtp">${body}</form>`;
    });
    if (!found) return html;
    out = out.replace(/\s*<script[^>]*\bsrc="[^"]*contact-form\.js[^"]*"[^>]*>\s*<\/script>/gi, '');
    return out.replace(/<\/body>/i, '    <script src="/js/contact-form.js?v=smtp-2" defer></script>\n</body>');
}
