(() => {
    const form = document.querySelector('[data-intake-form]');
    if (!form) return;
    const key = 'ld:mittohnee:draft:v1';
    const status = form.querySelector('[data-form-status]');
    const submit = form.querySelector('[type="submit"]');
    const websiteAddress = form.elements.websiteAddress;
    const domainFields = form.querySelectorAll('[data-domain-condition]');
    const websiteFields = form.querySelectorAll('[data-website-condition]');
    const offerFields = form.querySelectorAll('[data-offer-condition]');

    function normalizeWebsiteAddress(value) {
        const address = String(value || '').trim();
        if (!address || /^[a-z][a-z\d+.-]*:\/\//i.test(address)) return address;
        return `https://${address}`;
    }

    function updateDomainFields() {
        const selected = form.querySelector('[name="ownsDomain"]:checked')?.value || '';
        for (const field of domainFields) {
            const visible = field.dataset.domainCondition === selected;
            field.hidden = !visible;
            field.querySelector('input').disabled = !visible;
        }
    }

    function updateWebsiteFields() {
        const selected = form.querySelector('[name="hasWebsite"]:checked')?.value || '';
        for (const field of websiteFields) {
            const visible = field.dataset.websiteCondition === selected;
            field.hidden = !visible;
            field.querySelector('input').disabled = !visible;
        }
    }

    function updateOfferFields() {
        const selected = form.querySelector('[name="businessTypes"]:checked')?.value || '';
        for (const field of offerFields) {
            const visible = field.dataset.offerCondition.split(',').includes(selected);
            field.hidden = !visible;
            for (const control of field.querySelectorAll('input, textarea, select')) control.disabled = !visible;
        }
    }

    function formData() {
        const data = Object.fromEntries(new FormData(form));
        data.websiteAddress = normalizeWebsiteAddress(data.websiteAddress);
        data.businessTypes = new FormData(form).getAll('businessTypes');
        data.customerLocations = new FormData(form).getAll('customerLocations');
        data.consent = form.elements.consent.checked;
        return data;
    }

    function saveDraft() {
        const data = formData();
        delete data.consent;
        delete data.website;
        localStorage.setItem(key, JSON.stringify(data));
        status.textContent = 'Draft saved on this device.';
    }

    function restoreDraft() {
        let data;
        try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch { return; }
        if (!data) return;
        for (const [name, value] of Object.entries(data)) {
            const fields = form.querySelectorAll(`[name="${CSS.escape(name)}"]`);
            for (const field of fields) {
                if (field.type === 'checkbox' || field.type === 'radio') field.checked = Array.isArray(value) ? value.includes(field.value) : field.value === value;
                else field.value = value;
            }
        }
        status.textContent = 'Your saved draft has been restored.';
    }

    let timer;
    form.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(saveDraft, 400);
    });

    form.addEventListener('change', (event) => {
        if (event.target.name === 'ownsDomain') updateDomainFields();
        if (event.target.name === 'hasWebsite') updateWebsiteFields();
        if (event.target.name === 'businessTypes') updateOfferFields();
    });

    websiteAddress?.addEventListener('blur', () => {
        websiteAddress.value = normalizeWebsiteAddress(websiteAddress.value);
        saveDraft();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        submit.disabled = true;
        submit.textContent = 'Submitting...';
        status.textContent = '';
        try {
            const response = await fetch('/api/public/intake/mittohnee', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData()),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'Your form could not be submitted.');
            localStorage.removeItem(key);
            form.hidden = true;
            document.querySelector('[data-intake-success]').hidden = false;
            document.querySelector('[data-intake-success]').focus();
        } catch (error) {
            status.textContent = error.message;
            status.classList.add('is-error');
        } finally {
            submit.disabled = false;
            submit.textContent = 'Submit my worksheet';
        }
    });

    restoreDraft();
    updateDomainFields();
    updateWebsiteFields();
    updateOfferFields();
})();
