(function () {
    const forms = document.querySelectorAll('form.contact-form');
    if (!forms.length) return;

    function statusEl(form) {
        let el = form.querySelector('[data-form-status]');
        if (!el) {
            el = document.createElement('p');
            el.className = 'contact-form__status';
            el.setAttribute('data-form-status', '');
            el.hidden = true;
            form.prepend(el);
        }
        return el;
    }

    function show(form, message, state) {
        const el = statusEl(form);
        el.hidden = !message;
        el.textContent = message || '';
        el.setAttribute('data-state', state || '');
    }

    function payloadFrom(form) {
        const data = new FormData(form);
        return {
            name: String(data.get('name') || '').trim(),
            email: String(data.get('email') || '').trim(),
            message: String(data.get('message') || '').trim(),
            service: String(data.get('service') || '').trim(),
            honey: String(data.get('_honey') || data.get('company_website') || ''),
            page: location.pathname,
        };
    }

    async function recaptchaToken() {
        const key = window.LD_RECAPTCHA_SITE_KEY;
        if (!key || typeof grecaptcha === 'undefined') return '';
        await new Promise((resolve) => grecaptcha.ready(resolve));
        return grecaptcha.execute(key, { action: 'contact' });
    }

    forms.forEach((form) => {
        if (!form.querySelector('[name="_honey"]') && !form.querySelector('[name="company_website"]')) {
            const honey = document.createElement('input');
            honey.type = 'text';
            honey.name = '_honey';
            honey.className = 'contact-form__honeypot';
            honey.tabIndex = -1;
            honey.autocomplete = 'off';
            honey.setAttribute('aria-hidden', 'true');
            form.prepend(honey);
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submit = form.querySelector('[type="submit"]');
            const payload = payloadFrom(form);
            show(form, '', '');
            if (submit) submit.disabled = true;
            try {
                payload.recaptchaToken = await recaptchaToken();
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Could not send your message.');
                show(form, data.message || 'Thanks — your message is on its way.', 'ok');
                form.reset();
            } catch (error) {
                show(form, error.message || 'Could not send your message.', 'error');
            } finally {
                if (submit) submit.disabled = false;
            }
        });
    });
})();
