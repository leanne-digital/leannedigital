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
        { types: ['seo'], label: 'SEO' },
        { types: ['aeo'], label: 'AEO' },
        { types: ['google-ads'], label: 'Google Ads' },
    ];

    function serviceTypesOf(client) {
        return new Set([...(client.serviceTypes || []), ...(client.services || []).map((row) => row.type)].filter(Boolean));
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
        };

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
            clientForm.name.value = client?.name || '';
            clientForm.contactName.value = client?.contactName || '';
            clientForm.email.value = client?.email || '';
            clientForm.phone.value = client?.phone || '';
            clientForm.website.value = client?.website || '';
            const have = serviceTypesOf(client || {});
            $$('input[name="serviceTypes"]', clientForm).forEach((input) => {
                const aliases = input.value === 'website' ? ['website', 'development'] : input.value === 'design' ? ['design', 'graphic-design'] : [input.value];
                input.checked = aliases.some((type) => have.has(type));
            });
            clientForm.querySelector('[type="submit"]').textContent = client ? 'Save client' : 'Create client';
            if (inviteBtn) inviteBtn.hidden = !client;
            showInvite(null);
        }

        async function refresh() {
            show(errorEl, '');
            const dash = await tryRequest('/api/clients/dashboard');
            if (dash) {
                data.clients = dash.clients || [];
                data.projects = dash.projects || [];
                data.inbox = dash.inbox || [];
                data.calendly = dash.calendly || [];
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

        clientForm?.addEventListener('reset', () => {
            fillClientForm(null);
            show(errorEl, '');
            show(okEl, '');
        });

        clientForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            show(errorEl, '');
            show(okEl, '');
            const submit = clientForm.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                const payload = {
                    name: clientForm.name.value,
                    contactName: clientForm.contactName.value,
                    email: clientForm.email.value,
                    phone: clientForm.phone.value,
                    website: clientForm.website.value,
                    serviceTypes: $$('input[name="serviceTypes"]:checked', clientForm).map((input) => input.value),
                };
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
                fillClientForm(created.client);
                showInvite(created.invite);
                const emailed = created.invite?.emailed;
                show(
                    okEl,
                    emailed
                        ? `Client created. A login email was sent to ${created.invite.email}. Copy the link below if you also want to send it yourself.`
                        : 'Client created. Copy the login link below and send it to them — email was not sent from the server.'
                );
            } catch (error) {
                show(errorEl, error.message || 'Could not save that client.');
            } finally {
                submit.disabled = false;
            }
        });

        inviteBtn?.addEventListener('click', async () => {
            const slug = clientForm?.slug.value;
            if (!slug) return;
            show(errorEl, '');
            show(okEl, '');
            try {
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
                        fillClientForm(client);
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
