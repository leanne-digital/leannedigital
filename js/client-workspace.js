(function () {
    const SERVICE_SLOTS = [
        { type: 'seo', title: 'Ongoing Monthly SEO', reportKind: 'seo' },
        { type: 'maintenance', title: 'Site Maintenance', reportKind: 'maintenance' },
        { type: 'management', title: 'Monthly Site Management', reportKind: '' },
        { type: 'hosting', title: 'Website Hosting', reportKind: '' },
        { type: 'aeo', title: 'AEO', reportKind: 'aeo' },
    ];

    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function $$(sel, root) {
        return [...(root || document).querySelectorAll(sel)];
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function money(amount) {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD',
            maximumFractionDigits: 0,
        }).format(Number(amount) || 0);
    }

    function formatDay(iso) {
        const day = String(iso || '').slice(0, 10);
        if (!day) return '';
        const date = new Date(`${day}T00:00:00Z`);
        if (Number.isNaN(date.getTime())) return day;
        return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    }

    function serviceOf(client, type) {
        return (client.services || []).find((row) => row.type === type) || null;
    }

    function reportKind(report) {
        if (report.kind) return report.kind;
        const slug = String(report.slug || '');
        if (slug.includes('maintenance')) return 'maintenance';
        if (slug.includes('aeo')) return 'aeo';
        return 'seo';
    }

    function packageLine(service) {
        if (!service) return 'None';
        if (Number(service.amount) > 0) {
            return service.cycle === 'yearly' ? `${money(service.amount)} / year` : `${money(service.amount)} / mo`;
        }
        return service.label || 'Signed up';
    }

    function slotStatus(client, slot) {
        const service = serviceOf(client, slot.type);
        if (slot.type === 'seo' && !service && (client.reports || []).some((row) => reportKind(row) === 'seo')) {
            return 'Ongoing Monthly SEO';
        }
        if (slot.type === 'hosting' && !service && client.hosting?.provider) {
            return [client.hosting.provider, client.hosting.lddHosted ? 'Hosted by us' : 'External hosting']
                .filter(Boolean)
                .join(' · ');
        }
        return packageLine(service);
    }

    function slotSignedUp(client, slot) {
        return slotStatus(client, slot) !== 'None';
    }

    function reportsFor(client, kind) {
        return [...(client.reports || [])]
            .filter((row) => !kind || reportKind(row) === kind)
            .sort((a, b) => String(b.monthKey || b.slug || '').localeCompare(String(a.monthKey || a.slug || '')));
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

    function fillPicker(clients) {
        const select = $('[data-client-picker]');
        if (!select) return;
        const current = select.value;
        const rows = (clients || []).filter((row) => !row.archivedAt);
        select.innerHTML = `<option value="">Choose a client</option>${rows
            .map((row) => `<option value="${escapeHtml(row.slug)}">${escapeHtml(row.name)}</option>`)
            .join('')}`;
        if (current && rows.some((row) => row.slug === current)) select.value = current;
    }

    function bootPicker(api) {
        const select = $('[data-client-picker]');
        if (!select) return;
        select.addEventListener('change', () => {
            if (select.value) location.href = `/clients/${select.value}/`;
        });
        api.clients('list')
            .then((data) => fillPicker(data.clients || []))
            .catch(() => {});
    }

    function credRow(data = {}) {
        const wrap = document.createElement('div');
        wrap.className = 'dash-cred';
        wrap.innerHTML = `<input type="hidden" data-app="id" value="${escapeHtml(data.id || '')}">
            <label>Service
                <input data-app="label" type="text" value="${escapeHtml(data.label || '')}" placeholder="Mailchimp, Google Ads…">
            </label>
            <label>Login URL
                <input data-app="url" type="url" value="${escapeHtml(data.url || '')}" placeholder="https://">
            </label>
            <label>Username or email
                <input data-app="username" type="text" value="${escapeHtml(data.username || '')}" autocomplete="off">
            </label>
            <label>Password
                <input data-app="password" type="password" value="${escapeHtml(data.password || '')}" autocomplete="new-password">
            </label>
            <label>Notes
                <input data-app="notes" type="text" value="${escapeHtml(data.notes || '')}">
            </label>
            <button class="dash-form__remove" type="button" data-remove-app>Remove</button>`;
        return wrap;
    }

    function readApps(list) {
        return $$('.dash-cred', list)
            .map((row) => ({
                id: $('[data-app="id"]', row)?.value || '',
                label: $('[data-app="label"]', row)?.value || '',
                url: $('[data-app="url"]', row)?.value || '',
                username: $('[data-app="username"]', row)?.value || '',
                password: $('[data-app="password"]', row)?.value || '',
                notes: $('[data-app="notes"]', row)?.value || '',
            }))
            .filter((row) => row.label || row.url || row.username || row.password || row.notes);
    }

    function adminForm(slot, service, client) {
        const on = Boolean(service && (Number(service.amount) > 0 || service.lastBilled || service.type === slot.type));
        const amount = Number(service?.amount) > 0 ? String(service.amount) : '';
        const cycle = service?.cycle === 'monthly' ? 'monthly' : 'yearly';
        const start = (service?.lastBilled || '').slice(0, 10);
        const next = (service?.nextBillDate || '').slice(0, 10);
        const hostingFields =
            slot.type === 'hosting'
                ? `<label>Cycle
                    <select name="cycle">
                        <option value="yearly"${cycle === 'yearly' ? ' selected' : ''}>Yearly</option>
                        <option value="monthly"${cycle === 'monthly' ? ' selected' : ''}>Monthly</option>
                    </select>
                </label>
                <label>Start date
                    <input name="lastBilled" type="date" value="${escapeHtml(start)}">
                </label>
                <label>Next due
                    <input name="nextBillDate" type="date" value="${escapeHtml(next)}">
                </label>`
                : `<label>Start date
                    <input name="lastBilled" type="date" value="${escapeHtml(start)}">
                </label>
                <label>Next renewal
                    <input name="nextBillDate" type="date" value="${escapeHtml(next)}">
                </label>`;
        return `<form class="dash-form client-service__form" data-service-form="${escapeHtml(slot.type)}">
            <label class="portal-check"><input type="checkbox" name="on"${on || slotSignedUp(client, slot) ? ' checked' : ''}><span>This client is on this service</span></label>
            <div class="dash-form__grid">
                <label>Amount
                    <input name="amount" type="number" min="0" step="1" value="${escapeHtml(amount)}">
                </label>
                ${hostingFields}
            </div>
            <div class="dash-form__actions">
                <button class="ld-btn" type="submit">Save ${escapeHtml(slot.title)}</button>
            </div>
        </form>`;
    }

    function serviceBody(client, slot, isStaff) {
        const service = serviceOf(client, slot.type);
        const signed = slotSignedUp(client, slot);
        const bits = [];
        if (signed && service) {
            bits.push(`<p><strong>${escapeHtml(packageLine(service))}</strong></p>`);
            const started = String(client.started || client.createdAt || '').slice(0, 10);
            if (started) bits.push(`<p>Signed up ${escapeHtml(formatDay(started))}</p>`);
            if (service.lastBilled) bits.push(`<p>Started ${escapeHtml(formatDay(service.lastBilled))}</p>`);
            if (service.nextBillDate) bits.push(`<p>Next renewal ${escapeHtml(formatDay(service.nextBillDate))}</p>`);
        } else if (signed && slot.type === 'hosting' && client.hosting?.provider) {
            bits.push(`<p>${escapeHtml(slotStatus(client, slot))}</p>`);
        } else {
            bits.push('<p>None. This client is not signed up for this service.</p>');
        }
        const includeGroup = (client.includes || []).find((group) => {
            const title = String(group.title || '').toLowerCase();
            if (slot.type === 'seo' || slot.type === 'aeo') return title.includes('seo') || title.includes('aeo');
            if (slot.type === 'maintenance') return title.includes('maintenance') || title.includes('backup');
            if (slot.type === 'management') return title.includes('management');
            if (slot.type === 'hosting') return title.includes('host');
            return false;
        });
        if (includeGroup?.items?.length) {
            bits.push(`<h3>${escapeHtml(includeGroup.title)}</h3><ul>${includeGroup.items
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join('')}</ul>`);
        }
        const related = reportsFor(client, slot.reportKind).filter((row) => slot.reportKind);
        if (related.length) {
            bits.push(`<h3>Reports</h3><ul class="client-service__reports">${related
                .map(
                    (row) =>
                        `<li><a href="/clients/${escapeHtml(client.slug)}/${escapeHtml(row.slug)}/">${escapeHtml(row.title)}</a></li>`
                )
                .join('')}</ul>`);
        }
        if (isStaff) bits.push(adminForm(slot, service, client));
        return bits.join('');
    }

    function renderWorkspace(client, user) {
        const isStaff = user?.role === 'staff';
        $$('[data-service-slot]').forEach((el) => {
            const type = el.getAttribute('data-service-slot');
            const slot = SERVICE_SLOTS.find((row) => row.type === type);
            if (!slot) return;
            const status = $('[data-service-status]', el);
            if (status) status.textContent = slotStatus(client, slot);
            const body = $('[data-service-body]', el);
            if (body) body.innerHTML = serviceBody(client, slot, isStaff);
        });

        const reportBody = $('[data-report-body]');
        if (reportBody) {
            const rows = reportsFor(client);
            reportBody.innerHTML = rows.length
                ? rows
                      .map((row) => {
                          const href = `/clients/${client.slug}/${row.slug}/`;
                          const type = reportKind(row) === 'maintenance' ? 'Site maintenance report' : 'SEO report';
                          return `<tr class="client-account-row" data-href="${escapeHtml(href)}" tabindex="0">
                            <td><a class="client-account-row__hit" href="${escapeHtml(href)}">${escapeHtml(row.title)}</a></td>
                            <td>${escapeHtml(type)}</td>
                            <td>Open report</td>
                        </tr>`;
                      })
                      .join('')
                : `<tr><td colspan="3">No reports yet.</td></tr>`;
        }

        const list = $('[data-app-list]');
        if (list) {
            list.innerHTML = '';
            const apps = client.clientApps || [];
            (apps.length ? apps : [{}]).forEach((row) => list.appendChild(credRow(row)));
        }
    }

    function existingPayload(client) {
        const payload = {
            serviceTypes: [...new Set((client.services || []).map((row) => row.type).filter(Boolean))],
        };
        for (const service of client.services || []) {
            if (service.type === 'hosting') {
                payload.hostingAmount = service.amount || '';
                payload.hostingCycle = service.cycle || 'yearly';
                payload.hostingLastBilled = service.lastBilled || '';
                payload.hostingNextBillDate = service.nextBillDate || '';
            }
            if (service.type === 'seo') {
                payload.seoAmount = service.amount || '';
                payload.seoLastBilled = service.lastBilled || '';
                payload.seoNextBillDate = service.nextBillDate || '';
            }
            if (service.type === 'aeo') {
                payload.aeoAmount = service.amount || '';
                payload.aeoLastBilled = service.lastBilled || '';
                payload.aeoNextBillDate = service.nextBillDate || '';
            }
            if (service.type === 'maintenance') {
                payload.maintenanceAmount = service.amount || '';
                payload.maintenanceLastBilled = service.lastBilled || '';
                payload.maintenanceNextBillDate = service.nextBillDate || '';
            }
            if (service.type === 'management') {
                payload.managementAmount = service.amount || '';
                payload.managementLastBilled = service.lastBilled || '';
                payload.managementNextBillDate = service.nextBillDate || '';
            }
        }
        return payload;
    }

    function bootWorkspace(api, user) {
        const slug = document.body.getAttribute('data-client-slug');
        if (!slug || !$('[data-client-workspace]')) return;
        const errorEl = $('[data-workspace-error]');
        const okEl = $('[data-workspace-ok]');
        let client = null;

        function show(el, message) {
            if (!el) return;
            el.hidden = !message;
            el.textContent = message || '';
        }

        async function refresh() {
            const data = await api.getClient(slug);
            client = data.client;
            renderWorkspace(client, user);
        }

        refresh().catch((error) => show(errorEl, error.message || 'Could not load this client.'));

        document.addEventListener('change', (event) => {
            const form = event.target.closest('[data-service-form]');
            if (!form) return;
            if (event.target.name === 'lastBilled' || event.target.name === 'cycle') {
                const start = form.lastBilled?.value;
                if (start && form.nextBillDate) {
                    const cycle = form.cycle?.value === 'monthly' ? 'monthly' : 'yearly';
                    form.nextBillDate.value = addCycleDate(start, cycle);
                }
            }
        });

        document.addEventListener('submit', async (event) => {
            const form = event.target.closest('[data-service-form]');
            if (!form || !client) return;
            event.preventDefault();
            show(errorEl, '');
            show(okEl, '');
            const type = form.getAttribute('data-service-form');
            const on = Boolean(form.on?.checked);
            const amount = on ? form.amount?.value || '' : '';
            const payload = existingPayload(client);
            if (on && !payload.serviceTypes.includes(type)) payload.serviceTypes.push(type);
            if (!on) payload.serviceTypes = payload.serviceTypes.filter((item) => item !== type);
            const last = on ? form.lastBilled?.value || '' : '';
            const next = on ? form.nextBillDate?.value || '' : '';
            if (type === 'hosting') {
                payload.hostingAmount = on ? amount : '';
                payload.hostingCycle = form.cycle?.value || 'yearly';
                payload.hostingLastBilled = last;
                payload.hostingNextBillDate = next;
            } else if (type === 'seo') {
                if (!on || amount !== '') payload.seoAmount = on ? amount : '';
                payload.seoLastBilled = last;
                payload.seoNextBillDate = next;
            } else if (type === 'aeo') {
                if (!on || amount !== '') payload.aeoAmount = on ? amount : '';
                payload.aeoLastBilled = last;
                payload.aeoNextBillDate = next;
            } else if (type === 'maintenance') {
                if (!on || amount !== '') payload.maintenanceAmount = on ? amount : '';
                payload.maintenanceLastBilled = last;
                payload.maintenanceNextBillDate = next;
            } else if (type === 'management') {
                if (!on || amount !== '') payload.managementAmount = on ? amount : '';
                payload.managementLastBilled = last;
                payload.managementNextBillDate = next;
            }
            const submit = form.querySelector('[type="submit"]');
            if (submit) submit.disabled = true;
            try {
                const data = await api.clients('update', { slug, ...payload });
                client = data.client || client;
                renderWorkspace(client, user);
                show(okEl, 'Service saved.');
            } catch (error) {
                show(errorEl, error.message || 'Could not save that service.');
            } finally {
                if (submit) submit.disabled = false;
            }
        });

        $('[data-add-app]')?.addEventListener('click', () => {
            $('[data-app-list]')?.appendChild(credRow({}));
        });
        $('[data-app-list]')?.addEventListener('click', (event) => {
            if (!event.target.closest('[data-remove-app]')) return;
            event.target.closest('.dash-cred')?.remove();
            const list = $('[data-app-list]');
            if (list && !list.querySelector('.dash-cred')) list.appendChild(credRow({}));
        });
        $('[data-apps-form]')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            show(errorEl, '');
            show(okEl, '');
            const apps = readApps($('[data-app-list]'));
            const submit = event.target.querySelector('[type="submit"]');
            if (submit) submit.disabled = true;
            try {
                if (user.role === 'staff') {
                    const data = await api.clients('update', { slug, clientApps: apps });
                    client = data.client || client;
                } else {
                    const data = await api.saveProfile({ clientApps: apps });
                    client = data.client || client;
                }
                renderWorkspace(client, user);
                show(okEl, 'Credentials saved.');
            } catch (error) {
                show(errorEl, error.message || 'Could not save credentials.');
            } finally {
                if (submit) submit.disabled = false;
            }
        });
    }

    function boot(detail) {
        const api = detail?.api;
        const user = detail?.user;
        if (!api) return;
        bootPicker(api);
        bootWorkspace(api, user);
    }

    if (window.__LD_PORTAL__) boot(window.__LD_PORTAL__);
    document.addEventListener('ld-portal-ready', (event) => boot(event.detail));
})();
