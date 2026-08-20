(function () {
    const STATUSES = [
        { value: 'new', label: 'New' },
        { value: 'contacted', label: 'Contacted' },
        { value: 'won', label: 'Won' },
        { value: 'closed', label: 'Closed' },
    ];

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

    function day(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString('en-CA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
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

    function packageTotalFromForm(form) {
        if (!form) return 0;
        const num = (name) => Number(form.elements[name]?.value) || 0;
        let monthly = num('managementAmount') + num('seoAmount') + num('aeoAmount') + num('maintenanceAmount');
        const hosting = num('hostingAmount');
        if (hosting) monthly += form.hostingCycle?.value === 'yearly' ? hosting / 12 : hosting;
        const discount = num('discount');
        const tax = num('taxAmount');
        return Math.round((Math.max(0, monthly - discount) + tax) * 100) / 100;
    }

    function updatePackageTotal(form) {
        const el = $('[data-package-total]', form);
        if (el) el.textContent = `${money(packageTotalFromForm(form))} / mo`;
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
        const hostingOn = types.includes('hosting') || Number(amount('hostingAmount')) > 0;
        if (hostingOn && !types.includes('hosting')) types.push('hosting');
        if (Number(amount('managementAmount')) > 0 && !types.includes('management')) types.push('management');
        if (Number(amount('seoAmount')) > 0 && !types.includes('seo')) types.push('seo');
        if (Number(amount('aeoAmount')) > 0 && !types.includes('aeo')) types.push('aeo');
        if (Number(amount('maintenanceAmount')) > 0 && !types.includes('maintenance')) types.push('maintenance');
        return {
            serviceTypes: types,
            hostingAmount: hostingOn ? amount('hostingAmount') : '',
            hostingCycle: form.hostingCycle?.value || 'yearly',
            hostingLastBilled: hostingOn ? amount('hostingLastBilled') : '',
            hostingNextBillDate: hostingOn ? amount('hostingNextBillDate') : '',
            managementAmount: amount('managementAmount'),
            seoAmount: amount('seoAmount'),
            aeoAmount: amount('aeoAmount'),
            maintenanceAmount: amount('maintenanceAmount'),
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

    function setSection(id) {
        const next = id || 'overview';
        $$('[data-admin-section]').forEach((btn) => {
            btn.setAttribute('aria-current', btn.getAttribute('data-admin-section') === next ? 'page' : 'false');
        });
        $$('[data-admin-panel]').forEach((panel) => {
            panel.hidden = panel.getAttribute('data-admin-panel') !== next;
        });
        if (location.hash.replace('#', '') !== next) {
            history.replaceState(null, '', `#${next}`);
        }
    }

    function statCard(label, value, section) {
        const inner = `<p class="dash-stat__value">${escapeHtml(String(value))}</p>
            <h3 class="dash-stat__label">${escapeHtml(label)}</h3>`;
        if (!section) return `<article class="dash-stat">${inner}</article>`;
        return `<button type="button" class="dash-stat dash-stat--link" data-admin-section="${escapeHtml(section)}">${inner}</button>`;
    }

    function clientCard(client) {
        return `<article class="client-card">
            <a href="/clients/${encodeURIComponent(client.slug)}/">
                <h3 class="client-card__name">${escapeHtml(client.name)}</h3>
                <p class="client-card__meta">${escapeHtml(client.email || client.website || 'Open client')}</p>
                <span class="client-card__cta">Open client</span>
            </a>
        </article>`;
    }

    function renderOverview(data) {
        const seo = data.clients.filter((client) => hasService(client, ['seo', 'aeo']));
        const maintenance = data.clients.filter((client) => hasService(client, ['maintenance']));
        const hosting = data.clients.filter((client) => hasService(client, ['hosting']));
        const management = data.clients.filter((client) => hasService(client, ['management']));
        $('[data-overview-stats]').innerHTML = [
            statCard('SEO clients', seo.length, 'seo-clients'),
            statCard('Maintenance clients', maintenance.length, 'maintenance-clients'),
            statCard('Hosting clients', hosting.length, 'hosting-clients'),
            statCard('Site management', management.length, 'management-clients'),
            statCard('Portfolio projects', data.projects.length, 'portfolio'),
            statCard('All clients', data.clients.length),
            statCard('Leads', data.inbox.length, 'leads'),
            statCard('Calendly bookings', data.calendly.length, 'calendly'),
        ].join('');
    }

    function renderClientsTable(clients) {
        const body = $('[data-clients-body]');
        const empty = $('[data-clients-empty]');
        if (!body) return;
        body.innerHTML = clients
            .map(
                (client) => `<tr>
                    <td>
                        <strong>${escapeHtml(client.name)}</strong>
                        <div class="admin-muted">${escapeHtml(client.email || 'No email')}</div>
                    </td>
                    <td>${escapeHtml(client.contactName || '—')}</td>
                    <td class="admin-services">${servicePills(client)}</td>
                    <td>
                        <a class="admin-row-btn" href="/clients/${encodeURIComponent(client.slug)}/">View</a>
                        <button type="button" class="admin-row-btn" data-edit-client="${escapeHtml(client.slug)}">Edit</button>
                        <button type="button" class="admin-row-btn admin-row-btn--danger" data-archive-client="${escapeHtml(client.slug)}">Delete</button>
                    </td>
                </tr>`
            )
            .join('');
        if (empty) empty.hidden = clients.length > 0;
    }

    function renderClientGrid(clients, gridSel, emptySel, types) {
        const grid = $(gridSel);
        const empty = $(emptySel);
        if (!grid) return;
        const list = clients.filter((client) => hasService(client, types));
        grid.innerHTML = list.map(clientCard).join('');
        if (empty) empty.hidden = list.length > 0;
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

    function renderLeads(inbox) {
        const body = $('[data-leads-body]');
        const empty = $('[data-leads-empty]');
        body.innerHTML = inbox
            .map((row) => {
                const options = STATUSES.map(
                    (status) =>
                        `<option value="${status.value}"${row.status === status.value ? ' selected' : ''}>${status.label}</option>`
                ).join('');
                return `<tr>
                    <td>${escapeHtml(day(row.at))}</td>
                    <td>${escapeHtml(row.name || '—')}</td>
                    <td><a href="mailto:${escapeHtml(row.email)}">${escapeHtml(row.email)}</a></td>
                    <td>${escapeHtml(row.service || '—')}</td>
                    <td><select class="admin-status" data-lead-id="${escapeHtml(row.id)}">${options}</select></td>
                </tr>`;
            })
            .join('');
        empty.hidden = inbox.length > 0;
    }

    function renderSubmissions(inbox) {
        const list = $('[data-submissions-list]');
        const empty = $('[data-submissions-empty]');
        list.innerHTML = inbox
            .map(
                (row) => `<article class="admin-message">
                    <h3>${escapeHtml(row.name || row.email)}</h3>
                    <p>${escapeHtml(day(row.at))} · ${escapeHtml(row.email)}${row.service ? ` · ${escapeHtml(row.service)}` : ''}${row.page ? ` · ${escapeHtml(row.page)}` : ''}</p>
                    <p class="admin-message__body">${escapeHtml(row.message || '(no message)')}</p>
                </article>`
            )
            .join('');
        empty.hidden = inbox.length > 0;
    }

    function renderCalendly(bookings) {
        const body = $('[data-calendly-body]');
        const empty = $('[data-calendly-empty]');
        body.innerHTML = bookings
            .map(
                (row) => `<tr>
                    <td>${escapeHtml(day(row.startTime || row.at))}</td>
                    <td>${escapeHtml(row.eventType || 'Booking')}</td>
                    <td>${escapeHtml(row.inviteeName || '—')}</td>
                    <td>${row.inviteeEmail ? `<a href="mailto:${escapeHtml(row.inviteeEmail)}">${escapeHtml(row.inviteeEmail)}</a>` : '—'}</td>
                    <td>${escapeHtml(row.status || 'booked')}</td>
                </tr>`
            )
            .join('');
        empty.hidden = bookings.length > 0;
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
            inbox: bootData?.inbox || [],
            calendly: bootData?.calendly || [],
            staff: bootData?.staff || [],
        };

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
            renderClientsTable(data.clients);
            renderClientGrid(data.clients, '[data-seo-grid]', '[data-seo-empty]', ['seo', 'aeo']);
            renderClientGrid(data.clients, '[data-maintenance-grid]', '[data-maintenance-empty]', ['maintenance']);
            renderClientGrid(data.clients, '[data-hosting-grid]', '[data-hosting-empty]', ['hosting']);
            renderClientGrid(data.clients, '[data-management-grid]', '[data-management-empty]', ['management']);
            renderPortfolio(data.projects);
            renderLeads(data.inbox);
            renderSubmissions(data.inbox);
            renderCalendly(data.calendly);
            renderStaff(data.staff);
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
            showInvite(null);
            const loaded = !client || 'credentials' in client || 'clientApps' in client;
            clientForm.dataset.credentialsLoaded = loaded ? '1' : '0';
            setCredentials(
                $('[data-credential-list]', clientForm),
                loaded ? credentialRowsFrom(client) : defaultCredentialRows()
            );
            const hosting = serviceOf(client || {}, 'hosting');
            if (clientForm.hostingAmount) clientForm.hostingAmount.value = hosting?.amount || '';
            if (clientForm.hostingCycle) clientForm.hostingCycle.value = hosting?.cycle === 'monthly' ? 'monthly' : 'yearly';
            if (clientForm.hostingLastBilled) clientForm.hostingLastBilled.value = (hosting?.lastBilled || '').slice(0, 10);
            if (clientForm.hostingNextBillDate) clientForm.hostingNextBillDate.value = (hosting?.nextBillDate || '').slice(0, 10);
            if (clientForm.managementAmount) clientForm.managementAmount.value = serviceOf(client || {}, 'management')?.amount || '';
            if (clientForm.seoAmount) clientForm.seoAmount.value = serviceOf(client || {}, 'seo')?.amount || '';
            if (clientForm.aeoAmount) clientForm.aeoAmount.value = serviceOf(client || {}, 'aeo')?.amount || '';
            if (clientForm.maintenanceAmount) clientForm.maintenanceAmount.value = serviceOf(client || {}, 'maintenance')?.amount || '';
            if (clientForm.discount) clientForm.discount.value = client?.discount || '';
            if (clientForm.taxAmount) clientForm.taxAmount.value = client?.taxAmount || '';
            updatePackageTotal(clientForm);
            syncAccountType();
        }

        async function refresh() {
            show(errorEl, '');
            const dash = await tryRequest('/api/clients?view=dashboard');
            if (dash?.clients) {
                data.clients = dash.clients || [];
                if (dash.projects) data.projects = dash.projects;
                if (dash.inbox) data.inbox = dash.inbox;
                if (dash.calendly) data.calendly = dash.calendly;
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
            const btn = event.target.closest('[data-admin-section]');
            if (!btn) return;
            const id = btn.getAttribute('data-admin-section');
            if (id === 'new-client') fillClientForm(null);
            setSection(id);
        });
        window.addEventListener('hashchange', () => setSection(location.hash.replace('#', '') || 'overview'));
        setSection(location.hash.replace('#', '') || 'overview');

        clientForm?.addEventListener('input', (event) => {
            const name = event.target?.name;
            if (name === 'hostingAmount' && Number(event.target.value) > 0) setServiceChecked(clientForm, 'hosting', true);
            if (name === 'managementAmount' && Number(event.target.value) > 0) setServiceChecked(clientForm, 'management', true);
            if (name === 'seoAmount' && Number(event.target.value) > 0) setServiceChecked(clientForm, 'seo', true);
            if (name === 'aeoAmount' && Number(event.target.value) > 0) setServiceChecked(clientForm, 'aeo', true);
            if (name === 'maintenanceAmount' && Number(event.target.value) > 0) setServiceChecked(clientForm, 'maintenance', true);
            updatePackageTotal(clientForm);
        });
        clientForm?.hostingCycle?.addEventListener('change', () => updatePackageTotal(clientForm));
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
                    setSection('overview');
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
            const editClient = event.target.closest('[data-edit-client]');
            const archiveClient = event.target.closest('[data-archive-client]');
            if (editClient || archiveClient) {
                show(errorEl, '');
                show(okEl, '');
                const slug = (editClient || archiveClient).getAttribute(editClient ? 'data-edit-client' : 'data-archive-client');
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

        document.addEventListener('change', async (event) => {
            const select = event.target.closest('[data-lead-id]');
            if (!select) return;
            show(errorEl, '');
            show(okEl, '');
            try {
                await request('/api/leads', {
                    method: 'PATCH',
                    body: { id: select.getAttribute('data-lead-id'), status: select.value },
                });
                const row = data.inbox.find((item) => item.id === select.getAttribute('data-lead-id'));
                if (row) row.status = select.value;
                show(okEl, 'Lead status updated.');
            } catch (error) {
                show(errorEl, error.message || 'Could not update that lead.');
            }
        });
    }

    if (window.__LD_PORTAL__) boot(window.__LD_PORTAL__);
    document.addEventListener('ld-portal-ready', (event) => boot(event.detail));
})();
