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
        return (client.services || []).some((row) => types.includes(row.type) && Number(row.amount));
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

    function statCard(label, value) {
        return `<article class="dash-stat">
            <p class="dash-stat__value">${escapeHtml(String(value))}</p>
            <h3 class="dash-stat__label">${escapeHtml(label)}</h3>
        </article>`;
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
        const seo = data.clients.filter((client) => hasService(client, ['seo', 'aeo']) || (client.reports || []).length);
        const maintenance = data.clients.filter((client) => hasService(client, ['maintenance', 'management', 'hosting']));
        const hidden = data.projects.filter((project) => project.hidden).length;
        $('[data-overview-stats]').innerHTML = [
            statCard('SEO clients', seo.length),
            statCard('Maintenance clients', maintenance.length),
            statCard('Portfolio projects', data.projects.length),
            statCard('Hidden projects', hidden),
            statCard('Leads', data.inbox.length),
            statCard('Form submissions', data.inbox.length),
            statCard('Calendly bookings', data.calendly.length),
        ].join('');
    }

    function renderClientGrid(clients, gridSel, emptySel, types) {
        const list = clients.filter((client) => hasService(client, types) || (types.includes('seo') && (client.reports || []).length));
        const grid = $(gridSel);
        const empty = $(emptySel);
        grid.innerHTML = list.map(clientCard).join('');
        empty.hidden = list.length > 0;
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
        let data = { clients: [], projects: [], inbox: [], calendly: [] };

        function paint() {
            renderOverview(data);
            renderClientGrid(data.clients, '[data-seo-grid]', '[data-seo-empty]', ['seo', 'aeo']);
            renderClientGrid(data.clients, '[data-maintenance-grid]', '[data-maintenance-empty]', [
                'maintenance',
                'management',
                'hosting',
            ]);
            renderPortfolio(data.projects);
            renderLeads(data.inbox);
            renderSubmissions(data.inbox);
            renderCalendly(data.calendly);
        }

        async function refresh() {
            data = await request('/api/admin/dashboard');
            paint();
        }

        try {
            await refresh();
        } catch (error) {
            paint();
            show(errorEl, error.message || 'Could not load admin data. Start the portal server and refresh.');
        }

        document.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-admin-section]');
            if (btn) setSection(btn.getAttribute('data-admin-section'));
        });
        window.addEventListener('hashchange', () => setSection(location.hash.replace('#', '') || 'overview'));
        setSection(location.hash.replace('#', '') || 'overview');

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
