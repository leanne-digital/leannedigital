(() => {
    const root = document.querySelector('[data-intake-results]');
    if (!root) return;
    const form = root.querySelector('form');
    const body = root.querySelector('tbody');
    const count = root.querySelector('[data-result-count]');
    const empty = root.querySelector('[data-empty-results]');
    const dialog = root.querySelector('dialog');

    const labels = {
        service: 'Service-based', product: 'Product-based', both: 'Products and services', other: 'Other',
        'local-community': 'Local community', manitoba: 'Manitoba', canada: 'Across Canada', online: 'Online / Anywhere',
    };
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const display = (values) => (values || []).map((value) => labels[value] || value).join(', ') || 'Not answered';
    const answer = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value || 'Not answered')}</dd></div>`;

    function openSubmission(item) {
        dialog.querySelector('h3').textContent = item.businessName;
        dialog.querySelector('dl').innerHTML = [
            answer('Student', item.name), answer('Email', item.email),
            answer('Business type', display(item.businessTypes)), answer('Services', item.services),
            answer('Products', item.products), answer('Product count', item.productCount),
            answer('Ideal customer', item.idealCustomer), answer('Customer locations', display(item.customerLocations)),
            answer('Problem or need', item.customerProblem), answer('Result provided', item.customerResult),
            answer('Business values', item.businessValues), answer('What makes the approach different', item.differentiator),
            answer('Business statement', `My business provides ${item.statementProvides || '...'} for ${item.statementFor || '...'} to help them ${item.statementOutcome || '...'}.`),
            answer('Domain', item.currentDomain || item.desiredDomain), answer('Website', item.websiteAddress),
        ].join('');
        dialog.showModal();
    }

    async function load() {
        body.innerHTML = '<tr><td colspan="6">Loading submissions...</td></tr>';
        const query = new URLSearchParams(new FormData(form));
        const response = await fetch(`/api/clients/red-river-college/intake?${query}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load intake results.');
        const data = await response.json();
        count.textContent = `${data.count} result${data.count === 1 ? '' : 's'}`;
        empty.hidden = data.submissions.length > 0;
        body.replaceChildren();
        for (const item of data.submissions) {
            const row = document.createElement('tr');
            row.innerHTML = `<td><button type="button">${esc(item.businessName)}</button></td><td>${esc(item.name)}</td><td>${esc(display(item.businessTypes))}</td><td>${esc(display(item.customerLocations))}</td><td>${esc(new Date(item.submittedAt).toLocaleDateString('en-CA'))}</td><td><a href="mailto:${encodeURIComponent(item.email)}">Email</a></td>`;
            row.querySelector('button').addEventListener('click', () => openSubmission(item));
            body.append(row);
        }
    }

    let debounce;
    form.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => load().catch(showError), 250); });
    form.addEventListener('change', () => load().catch(showError));
    form.addEventListener('reset', () => setTimeout(() => load().catch(showError)));
    dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    function showError(error) { body.innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`; }
    load().catch(showError);
})();

