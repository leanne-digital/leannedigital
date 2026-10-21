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
        next = next.replace(/[ \t]+(?=\r?\n)/g, '').trimEnd();
        body = body.replace(/data-lp-form-message/g, 'data-form-status')
            .replace(/name="(?:website|company_website)"/g, 'name="_honey"');
        if (!/name="name"/.test(body)) {
            body = `<div class="contact-form__field"><label for="inquiry-name">Name</label><input type="text" id="inquiry-name" name="name" required autocomplete="name" maxlength="120"></div>${body}`;
        }
        if (!/name="service"/.test(body)) {
            body = body.replace(/(<div class="contact-form__field">\s*<label[^>]*>Message<\/label>)/i,
                `<div class="contact-form__field"><label for="inquiry-service">Service</label><select id="inquiry-service" name="service" required><option value="">Select a service</option>${['Web Design', 'Graphic Design', 'SEO Strategy and Marketing', 'Website Maintenance', 'Custom Application', 'Other'].map(value => `<option value="${value}">${value}</option>`).join('')}</select></div>$1`);
        }
        body = body.replace(/<(?:input|textarea|select)\b[^>]*\bname="(?:name|email|message|service)"[^>]*>/gi,
            tag => /\srequired(?:\s|>|=)/i.test(tag) ? tag : tag.replace(/>$/, ' required>'));
        body = body.replace(/(<select\b[^>]*name="service"[^>]*>)([\s\S]*?)(<\/select>)/gi,
            (_match, open, options, close) => {
                for (const service of ['Speaking Engagements', 'AI and Automations']) {
                    if (!options.includes(`value="${service}"`)) options = options.replace(/<option value="Other">/, `<option value="${service}">${service}</option><option value="Other">`);
                }
                return open + (/value=""/.test(options) ? '' : '<option value="">Select a service</option>') + options + close;
            });
        if (!/name="companyName"/.test(body)) {
            body = body.replace(/(<div class="contact-form__field">\s*<label[^>]*>[^<]*<\/label>\s*<select\b[^>]*name="service")/i,
                '<div class="contact-form__field" style="grid-column: 1 / -1"><label for="inquiry-company">Company Name (Optional)</label><input type="text" id="inquiry-company" name="companyName" maxlength="200" autocomplete="organization"></div><div class="contact-form__field" style="grid-column: 1 / -1"><label for="inquiry-website">Current Website (Optional)</label><input type="text" inputmode="url" id="inquiry-website" name="currentWebsite" maxlength="500" autocomplete="url" placeholder="example.com"></div>$1');
        }
        if (!/name="_honey"/.test(body)) {
            body = `<input type="text" name="_honey" class="contact-form__honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">${body}`;
        }
        return `<form${next} action="/api/contact" method="post" data-contact-backend="smtp">${body}</form>`;
    });
    if (!found) return html;
    out = out.replace(/\s*<script[^>]*\bsrc="[^"]*contact-form\.js[^"]*"[^>]*>\s*<\/script>/gi, '');
    return out.replace(/<\/body>/i, '    <script src="/js/contact-form.js?v=smtp-4" defer></script>\n</body>');
}
