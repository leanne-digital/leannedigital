(function () {
    const CLIENT_FILTERS = {
        overview: { types: null, heading: 'All clients' },
        'seo-clients': { types: ['seo', 'aeo'], heading: 'SEO clients' },
        'maintenance-clients': { types: ['maintenance'], heading: 'Maintenance clients' },
        'hosting-clients': { types: ['hosting'], heading: 'Hosting clients' },
        'management-clients': { types: ['management'], heading: 'Site management' },
    };

    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function $$(sel, root) {
        return [...(root || document).querySelectorAll(sel)];
    }

    function show(el, message) {
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || '';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hasService(client, types) {
        return (
            (client.services || []).some((row) => types.includes(row.type)) ||
            (client.serviceTypes || []).some((type) => types.includes(type)) ||
            (types.includes('seo') && (client.reports || []).length)
        );
    }

    const SERVICE_LABELS = [
        { types: ['website', 'development'], label: 'Web development' },
        { types: ['maintenance'], label: 'Site maintenance' },
        { types: ['hosting'], label: 'Hosting' },
        { types: ['design', 'graphic-design'], label: 'Graphic design' },
        { types: ['management'], label: 'Site management' },
        { types: ['updates'], label: 'Site updates' },
        { types: ['ads', 'google-ads'], label: 'Paid ads' },
        { types: ['integrations'], label: 'Integrations' },
        { types: ['automations'], label: 'Automations' },
        { types: ['seo'], label: 'SEO' },
        { types: ['aeo'], label: 'AEO' },
    ];

    function serviceTypesOf(client) {
        return new Set([...(client.serviceTypes || []), ...(client.services || []).map((row) => row.type)].filter(Boolean));
    }

    function serviceOf(client, type) {
        return (client.services || []).find((row) => row.type === type) || null;
    }

    function money(amount) {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD',
            maximumFractionDigits: 0,
        }).format(Number(amount) || 0);
    }

    function packageOn(form, type) {
        return Boolean(form?.querySelector(`[data-package-on="${type}"]`)?.checked);
    }

    function setPackageOn(form, type, on) {
        const input = form?.querySelector(`[data-package-on="${type}"]`);
        if (input) input.checked = Boolean(on);
    }

    function addCycleDate(iso, cycle) {
        const date = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(date.getTime())) return '';
        if (cycle === 'monthly') date.setMonth(date.getMonth() + 1);
        else date.setFullYear(date.getFullYear() + 1);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function fillHostingNextDue(form) {
        if (!form?.hostingLastBilled?.value || !form.hostingNextBillDate) return;
        const cycle = form.hostingCycle?.value === 'monthly' ? 'monthly' : 'yearly';
        form.hostingNextBillDate.value = addCycleDate(form.hostingLastBilled.value, cycle);
    }

    function syncPackageFields(form) {
        if (!form) return;
        $$('[data-package-block]', form).forEach((block) => {
            const on = Boolean(block.querySelector('[data-package-on]')?.checked);
            block.classList.toggle('is-off', !on);
            $$('input:not([data-package-on]), select', block).forEach((el) => {
                el.disabled = !on;
            });
        });
        updatePackageTotal(form);
    }

    function revenueLines(form) {
        if (!form) return [];
        const num = (name) => Number(form.elements[name]?.value) || 0;
        const lines = [];
        if (packageOn(form, 'hosting') && num('hostingAmount')) {
            lines.push({
                label: 'Hosting',
                amount: num('hostingAmount'),
                period: form.hostingCycle?.value === 'monthly' ? 'month' : 'year',
            });
        }
        if (packageOn(form, 'management') && num('managementAmount')) {
            lines.push({ label: 'Site management', amount: num('managementAmount'), period: 'month' });
        }
        if (packageOn(form, 'seo') && num('seoAmount')) {
            lines.push({ label: 'SEO', amount: num('seoAmount'), period: 'month' });
        }
        if (packageOn(form, 'aeo') && num('aeoAmount')) {
            lines.push({ label: 'AEO', amount: num('aeoAmount'), period: 'month' });
        }
        if (packageOn(form, 'maintenance') && num('maintenanceAmount')) {
            lines.push({ label: 'Site maintenance', amount: num('maintenanceAmount'), period: 'month' });
        }
        if (num('discount')) lines.push({ label: 'Discount', amount: -num('discount'), period: 'month' });
        if (num('taxAmount')) lines.push({ label: 'Tax', amount: num('taxAmount'), period: 'once' });
        return lines;
    }

    function updatePackageTotal(form) {
        const lines = revenueLines(form);
        const list = $('[data-revenue-lines]', form);
        if (list) {
            list.innerHTML = lines
                .map((row) => {
                    const period = row.period === 'year' ? '/ year' : row.period === 'month' ? '/ mo' : '';
                    return `<li><span>${escapeHtml(row.label)}</span><strong>${row.amount < 0 ? '−' : ''}${money(Math.abs(row.amount))} ${period}</strong></li>`;
                })
                .join('');
        }
        const monthly = lines.filter((row) => row.period === 'month').reduce((sum, row) => sum + row.amount, 0);
        const yearly = lines.filter((row) => row.period === 'year').reduce((sum, row) => sum + row.amount, 0);
        const tax = lines.filter((row) => row.period === 'once').reduce((sum, row) => sum + row.amount, 0);
        const parts = [];
        if (monthly) parts.push(`${money(Math.max(0, monthly))} / mo`);
        if (yearly) parts.push(`${money(yearly)} / year`);
        if (tax) parts.push(`${money(tax)} tax`);
        const el = $('[data-package-total]', form);
        if (el) el.textContent = parts.join(' · ') || '$0';
    }

    function setServiceChecked(form, type, on) {
        const input = form?.querySelector(`input[name="serviceTypes"][value="${type}"]`);
        if (input) input.checked = Boolean(on);
    }

    function packagePayload(form) {
        const types = $$('input[name="serviceTypes"]', form)
            .filter((input) => input.checked)
            .map((input) => input.value);
        const amount = (name) => form.elements[name]?.value ?? '';
        const hostingOn = packageOn(form, 'hosting');
        const managementOn = packageOn(form, 'management');
        const seoOn = packageOn(form, 'seo');
        const aeoOn = packageOn(form, 'aeo');
        const maintenanceOn = packageOn(form, 'maintenance');
        if (hostingOn && !types.includes('hosting')) types.push('hosting');
        if (managementOn && !types.includes('management')) types.push('management');
        if (seoOn && !types.includes('seo')) types.push('seo');
        if (aeoOn && !types.includes('aeo')) types.push('aeo');
        if (maintenanceOn && !types.includes('maintenance')) types.push('maintenance');
        return {
            serviceTypes: types,
            hostingAmount: hostingOn ? amount('hostingAmount') : '',
            hostingCycle: form.hostingCycle?.value || 'yearly',
            hostingLastBilled: hostingOn ? amount('hostingLastBilled') : '',
            hostingNextBillDate: hostingOn ? amount('hostingNextBillDate') : '',
            managementAmount: managementOn ? amount('managementAmount') : '',
            seoAmount: seoOn ? amount('seoAmount') : '',
            aeoAmount: aeoOn ? amount('aeoAmount') : '',
            maintenanceAmount: maintenanceOn ? amount('maintenanceAmount') : '',
            discount: amount('discount'),
            taxAmount: amount('taxAmount'),
        };
    }

    function serviceLabels(client) {
        const have = serviceTypesOf(client);
        const labels = SERVICE_LABELS.filter((row) => row.types.some((type) => have.has(type))).map((row) => row.label);
        const known = new Set(SERVICE_LABELS.flatMap((row) => row.types));
        for (const type of have) {
            if (!known.has(type)) labels.push(type.replace(/-/g, ' '));
        }
        return labels;
    }

    function servicePills(client) {
        const labels = serviceLabels(client);
        if (!labels.length) return '<span class="admin-muted">None yet</span>';
        return labels.map((label) => `<span class="admin-pill">${escapeHtml(label)}</span>`).join(' ');
    }

    function formatDay(iso) {
        const day = String(iso || '').slice(0, 10);
        if (!day) return '';
        const date = new Date(`${day}T00:00:00Z`);
        if (Number.isNaN(date.getTime())) return day;
        return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    }

    function reportTypeLabel(report) {
        const kind = report.kind || (String(report.slug || '').includes('maintenance') ? 'maintenance' : 'seo');
        return kind === 'maintenance' ? 'Site maintenance report' : 'SEO report';
    }

    function planTypeLabel(type) {
        if (type === 'seo') return 'SEO plan';
        if (type === 'aeo') return 'AEO plan';
        if (type === 'hosting') return 'Hosting';
        if (type === 'maintenance') return 'Maintenance plan';
        if (type === 'management') return 'Site management';
        return String(type || '').replace(/-/g, ' ');
    }

    function cycleLabel(service) {
        if (!service?.amount) return 'Included';
        if (service.cycle === 'yearly') return `${money(service.amount)} / year`;
        return `${money(service.amount)} / month`;
    }

    function renderClientAccount(client) {
        const wrap = $('[data-client-account]');
        const body = $('[data-client-account-body]');
        if (!wrap || !body) return;
        if (!client?.slug) {
            wrap.hidden = true;
            body.innerHTML = '';
            return;
        }
        const rows = [];
        const started = String(client.started || client.createdAt || '').slice(0, 10);
        const reports = [...(client.reports || [])].sort((a, b) =>
            String(b.monthKey || b.slug || '').localeCompare(String(a.monthKey || a.slug || ''))
        );
        for (const report of reports) {
            const href = `/clients/${client.slug}/${report.slug}/`;
            rows.push(`<tr class="client-account-row" data-href="${escapeHtml(href)}" tabindex="0">
                    <td><a class="client-account-row__hit" href="${escapeHtml(href)}">${escapeHtml(report.title)}</a></td>
                    <td>${escapeHtml(reportTypeLabel(report))}</td>
                    <td>Open report</td>
                </tr>`);
        }
        const billed = new Set();
        for (const service of client.services || []) {
            billed.add(service.type);
            const bits = [cycleLabel(service)];
            if (started) bits.push(`Signed up ${formatDay(started)}`);
            if (service.lastBilled) bits.push(`Started ${formatDay(service.lastBilled)}`);
            if (service.nextBillDate) bits.push(`Next renewal ${formatDay(service.nextBillDate)}`);
            rows.push(`<tr class="client-account-row">
                    <td>${escapeHtml(service.label || planTypeLabel(service.type))}</td>
                    <td>${escapeHtml(planTypeLabel(service.type))}</td>
                    <td>${escapeHtml(bits.join(' · '))}</td>
                </tr>`);
        }
        if (client.hosting?.provider && !billed.has('hosting')) {
            const bits = [client.hosting.provider, client.hosting.lddHosted ? 'Hosted by us' : 'External hosting'];
            if (started) bits.push(`Signed up ${formatDay(started)}`);
            rows.push(`<tr class="client-account-row">
                    <td>Hosting</td>
                    <td>Hosting</td>
                    <td>${escapeHtml(bits.join(' · '))}</td>
                </tr>`);
        }
        wrap.hidden = rows.length === 0;
        body.innerHTML = rows.join('');
    }

    function fileToImage(file) {
        if (!file || !file.size) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ filename: file.name, dataUrl: reader.result });
            reader.onerror = () => reject(new Error('Could not read that image.'));
            reader.readAsDataURL(file);
        });
    }

    const CRED_KINDS = [
        ['hosting', 'Hosting'],
        ['domain', 'Domain'],
        ['email', 'Email'],
        ['app', 'Other app / SaaS'],
    ];

    function credPlaceholder(kind) {
        if (kind === 'hosting') return 'SiteGround, WP Engine, Leanne Digital…';
        if (kind === 'domain') return 'Hover, GoDaddy, Cloudflare…';
        if (kind === 'email') return 'Google Workspace, Microsoft 365…';
        return 'Mailchimp, HubSpot, custom SaaS…';
    }

    function defaultCredentialRows() {
        return [{ kind: 'hosting' }, { kind: 'domain' }, { kind: 'email' }];
    }

    function credentialRow(data = {}) {
        const kind = data.kind || 'app';
        const options = CRED_KINDS.map(
            ([id, label]) => `<option value="${id}"${kind === id ? ' selected' : ''}>${label}</option>`
        ).join('');
        const wrap = document.createElement('div');
        wrap.className = 'dash-cred';
        wrap.setAttribute('data-cred-source', data.source === 'client' ? 'client' : 'staff');
        if (data.id) wrap.setAttribute('data-cred-id', data.id);
        wrap.innerHTML = `${
            data.source === 'client'
                ? '<p class="dash-cred__badge dash-cred__wide">Client submitted</p>'
                : ''
        }<label>Type
                <select data-cred="kind">${options}</select>
            </label>
            <label>Where
                <input data-cred="label" type="text" value="${escapeHtml(data.label || '')}" placeholder="${escapeHtml(credPlaceholder(kind))}">
            </label>
            <label>Login URL
                <input data-cred="url" type="url" value="${escapeHtml(data.url || '')}" placeholder="https://">
            </label>
            <label>Username
                <input data-cred="username" type="text" value="${escapeHtml(data.username || '')}" autocomplete="off">
            </label>
            <label class="dash-cred__wide">Password
                <input data-cred="password" type="password" value="${escapeHtml(data.password || '')}" autocomplete="new-password">
            </label>
            <label class="dash-cred__wide">Notes
                <input data-cred="notes" type="text" value="${escapeHtml(data.notes || '')}">
            </label>
            <button class="dash-form__remove dash-cred__wide" type="button" data-remove-credential>Remove</button>`;
        wrap.querySelector('[data-cred="kind"]')?.addEventListener('change', (event) => {
            const label = wrap.querySelector('[data-cred="label"]');
            if (label) label.placeholder = credPlaceholder(event.target.value);
        });
        return wrap;
    }

    function setCredentials(list, rows) {
        if (!list) return;
        list.innerHTML = '';
        const items = rows && rows.length ? rows : defaultCredentialRows();
        for (const row of items) list.appendChild(credentialRow(row));
    }

    function readCredentialState(list) {
        const credentials = [];
        const clientApps = [];
        if (!list) return { credentials, clientApps };
        for (const row of list.querySelectorAll('.dash-cred')) {
            const get = (key) => row.querySelector(`[data-cred="${key}"]`)?.value.trim() || '';
            const kind = get('kind') || 'app';
            const label = get('label');
            const url = get('url');
            const username = get('username');
            const password = row.querySelector('[data-cred="password"]')?.value || '';
            const notes = get('notes');
            if (!label && !url && !username && !password && !notes) continue;
            if (row.getAttribute('data-cred-source') === 'client') {
                clientApps.push({
                    id: row.getAttribute('data-cred-id') || '',
                    label: label || 'Other service',
                    url,
                    username,
                    password,
                    notes,
                });
            } else {
                credentials.push({ kind, label, url, username, password, notes });
            }
        }
        return { credentials, clientApps };
    }

    function credentialRowsFrom(client) {
        const staff = (client?.credentials || []).map((row) => ({ ...row, source: 'staff' }));
        const submitted = (client?.clientApps || []).map((row) => ({
            ...row,
            kind: 'app',
            source: 'client',
        }));
        const rows = [...staff, ...submitted];
        return rows.length ? rows : defaultCredentialRows();
    }

    async function request(url, { method = 'GET', body } = {}) {
        const res = await fetch(url, {
            method,
            credentials: 'include',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = (res.headers.get('content-type') || '').includes('application/json')
            ? await res.json().catch(() => ({}))
            : {};
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    function setSection(id, filterId) {
        const next = id || 'overview';
        $$('[data-admin-section]').forEach((btn) => {
            btn.setAttribute('aria-current', btn.getAttribute('data-admin-section') === next ? 'page' : 'false');
        });
        $$('[data-client-filter]').forEach((btn) => {
            const active = next === 'overview' && btn.getAttribute('data-client-filter') === (filterId || 'overview');
            btn.setAttribute('aria-current', active ? 'page' : 'false');
        });
        $$('[data-admin-panel]').forEach((panel) => {
            panel.hidden = panel.getAttribute('data-admin-panel') !== next;
        });
        const hash = next === 'overview' ? filterId || 'overview' : next;
        if (location.hash.replace('#', '') !== hash) {
            history.replaceState(null, '', `#${hash}`);
        }
    }

    function statCard(label, value, section) {
        const inner = `<p class="dash-stat__value">${escapeHtml(String(value))}</p>
            <h3 class="dash-stat__label">${escapeHtml(label)}</h3>`;
        if (!section) return `<article class="dash-stat">${inner}</article>`;
        return `<button type="button" class="dash-stat dash-stat--link" data-admin-section="${escapeHtml(section)}">${inner}</button>`;
    }

    function renderOverview(data) {
        const seo = data.clients.filter((client) => hasService(client, ['seo', 'aeo']));
        const maintenance = data.clients.filter((client) => hasService(client, ['maintenance']));
        const hosting = data.clients.filter((client) => hasService(client, ['hosting']));
        const management = data.clients.filter((client) => hasService(client, ['management']));
        const stats = $('[data-overview-stats]');
        if (stats) {
            stats.innerHTML = [
                statCard('SEO clients', seo.length, 'seo-clients'),
                statCard('Maintenance clients', maintenance.length, 'maintenance-clients'),
                statCard('Hosting clients', hosting.length, 'hosting-clients'),
                statCard('Site management', management.length, 'management-clients'),
                statCard('Portfolio projects', data.projects.length, 'portfolio'),
                statCard('All clients', data.clients.length, 'overview'),
            ].join('');
        }
    }

    function syncOverviewMode(filterId) {
        const table = $('[data-clients-table-wrap]');
        if (table) table.hidden = false;
    }

    function matchesQuery(client, query) {
        if (!query) return true;
        const hay = [client.name, client.email, client.contactName, client.website, client.slug]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return hay.includes(query);
    }

    function renderClientsTable(clients, filterId, query) {
        const body = $('[data-clients-body]');
        const empty = $('[data-clients-empty]');
        const heading = $('[data-clients-heading]');
        if (!body) return;
        const filter = CLIENT_FILTERS[filterId] || CLIENT_FILTERS.overview;
        let list = clients;
        if (filter.types) list = list.filter((client) => hasService(client, filter.types));
        list = list.filter((client) => matchesQuery(client, query));
        if (heading) heading.textContent = filter.heading;
        body.innerHTML = list
            .map((client) => {
                const href = `/clients/${escapeHtml(client.slug)}/`;
                return `<tr class="admin-clients-table__row" data-open-client="${escapeHtml(client.slug)}" data-href="${href}" tabindex="0">
                    <td>
                        <a class="admin-clients-table__hit" href="${href}">
                            <strong>${escapeHtml(client.name)}</strong>
                            <div class="admin-muted">${escapeHtml(client.email || 'No email')}</div>
                        </a>
                    </td>
                    <td>${escapeHtml(client.contactName || '—')}</td>
                    <td class="admin-services">${servicePills(client)}</td>
                </tr>`;
            })
            .join('');
        if (empty) {
            empty.hidden = list.length > 0;
            empty.textContent = clients.length
                ? `No ${String(filter.heading || 'clients').toLowerCase()} match that search.`
                : 'No clients yet. Add a client to get started.';
        }
    }

    function renderPortfolio(projects) {
        const body = $('[data-portfolio-body]');
        const empty = $('[data-portfolio-empty]');
        body.innerHTML = projects
            .map(
                (project) => `<tr data-project-slug="${escapeHtml(project.slug)}">
                    <td><a href="${escapeHtml(project.path)}">${escapeHtml(project.title)}</a></td>
                    <td>${escapeHtml(project.categoriesLine || '')}</td>
                    <td><span class="admin-pill${project.hidden ? ' admin-pill--hidden' : ''}">${project.hidden ? 'Hidden' : 'Live'}</span></td>
                    <td>
                        <button type="button" data-edit-project="${escapeHtml(project.slug)}">Edit</button>
                        <button type="button" data-toggle-project="${escapeHtml(project.slug)}">${project.hidden ? 'Show' : 'Hide'}</button>
                        <button type="button" data-delete-project="${escapeHtml(project.slug)}">Remove</button>
                    </td>
                </tr>`
            )
            .join('');
        empty.hidden = projects.length > 0;
    }

    function fillProjectForm(form, project) {
        form.slug.value = project?.slug || '';
        form.title.value = project?.title || '';
        form.seoTitle.value = project?.seoTitle || '';
        form.websiteUrl.value = project?.websiteUrl || '';
        form.description.value = project?.description || '';
        form.overview.value = project?.overview || '';
        form.hidden.checked = Boolean(project?.hidden);
        form.image.value = '';
        $('[data-image-preview]').textContent = project?.featuredImage
            ? `Current image: ${project.featuredImage}`
            : '';
        $$('input[name="tags"]', form).forEach((input) => {
            input.checked = Boolean(project?.tags?.includes(input.value));
        });
        form.querySelector('[type="submit"]').textContent = project ? 'Save changes' : 'Save project';
        if (project) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function boot({ user }) {
        if (!user || user.role !== 'staff') return;
        const errorEl = $('[data-admin-error]');
        const okEl = $('[data-admin-ok]');
        const form = $('[data-portfolio-form]');
        const clientForm = $('[data-client-form]');
        const inviteCard = $('[data-invite-card]');
        const inviteUrlEl = $('[data-invite-url]');
        const inviteBtn = $('[data-invite-client]');
        const bootData = window.__LD_ADMIN_BOOTSTRAP__;
        let data = {
            clients: bootData?.clients || [],
            projects: bootData?.projects || [],
            staff: bootData?.staff || [],
        };
        let clientFilter = 'overview';
        let clientQuery = '';

        const canCreateStaff = user.privilege !== 'admin';

        function accountType() {
            return clientForm?.accountType?.value || 'client';
        }

        function syncAccountType() {
            if (!clientForm) return;
            const type = accountType();
            const isClient = type === 'client' || Boolean(clientForm.slug.value);
            $$('[data-client-only]', clientForm).forEach((el) => {
                el.hidden = !isClient;
            });
            const nameLabel = $('[data-name-label]', clientForm);
            if (nameLabel) nameLabel.textContent = isClient ? 'Contact name' : 'Full name';
            const lead = $('[data-account-lead]');
            if (lead) {
                lead.textContent = isClient
                    ? 'Clients get their own portal. Admins and super admins can sign in to this dashboard.'
                    : type === 'super-admin'
                      ? 'Super admins can create clients and invite other admins.'
                      : 'Admins can manage clients and the dashboard, but cannot invite other admins.';
            }
            if (clientForm.name) clientForm.name.required = isClient && !clientForm.slug.value;
            if (clientForm.contactName) clientForm.contactName.required = !isClient;
            const submit = clientForm.querySelector('[type="submit"]');
            if (submit && !clientForm.slug.value) {
                submit.textContent = isClient ? 'Create client' : 'Create account';
            }
            if (clientForm.accountType) clientForm.accountType.disabled = Boolean(clientForm.slug.value);
        }

        function renderStaff(staff) {
            const body = $('[data-staff-body]');
            if (!body) return;
            const labels = { 'super-admin': 'Super admin', admin: 'Admin' };
            body.innerHTML = (staff || [])
                .map(
                    (row) => `<tr>
                    <td>${escapeHtml(row.name || '—')}</td>
                    <td>${escapeHtml(row.email)}</td>
                    <td>${escapeHtml(labels[row.privilege] || row.privilege || 'Admin')}</td>
                </tr>`
                )
                .join('');
        }

        function paint() {
            renderOverview(data);
            syncOverviewMode(clientFilter);
            renderClientsTable(data.clients, clientFilter, clientQuery);
            renderPortfolio(data.projects);
            renderStaff(data.staff);
        }

        function showClients(filterId) {
            clientFilter = CLIENT_FILTERS[filterId] ? filterId : 'overview';
            setSection('overview', clientFilter);
            syncOverviewMode(clientFilter);
            renderClientsTable(data.clients, clientFilter, clientQuery);
        }

        async function tryRequest(url, options) {
            try {
                return await request(url, options);
            } catch {
                return null;
            }
        }

        function showInvite(invite) {
            const url = invite?.inviteUrl || '';
            if (!inviteCard || !inviteUrlEl) return;
            inviteCard.hidden = !url;
            inviteUrlEl.value = url;
        }

        function fillClientForm(client) {
            if (!clientForm) return;
            clientForm.slug.value = client?.slug || '';
            if (clientForm.accountType) clientForm.accountType.value = 'client';
            clientForm.name.value = client?.name || '';
            clientForm.contactName.value = client?.contactName || '';
            clientForm.email.value = client?.email || '';
            clientForm.phone.value = client?.phone || '';
            clientForm.website.value = client?.website || '';
            const have = serviceTypesOf(client || {});
            $$('input[name="serviceTypes"]', clientForm).forEach((input) => {
                const aliases =
                    input.value === 'website'
                        ? ['website', 'development']
                        : input.value === 'design'
                          ? ['design', 'graphic-design']
                          : input.value === 'ads'
                            ? ['ads', 'google-ads']
                            : [input.value];
                input.checked = aliases.some((type) => have.has(type));
            });
            clientForm.querySelector('[type="submit"]').textContent = client ? 'Save client' : 'Create client';
            if (inviteBtn) inviteBtn.hidden = !client;
            const archiveBtn = $('[data-archive-client-btn]', clientForm);
            if (archiveBtn) {
                archiveBtn.hidden = !client?.slug;
                if (client?.slug) archiveBtn.setAttribute('data-archive-client', client.slug);
                else archiveBtn.removeAttribute('data-archive-client');
            }
            showInvite(null);
            const loaded = !client || 'credentials' in client || 'clientApps' in client;
            clientForm.dataset.credentialsLoaded = loaded ? '1' : '0';
            setCredentials(
                $('[data-credential-list]', clientForm),
                loaded ? credentialRowsFrom(client) : defaultCredentialRows()
            );
            const billedAmount = (service) => (Number(service?.amount) > 0 ? String(service.amount) : '');
            const hosting = serviceOf(client || {}, 'hosting');
            const management = serviceOf(client || {}, 'management');
            const seo = serviceOf(client || {}, 'seo');
            const aeo = serviceOf(client || {}, 'aeo');
            const maintenance = serviceOf(client || {}, 'maintenance');
            setPackageOn(clientForm, 'hosting', Boolean(billedAmount(hosting) || hosting?.lastBilled || hosting?.nextBillDate));
            setPackageOn(clientForm, 'management', Boolean(billedAmount(management)));
            setPackageOn(clientForm, 'seo', Boolean(billedAmount(seo)));
            setPackageOn(clientForm, 'aeo', Boolean(billedAmount(aeo)));
            setPackageOn(clientForm, 'maintenance', Boolean(billedAmount(maintenance)));
            if (clientForm.hostingAmount) clientForm.hostingAmount.value = billedAmount(hosting);
            if (clientForm.hostingCycle) clientForm.hostingCycle.value = hosting?.cycle === 'monthly' ? 'monthly' : 'yearly';
            if (clientForm.hostingLastBilled) clientForm.hostingLastBilled.value = (hosting?.lastBilled || '').slice(0, 10);
            if (clientForm.hostingNextBillDate) clientForm.hostingNextBillDate.value = (hosting?.nextBillDate || '').slice(0, 10);
            if (clientForm.managementAmount) clientForm.managementAmount.value = billedAmount(management);
            if (clientForm.seoAmount) clientForm.seoAmount.value = billedAmount(seo);
            if (clientForm.aeoAmount) clientForm.aeoAmount.value = billedAmount(aeo);
            if (clientForm.maintenanceAmount) clientForm.maintenanceAmount.value = billedAmount(maintenance);
            if (clientForm.discount) clientForm.discount.value = Number(client?.discount) > 0 ? String(client.discount) : '';
            if (clientForm.taxAmount) clientForm.taxAmount.value = Number(client?.taxAmount) > 0 ? String(client.taxAmount) : '';
            if (packageOn(clientForm, 'hosting') && clientForm.hostingLastBilled?.value && !clientForm.hostingNextBillDate?.value) {
                fillHostingNextDue(clientForm);
            }
            syncPackageFields(clientForm);
            renderClientAccount(client);
            syncAccountType();
        }

        async function refresh() {
            show(errorEl, '');
            const dash = await tryRequest('/api/clients?view=dashboard');
            if (dash?.clients) {
                data.clients = dash.clients || [];
                if (dash.projects) data.projects = dash.projects;
                if (dash.staff) data.staff = dash.staff;
                paint();
                return;
            }
            const clientsRes = await tryRequest('/api/clients');
            if (clientsRes) {
                data.clients = clientsRes.clients || [];
                paint();
                return;
            }
            paint();
            if (!data.clients.length) {
                throw new Error('Could not load live client data.');
            }
        }

        paint();
        try {
            await refresh();
        } catch (error) {
            paint();
            show(errorEl, error.message || 'Could not load admin data. Start the portal server and refresh.');
        }

        document.addEventListener('click', (event) => {
            const filterBtn = event.target.closest('[data-client-filter]');
            if (filterBtn) {
                showClients(filterBtn.getAttribute('data-client-filter'));
                return;
            }
            const btn = event.target.closest('[data-admin-section]');
            if (!btn) return;
            const id = btn.getAttribute('data-admin-section');
            if (CLIENT_FILTERS[id]) {
                showClients(id);
                return;
            }
            if (id === 'new-client') fillClientForm(null);
            setSection(id, clientFilter);
        });
        function applyHash() {
            const id = location.hash.replace('#', '') || 'overview';
            if (CLIENT_FILTERS[id]) showClients(id);
            else setSection(id, clientFilter);
        }
        window.addEventListener('hashchange', applyHash);
        applyHash();
        const editSlug = new URLSearchParams(location.search).get('client');
        if (editSlug) {
            (async () => {
                const live = await tryRequest(`/api/clients/${encodeURIComponent(editSlug)}`);
                const client = live?.client || data.clients.find((row) => row.slug === editSlug);
                if (client) {
                    fillClientForm(client);
                    setSection('new-client');
                }
            })();
        }
        $('[data-client-search]')?.addEventListener('input', (event) => {
            clientQuery = String(event.target.value || '').trim().toLowerCase();
            renderClientsTable(data.clients, clientFilter, clientQuery);
        });
        $('[data-clients-body]')?.addEventListener('click', (event) => {
            const row = event.target.closest('tr[data-open-client]');
            if (!row || event.target.closest('a')) return;
            location.href = row.getAttribute('data-href');
        });
        $('[data-clients-body]')?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const row = event.target.closest('tr[data-open-client]');
            if (!row) return;
            event.preventDefault();
            location.href = row.getAttribute('data-href');
        });
        $('[data-client-account-body]')?.addEventListener('click', (event) => {
            const row = event.target.closest('tr[data-href]');
            if (!row || event.target.closest('a')) return;
            location.href = row.getAttribute('data-href');
        });
        $('[data-client-account-body]')?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const row = event.target.closest('tr[data-href]');
            if (!row) return;
            event.preventDefault();
            location.href = row.getAttribute('data-href');
        });

        clientForm?.addEventListener('input', () => updatePackageTotal(clientForm));
        clientForm?.addEventListener('change', (event) => {
            const target = event.target;
            if (target?.matches('[data-package-on]')) {
                const type = target.getAttribute('data-package-on');
                if (target.checked && type) setServiceChecked(clientForm, type, true);
                syncPackageFields(clientForm);
                if (type === 'hosting' && target.checked) fillHostingNextDue(clientForm);
                updatePackageTotal(clientForm);
                return;
            }
            if (target?.name === 'hostingLastBilled' || target?.name === 'hostingCycle') {
                fillHostingNextDue(clientForm);
            }
            updatePackageTotal(clientForm);
        });
        clientForm?.accountType?.addEventListener('change', syncAccountType);
        if (!canCreateStaff && clientForm?.accountType) {
            $$('option', clientForm.accountType).forEach((opt) => {
                if (opt.value !== 'client') opt.remove();
            });
            const typeLabel = clientForm.accountType.closest('label');
            if (typeLabel) typeLabel.hidden = true;
        }
        syncAccountType();
        fillClientForm(null);

        clientForm?.addEventListener('reset', () => {
            fillClientForm(null);
            show(errorEl, '');
            show(okEl, '');
        });

        clientForm?.addEventListener('click', (event) => {
            const add = event.target.closest('[data-add-credential]');
            const remove = event.target.closest('[data-remove-credential]');
            if (!add && !remove) return;
            const list = $('[data-credential-list]', clientForm);
            if (add) {
                list.appendChild(credentialRow({ kind: 'app' }));
                return;
            }
            remove.closest('.dash-cred')?.remove();
            if (!list.querySelector('.dash-cred')) setCredentials(list, defaultCredentialRows());
        });

        clientForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            show(errorEl, '');
            show(okEl, '');
            const submit = clientForm.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                const type = accountType();
                const isStaffAccount = (type === 'admin' || type === 'super-admin') && !clientForm.slug.value;
                const payload = isStaffAccount
                    ? {
                          accountType: type,
                          contactName: clientForm.contactName.value,
                          email: clientForm.email.value,
                      }
                    : {
                          name: clientForm.name.value,
                          contactName: clientForm.contactName.value,
                          email: clientForm.email.value,
                          phone: clientForm.phone.value,
                          website: /^https?:\/\/$/i.test(String(clientForm.website.value || '').trim())
                              ? ''
                              : clientForm.website.value,
                          ...packagePayload(clientForm),
                      };
                if (!isStaffAccount && (!clientForm.slug.value || clientForm.dataset.credentialsLoaded === '1')) {
                    Object.assign(payload, readCredentialState($('[data-credential-list]', clientForm)));
                }
                const slug = clientForm.slug.value;
                if (slug) {
                    await request(`/api/clients/${encodeURIComponent(slug)}`, { method: 'PATCH', body: payload });
                    await refresh();
                    show(okEl, 'Client updated.');
                    showClients(clientFilter);
                    return;
                }
                const created = await request('/api/clients', { method: 'POST', body: payload });
                await refresh();
                if (created.client) fillClientForm(created.client);
                else {
                    fillClientForm(null);
                    if (clientForm.accountType) clientForm.accountType.value = type;
                    clientForm.contactName.value = created.account?.name || payload.contactName;
                    clientForm.email.value = created.account?.email || payload.email;
                    syncAccountType();
                    if (inviteBtn) inviteBtn.hidden = false;
                }
                showInvite(created.invite);
                const emailed = created.invite?.emailed;
                const who = created.account?.email || created.invite?.email || payload.email;
                const kind = isStaffAccount ? (type === 'super-admin' ? 'Super admin' : 'Admin') : 'Client';
                show(
                    okEl,
                    emailed
                        ? `${kind} created. A login email was sent to ${who}. Copy the link below if you also want to send it yourself.`
                        : `${kind} created. Copy the login link below and send it to ${who} — email was not sent from the server.`
                );
            } catch (error) {
                show(errorEl, error.message || 'Could not save that client.');
            } finally {
                submit.disabled = false;
            }
        });

        inviteBtn?.addEventListener('click', async () => {
            const slug = clientForm?.slug.value;
            show(errorEl, '');
            show(okEl, '');
            try {
                if (!slug) {
                    const type = accountType();
                    if (type !== 'admin' && type !== 'super-admin') return;
                    const result = await request('/api/clients', {
                        method: 'POST',
                        body: {
                            accountType: type,
                            email: clientForm.email.value,
                            contactName: clientForm.contactName.value,
                        },
                    });
                    showInvite(result.invite);
                    show(
                        okEl,
                        result.invite?.emailed
                            ? `Login link sent to ${result.invite.email}.`
                            : `Copy the login link below and send it to ${result.invite?.email || 'them'}.`
                    );
                    return;
                }
                const result = await request(`/api/clients/${encodeURIComponent(slug)}/invite`, { method: 'POST' });
                showInvite(result.invite);
                show(
                    okEl,
                    result.invite?.emailed
                        ? `Login link sent to ${result.invite.email}.`
                        : `Copy the login link below and send it to ${result.invite?.email || 'the client'}.`
                );
            } catch (error) {
                show(errorEl, error.message || 'Could not create a login link.');
            }
        });

        $('[data-copy-invite]')?.addEventListener('click', async () => {
            const url = inviteUrlEl?.value;
            if (!url) return;
            try {
                await navigator.clipboard.writeText(url);
                show(okEl, 'Login link copied.');
            } catch {
                inviteUrlEl.select();
                show(errorEl, 'Copy failed — select the link and copy it manually.');
            }
        });

        form.addEventListener('reset', () => {
            fillProjectForm(form, null);
            show(errorEl, '');
            show(okEl, '');
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            show(errorEl, '');
            show(okEl, '');
            const submit = form.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                const image = await fileToImage(form.image.files[0]);
                const payload = {
                    slug: form.slug.value,
                    title: form.title.value,
                    seoTitle: form.seoTitle.value,
                    websiteUrl: form.websiteUrl.value,
                    description: form.description.value,
                    overview: form.overview.value,
                    hidden: form.hidden.checked,
                    tags: $$('input[name="tags"]:checked', form).map((input) => input.value),
                    image,
                };
                if (payload.slug) await request(`/api/portfolio/${encodeURIComponent(payload.slug)}`, { method: 'PATCH', body: payload });
                else await request('/api/portfolio', { method: 'POST', body: payload });
                await refresh();
                fillProjectForm(form, null);
                form.reset();
                show(okEl, payload.slug ? 'Project updated.' : 'Project added.');
            } catch (error) {
                show(errorEl, error.message || 'Could not save that project.');
            } finally {
                submit.disabled = false;
            }
        });

        document.addEventListener('click', async (event) => {
            const editClient = event.target.closest('[data-edit-client]:not([data-open-client])');
            const archiveClient = event.target.closest('[data-archive-client-btn], [data-archive-client]');
            if (editClient || archiveClient) {
                show(errorEl, '');
                show(okEl, '');
                const slug = editClient
                    ? editClient.getAttribute('data-edit-client')
                    : archiveClient.getAttribute('data-archive-client') || clientForm?.slug.value;
                const client = data.clients.find((row) => row.slug === slug);
                if (!client) return;
                try {
                    if (editClient) {
                        const live = await tryRequest(`/api/clients/${encodeURIComponent(slug)}`);
                        fillClientForm(live?.client || client);
                        setSection('new-client');
                        return;
                    }
                    if (!confirm(`Archive ${client.name}? They will leave this list. Their login still works until you remove the account later.`)) {
                        return;
                    }
                    await request(`/api/clients/${encodeURIComponent(slug)}/archive`, { method: 'POST' });
                    await refresh();
                    if (clientForm?.slug.value === slug) fillClientForm(null);
                    show(okEl, `${client.name} archived.`);
                } catch (error) {
                    show(errorEl, error.message || 'Could not update that client.');
                }
                return;
            }
            const edit = event.target.closest('[data-edit-project]');
            const toggle = event.target.closest('[data-toggle-project]');
            const remove = event.target.closest('[data-delete-project]');
            if (!edit && !toggle && !remove) return;
            show(errorEl, '');
            show(okEl, '');
            const slug = (edit || toggle || remove).getAttribute(edit ? 'data-edit-project' : toggle ? 'data-toggle-project' : 'data-delete-project');
            const project = data.projects.find((row) => row.slug === slug);
            if (!project) return;
            try {
                if (edit) {
                    fillProjectForm(form, project);
                    setSection('portfolio');
                    return;
                }
                if (toggle) {
                    await request(`/api/portfolio/${encodeURIComponent(slug)}`, {
                        method: 'PATCH',
                        body: { hidden: !project.hidden },
                    });
                    await refresh();
                    show(okEl, project.hidden ? `${project.title} is public again.` : `${project.title} is hidden from the portfolio.`);
                    return;
                }
                if (!confirm(`Remove ${project.title} from the portfolio? This cannot be undone.`)) return;
                await request(`/api/portfolio/${encodeURIComponent(slug)}`, { method: 'DELETE' });
                await refresh();
                if (form.slug.value === slug) fillProjectForm(form, null);
                show(okEl, `${project.title} removed.`);
            } catch (error) {
                show(errorEl, error.message || 'Could not update that project.');
            }
        });
    }

    if (window.__LD_PORTAL__) boot(window.__LD_PORTAL__);
    document.addEventListener('ld-portal-ready', (event) => boot(event.detail));
})();
