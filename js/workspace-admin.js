(function () {
    const CLIENT_FILTERS = {
        overview: { types: null, heading: 'All Clients' },
        dashboard: { types: null, heading: 'All Clients' },
        'technical-seo': { types: ['seo','aeo','geo','technical-seo','content'], heading: 'Technical SEO Clients' },
        'seo-clients': { types: ['seo','aeo','geo','technical-seo','content'], heading: 'SEO Clients' },
        'maintenance-clients': { types: ['maintenance'], heading: 'WP Backups and Security' },
        'hosting-clients': { types: ['hosting'], heading: 'Hosting Clients' },
        'management-clients': { types: ['management'], heading: 'AI Site Management' },
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
        if (Array.isArray(client.serviceTags)) return client.serviceTags.some(type => types.includes(type));
        return (
            (client.services || []).some((row) => types.includes(row.type)) ||
            (client.serviceTypes || []).some((type) => types.includes(type)) ||
            (client.serviceTags || []).some((type) => types.includes(type)) ||
            (types.includes('seo') && (client.reports || []).length)
        );
    }

    const SERVICE_LABELS = [
        { types: ['website', 'development'], label: 'Web development' },
        { types: ['maintenance'], label: 'Site maintenance, backups and security' },
        { types: ['hosting'], label: 'Hosting' },
        { types: ['design', 'graphic-design'], label: 'Graphic Design' },
        { types: ['management'], label: 'AI Site Management' },
        { types: ['updates'], label: 'Site updates' },
        { types: ['ads', 'google-ads'], label: 'Paid Ads' },
        { types: ['integrations'], label: 'Integrations' },
        { types: ['automations'], label: 'Automations' },
        { types: ['seo'], label: 'SEO' },
        { types: ['aeo'], label: 'AEO' },
        { types: ['geo'], label: 'GEO' },
        { types: ['technical-seo'], label: 'Technical SEO' },
        { types: ['content'], label: 'Content Creation' },
    ];

    function serviceTypesOf(client) {
        if (Array.isArray(client.serviceTags)) return new Set(client.serviceTags);
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
            lines.push({ label: 'AI Site Management', amount: num('managementAmount'), period: form.managementCycle?.value === 'yearly' ? 'year' : 'month' });
        }
        if (packageOn(form, 'seo') && num('seoAmount')) {
            lines.push({ label: 'SEO', amount: num('seoAmount'), period: form.seoCycle?.value === 'yearly' ? 'year' : 'month' });
        }
        if (packageOn(form, 'aeo') && num('aeoAmount')) {
            lines.push({ label: 'AEO', amount: num('aeoAmount'), period: form.aeoCycle?.value === 'yearly' ? 'year' : 'month' });
        }
        if (packageOn(form, 'maintenance') && num('maintenanceAmount')) {
            lines.push({ label: 'Site maintenance', amount: num('maintenanceAmount'), period: form.maintenanceCycle?.value === 'yearly' ? 'year' : 'month' });
        }
        if (num('discount')) lines.push({ label: 'Discount', amount: -num('discount'), period: 'month' });
        const rate = num('taxAmount');
        if (rate) {
            const monthlyBase = Math.max(0, lines.filter(row => row.period === 'month').reduce((sum,row)=>sum+row.amount,0));
            const yearlyBase = lines.filter(row => row.period === 'year').reduce((sum,row)=>sum+row.amount,0);
            if (monthlyBase) lines.push({label: rate === .13 ? 'HST 13%' : 'GST 5%', amount: monthlyBase * rate, period:'month'});
            if (yearlyBase) lines.push({label: rate === .13 ? 'HST 13%' : 'GST 5%', amount: yearlyBase * rate, period:'year'});
        }
        return lines;
    }

    function updatePackageTotal(form) {
        const lines = revenueLines(form);
        const list = $('[data-revenue-lines]', form);
        if (list) {
            list.hidden = lines.length <= 1;
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
        if (el) el.textContent = `Total Billing: ${parts.join(' · ') || '$0'}`;
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
            monthlyReportEnabled: form.elements.monthlyReportEnabled?.value === 'yes',
            serviceTags: $$('input[name="serviceTypes"]', form).filter(input => input.checked).map(input => input.value),
            hostingAmount: hostingOn ? amount('hostingAmount') : '',
            hostingCycle: form.hostingCycle?.value || 'yearly',
            hostingLastBilled: hostingOn ? amount('hostingLastBilled') : '',
            hostingNextBillDate: hostingOn ? amount('hostingNextBillDate') : '',
            managementAmount: managementOn ? amount('managementAmount') : '',
            managementCycle: form.managementCycle?.value || 'monthly',
            seoAmount: seoOn ? amount('seoAmount') : '',
            seoCycle: form.seoCycle?.value || 'monthly',
            aeoAmount: aeoOn ? amount('aeoAmount') : '',
            aeoCycle: form.aeoCycle?.value || 'monthly',
            maintenanceAmount: maintenanceOn ? amount('maintenanceAmount') : '',
            maintenanceCycle: form.maintenanceCycle?.value || 'monthly',
            maintenanceNextBillDate: maintenanceOn ? amount('maintenanceNextBillDate') : '',
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

    function servicePills(client, allowedTypes = null) {
        const labels = serviceLabels(client).filter(label=>!allowedTypes || SERVICE_LABELS.find(row=>row.label===label)?.types.some(type=>allowedTypes.includes(type)));
        if (!labels.length) return '<span class="admin-muted">None yet</span>';
        return labels.map((label) => `<span class="admin-pill service-pill" data-service="${escapeHtml(SERVICE_LABELS.find(row=>row.label===label)?.types[0] || 'other')}">${escapeHtml(label)}</span>`).join(' ');
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
        if (type === 'management') return 'AI Site Management';
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
            window.LDReportNaming.newest(a,b)
        );
        for (const report of reports) {
            const href = client.visibility === 'private' ? `/api/clients/${client.slug}/report-view/${report.slug}` : `/clients/${client.slug}/${report.slug}/`;
            rows.push(`<tr class="client-account-row" data-href="${escapeHtml(href)}" tabindex="0">
                    <td><a class="client-account-row__hit" href="${escapeHtml(href)}">${escapeHtml(window.LDReportNaming.title(client, report))}</a></td>
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
            cache: 'no-store',
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
            window.dispatchEvent(new CustomEvent('workspace-view-change'));
        }
    }

    function statCard(label, value, section) {
        const inner = `<span class="dash-stat__icon" aria-hidden="true">${window.LDWorkspaceIcon(section || 'dashboard')}</span>
            <p class="dash-stat__value">${escapeHtml(String(value))}</p>
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
                statCard('SEO Clients', seo.length, 'seo-clients'),
                statCard('WP Backups and Security', maintenance.length, 'maintenance-clients'),
                statCard('Hosting Clients', hosting.length, 'hosting-clients'),
                statCard('AI Site Management', management.length, 'management-clients'),
                statCard('Portfolio Projects', data.projects.length, 'portfolio'),
                statCard('All Clients', data.clients.length, 'overview'),
            ].join('');
        }
    }

    function syncOverviewMode(filterId) {
        document.querySelector('[data-overview-stats]').hidden = filterId !== 'dashboard';
        const table = $('[data-clients-table-wrap]');
        if (table) table.hidden = filterId === 'dashboard';
    }

    function matchesQuery(client, query) {
        if (!query) return true;
        const hay = [client.name, client.email, client.contactName, client.website, client.slug]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return hay.includes(query);
    }

    function renewalDay(client) {
        const value=String(serviceOf(client,'hosting')?.nextBillDate||'').slice(0,10);
        return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))?value:'';
    }
    function nextMaintenanceBill(client) {
        const plan=serviceOf(client,'maintenance');
        if (plan?.nextBillDate) return String(plan.nextBillDate).slice(0,10);
        if (plan?.cycle === 'yearly') return '';
        const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).formatToParts(new Date());
        const year=Number(parts.find(p=>p.type==='year').value),month=Number(parts.find(p=>p.type==='month').value);
        return new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
    }
    function renewalPill(client, type='hosting') {
        const day=type==='maintenance'?nextMaintenanceBill(client):renewalDay(client);if(!day)return '<span class="renewal-missing">Not set</span>';
        const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const [year,month,date]=today.split('-').map(Number);
        const limit=new Date(Date.UTC(year,month-1,date+30)).toISOString().slice(0,10);
        const yearly=serviceOf(client,type)?.cycle==='yearly';
        const urgent=yearly&&day>=today&&day<=limit,overdue=day<today;
        return `<span class="renewal-date ${urgent?'renewal-date--due':''}"><time datetime="${day}">${escapeHtml(formatDay(day))}</time></span>${yearly&&(urgent||overdue)?`<span class="renewal-reminder">${overdue?'Overdue — ':''}Contact client for renewal</span>`:''}`;
    }
    function maintenanceActive(client) {
        return serviceOf(client, 'maintenance')?.status !== 'inactive';
    }

    const INCOME_GROUPS = [
        {id: 'maintenance-clients', label: 'Maintenance', accent: 'teal', types: ['maintenance']},
        {id: 'management-clients', label: 'AI Site Management', accent: 'rose', types: ['management']},
        {id: 'hosting-clients', label: 'Hosting', accent: 'gold', types: ['hosting']},
        {id: 'seo-clients', label: 'SEO Clients', accent: 'violet', types: ['seo', 'aeo', 'geo', 'technical-seo', 'content', 'ads', 'google-ads']},
    ];

    function incomeTotals(clients) {
        return INCOME_GROUPS.map(group => {
            let amount = 0, missing = 0;
            for (const client of clients) {
                if ((client.visibility || 'shared') !== 'shared' || client.archivedAt || !hasService(client, CLIENT_FILTERS[group.id].types)) continue;
                const plans = (client.services || []).filter(plan => group.types.includes(plan.type));
                if (!plans.length) missing++;
                for (const plan of plans) {
                    if (plan.status && plan.status !== 'active') continue;
                    const fee = Number(plan.amount);
                    if (plan.amount == null || plan.amount === '' || !Number.isFinite(fee) || fee < 0 || !['monthly', 'yearly'].includes(plan.cycle)) {
                        missing++;
                        continue;
                    }
                    amount += plan.cycle === 'yearly' ? fee / 12 : fee;
                }
            }
            return {...group, amount, missing};
        });
    }

    function maintenanceIncome(clients) {
        return incomeTotals(clients)[0].amount;
    }

    function incomeCard(group) {
        const icon = window.LDWorkspaceIcon?.(group.id) || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10h4v10m4 0V4h4v16m4 0V7M2 20h20"/></svg>';
        return `<article class="income-card income-card--${group.accent}">
            <div class="income-card__heading"><h3>${escapeHtml(group.label)}</h3><span class="income-card__icon" aria-hidden="true">${icon}</span></div>
            <p class="income-card__amount">${money(group.amount)}<span> / month</span></p>
            <p class="income-card__caption">Approx. monthly income</p>
            <p class="income-card__note">${group.id === 'dashboard' ? 'Shared clients only · All service totals' : 'Shared active plans · Yearly fees ÷ 12'}${group.missing ? `<br>${group.missing} missing billing details excluded` : ''}</p>
        </article>`;
    }

    function renderClientsTable(clients, filterId, query) {
        const body = $('[data-clients-body]');
        const empty = $('[data-clients-empty]');
        const heading = $('[data-clients-heading]');
        if (!body) return;
        const filter = CLIENT_FILTERS[filterId] || CLIENT_FILTERS.overview;
        document.querySelector('[data-admin-panel=overview] .admin-panel__title').textContent = filterId === 'dashboard' ? 'Overview' : filter.heading;
        document.querySelector('[data-admin-panel=overview] .admin-panel__lead').textContent = filterId === 'credentials' ? 'Choose a client to manage their saved logins and access details.' : 'Your client accounts, services and contact details in one place.';
        const maintenanceView = filterId === 'maintenance-clients';
        const visibilityMode = filterId;
        let visibilityControl = $('[data-visibility-filter]');
        if (!visibilityControl && heading) {
            const label = document.createElement('label');
            label.className = 'maintenance-visibility';
            label.innerHTML = 'Visibility <select data-visibility-filter></select>';
            heading.before(label);
            visibilityControl = label.querySelector('select');
        }
        if (visibilityControl && visibilityControl.dataset.mode !== visibilityMode) {
            visibilityControl.innerHTML = '<option value="shared">Leanne Digital</option><option value="private">Private</option><option value="all">All</option>';
            visibilityControl.value = 'shared';
            visibilityControl.dataset.mode = visibilityMode;
        }
        let statusControl = $('[data-maintenance-status]');
        if (!statusControl && visibilityControl?.closest) {
            const label = document.createElement('label');
            label.className = 'maintenance-visibility';
            label.innerHTML = 'Status <select data-maintenance-status><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select>';
            visibilityControl.closest('label').after(label);
            statusControl = label.querySelector('select');
            statusControl.addEventListener('change', () => visibilityControl.dispatchEvent(new Event('change')));
        }
        if (statusControl) statusControl.closest('label').hidden = !maintenanceView;
        const visibility = visibilityControl?.value || 'shared';
        const maintenanceStatus = statusControl?.value || 'active';
        let list = clients.filter(client => (visibility === 'all' || (client.visibility || 'shared') === visibility)
            && (!maintenanceView || maintenanceStatus === 'all' || (maintenanceActive(client) ? 'active' : 'inactive') === maintenanceStatus));
        if (filter.types) list = list.filter((client) => hasService(client, filter.types));
        let summary = $('[data-income-summary]');
        if (!summary && heading) {
            summary = document.createElement('div');
            summary.dataset.incomeSummary = '';
            summary.setAttribute('role', 'status');
            heading.before(summary);
        }
        if (summary) {
            const overview = filterId === 'dashboard';
            const incomeId = filterId === 'technical-seo' ? 'seo-clients' : filterId;
            const totals = incomeTotals(clients);
            const selected = totals.find(group => group.id === incomeId);
            summary.hidden = !overview && !selected;
            summary.className = overview ? 'income-summary income-summary--overview' : 'income-summary';
            summary.innerHTML = overview ? [
                ...totals,
                {id: 'dashboard', label: 'Grand Total', accent: 'total', amount: totals.reduce((sum, group) => sum + group.amount, 0), missing: totals.reduce((sum, group) => sum + group.missing, 0)},
            ].map(incomeCard).join('') : selected ? incomeCard(selected) : '';
        }
        const panel = $('[data-admin-panel="overview"]');
        if (panel && summary) {
            let header = panel.querySelector('.clients-header');
            if (!header) {
                header = document.createElement('div');
                header.className = 'clients-header';
                const intro = document.createElement('div');
                intro.className = 'clients-header__intro';
                panel.prepend(header);
                header.append(intro);
                for (const el of [panel.querySelector('.admin-panel__title'), panel.querySelector('.admin-panel__lead'), panel.querySelector('.admin-clients-toolbar'), visibilityControl?.closest('label')]) {
                    if (el) intro.append(el);
                }
            }
            const single = !summary.hidden && filterId !== 'dashboard';
            header.classList.toggle('clients-header--income', single);
            if (single) header.append(summary);
            else if (filterId === 'dashboard') header.after(summary);
            else heading.before(summary);
        }
        let alphabet = $('[data-client-alphabet]');
        if (!alphabet && heading) {
            alphabet = document.createElement('nav');
            alphabet.dataset.clientAlphabet = '';
            alphabet.className = 'client-alphabet';
            alphabet.setAttribute('aria-label', 'Filter clients by first letter');
            alphabet.dataset.letter = '';
            heading.before(alphabet);
            alphabet.addEventListener('click', event => {
                const button = event.target.closest('[data-client-letter]');
                if (!button) return;
                alphabet.dataset.letter = button.dataset.clientLetter;
                visibilityControl.dispatchEvent(new Event('change'));
            });
        }
        if (alphabet) {
            alphabet.hidden = filterId !== 'overview';
            if (!alphabet.hidden) {
                const letter = alphabet.dataset.letter || '';
                const initial = client => String(client.name || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
                const available = new Set(list.filter(client => matchesQuery(client, query)).map(initial));
                alphabet.innerHTML = ['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'].map(value => {
                    const enabled = !value || (value === '#' ? [...available].some(char => !/^[A-Z]$/.test(char)) : available.has(value));
                    if (!enabled) return '';
                    return `<button type="button" data-client-letter="${value}" aria-pressed="${letter === value}" ${enabled ? '' : 'disabled'}>${value || 'All'}</button>`;
                }).join('');
                if (letter) list = list.filter(client => letter === '#' ? !/^[A-Z]$/.test(initial(client)) : initial(client) === letter);
                list.sort((a,b)=>a.name.localeCompare(b.name));
            }
        }
        list = list.filter((client) => matchesQuery(client, query));
        if (heading) heading.textContent = `${filter.heading} · ${list.length}`;
        const hostingView=filterId==='hosting-clients';
        const viewTypes=filterId==='management-clients'?['management']:filterId==='maintenance-clients'?['maintenance']:['seo-clients','technical-seo'].includes(filterId)?['seo','aeo','geo','technical-seo','content','ads','google-ads']:null;
        const packageView=Boolean(viewTypes);
        if(hostingView)list.sort((a,b)=>(renewalDay(a)||'9999-12-31').localeCompare(renewalDay(b)||'9999-12-31')||a.name.localeCompare(b.name));
        const tableHead=document.querySelector('.admin-clients-table thead tr');
        if(tableHead)tableHead.innerHTML=hostingView?'<th>Client</th><th>Contact</th><th>Hosting plan</th><th>Next Billing</th>':'<th>Client</th><th>Contact</th><th>Services</th>'+(packageView?'<th>Billing Rate</th><th>Billing Frequency</th>':'')+(maintenanceView?'<th>Next Billing</th><th>Status</th>':'');
        if (tableHead) {
            if (['seo-clients','technical-seo'].includes(filterId)) tableHead.innerHTML = tableHead.innerHTML.replace('Billing Frequency','Next Billing');
            tableHead.innerHTML += '<th>Actions</th>';
        }
        body.innerHTML = list
            .map((client) => {
                const href = `/clients/?client=${encodeURIComponent(client.slug)}#new-client`;
                const plans=packageView?(client.services||[]).filter(plan=>viewTypes.includes(plan.type)):[];
                const planLabel=plan=>SERVICE_LABELS.find(row=>row.types.includes(plan.type))?.label||plan.type;
                const prices=plans.map(plan=>`<div>${maintenanceView||['seo-clients','technical-seo','management-clients'].includes(filterId)?'':escapeHtml(planLabel(plan))+': '}${plan.amount===null||plan.amount===undefined||plan.amount===''?'Not recorded':escapeHtml(money(plan.amount))}</div>`).join('')||'Not recorded';
                const cycles=[...new Set(plans.map(plan=>plan.cycle==='yearly'?'Yearly':plan.cycle==='monthly'?'Monthly':'' ).filter(Boolean))].join(' / ') || (['seo-clients','technical-seo'].includes(filterId) ? 'Monthly' : '—');
                return `<tr class="admin-clients-table__row" data-open-client="${escapeHtml(client.slug)}" data-href="${href}" tabindex="0">
                    <td>
                        <a class="admin-clients-table__hit" href="${href}">
                            <strong>${escapeHtml(client.name)}</strong>${client.visibility === 'private' ? '<span class="admin-pill">Private / Gary only</span>' : ''}
                            <div class="admin-muted">${escapeHtml(client.email || 'No email')}</div>
                        </a>
                    </td>
                    <td>${escapeHtml(client.contactName || '—')}</td>
                    <td class="admin-services">${hostingView ? escapeHtml(cycleLabel(serviceOf(client, 'hosting') || {})) : servicePills(client,viewTypes)}</td>${hostingView ? `<td>${renewalPill(client)}</td>` : ''}${packageView?`<td>${prices}</td><td>${['seo-clients','technical-seo','management-clients'].includes(filterId)?`<span class="renewal-date">${['seo-clients','technical-seo'].includes(filterId)?escapeHtml(formatDay(nextMaintenanceBill({}))):cycles}</span>`:cycles}</td>`:''}${maintenanceView ? `<td>${renewalPill(client,'maintenance')}</td><td><button type="button" data-maintenance-toggle="${escapeHtml(client.slug)}" aria-label="${maintenanceActive(client) ? 'Deactivate' : 'Activate'} maintenance for ${escapeHtml(client.name)}">${maintenanceActive(client) ? 'Active' : 'Inactive'}</button></td>` : ''}
                    <td><button type="button" class="client-update-button" data-edit-client="${escapeHtml(client.slug)}">Update client</button></td>
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
                        <button type="button" data-edit-project="${escapeHtml(project.slug)}">Edit Portfolio</button>
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
        const portfolioDialog = document.createElement('dialog');
        portfolioDialog.className = 'client-dialog portfolio-dialog';
        portfolioDialog.setAttribute('aria-labelledby','portfolio-dialog-title');
        portfolioDialog.innerHTML = '<div class="client-dialog__bar"><h2 id="portfolio-dialog-title">Add Portfolio</h2><button type="button" aria-label="Close portfolio editor">Close</button></div><div class="portfolio-dialog__messages"></div>';
        document.body.append(portfolioDialog);
        const portfolioMessageHome = document.createComment('portfolio messages');
        errorEl.before(portfolioMessageHome);
        if (form) {
            const add = document.createElement('button');
            add.type='button';add.className='workspace-action';add.textContent='Add Portfolio';
            form.before(add);portfolioDialog.append(form);
            add.addEventListener('click',()=>openPortfolio(null));
        }
        function openPortfolio(project) {
            fillProjectForm(form,project);
            portfolioDialog.querySelector('h2').textContent=project?'Edit Portfolio':'Add Portfolio';
            portfolioDialog.querySelector('.portfolio-dialog__messages').append(errorEl,okEl);
            show(errorEl,'');show(okEl,'');
            if(!portfolioDialog.open)portfolioDialog.showModal();
            portfolioDialog.scrollTop=0;
            form.querySelector('input:not([type=hidden])')?.focus({preventScroll:true});
            document.body.classList.add('client-dialog-open');
        }
        portfolioDialog.querySelector('button').addEventListener('click',()=>portfolioDialog.close());
        portfolioDialog.addEventListener('close',()=>{
            portfolioMessageHome.after(errorEl,okEl);
            document.body.classList.remove('client-dialog-open');
        });
        const clientForm = $('[data-client-form]');
        if (clientForm && !clientForm.elements.monthlyReportEnabled) {
            const field=document.createElement('label');field.className='monthly-report-setting';
            field.innerHTML='<strong>Monthly SEO report</strong><select name="monthlyReportEnabled"><option value="no">No</option><option value="yes">Yes</option></select><small>Create a monthly report on the first saved work entry, then keep it up to date. No entries means no report.</small>';
            const choices=clientForm.querySelector('input[name="serviceTypes"]')?.closest('.admin-service-checks');
            if(choices)choices.after(field);else clientForm.append(field);
        }
        for (const type of ['maintenance', 'management', 'seo', 'aeo']) {
            const amount = clientForm?.elements[`${type}Amount`];
            if (!amount || clientForm.elements[`${type}Cycle`]) continue;
            const field = document.createElement('label');
            field.innerHTML = `Billing Frequency<select name="${type}Cycle"><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>`;
            amount.closest('label').after(field);
        }
        const clientPanel = $('[data-admin-panel="new-client"]');
        const clientPanelHome = document.createComment('client editor');
        clientPanel.before(clientPanelHome);
        const clientDialog = document.createElement('dialog');
        clientDialog.className = 'client-dialog';
        clientDialog.setAttribute('aria-labelledby', 'client-dialog-title');
        clientDialog.innerHTML = '<div class="client-dialog__bar"><h2 id="client-dialog-title">Add client</h2><button type="button" data-close-client-dialog aria-label="Close client editor">Close</button></div><div class="client-dialog__messages"></div>';
        document.body.append(clientDialog);
        const errorHome = document.createComment('client messages');
        errorEl.before(errorHome);
        async function openClientDialog(slug) {
            try {
                let client = null;
                if (slug) {
                    const result = await request(`/api/clients/${encodeURIComponent(slug)}`);
                    client = result.client;
                    if (!client) throw new Error('Could not load this client. Try again.');
                }
                fillClientForm(client);
                clientDialog.querySelector('h2').textContent = client ? `Update ${client.name}` : 'Add client';
                clientDialog.append(clientPanel);
                clientPanel.hidden = false;
                clientDialog.querySelector('.client-dialog__messages').append(errorEl, okEl);
                show(errorEl, ''); show(okEl, '');
                if (!clientDialog.open) clientDialog.showModal();
                document.body.classList.add('client-dialog-open');
                clientDialog.scrollTop = 0;
                clientForm.querySelector('input:not([type=hidden]):not([disabled]), select:not([disabled])')?.focus({preventScroll: true});
            } catch (error) { show(errorEl, error.message); }
        }
        clientDialog.querySelector('[data-close-client-dialog]').addEventListener('click', () => clientDialog.close());
        clientDialog.addEventListener('close', () => {
            clientPanel.hidden = true;
            clientPanelHome.after(clientPanel);
            errorHome.after(errorEl, okEl);
            document.body.classList.remove('client-dialog-open');
        });
        document.addEventListener('click', event => {
            const edit = event.target.closest('[data-edit-client]');
            const add = event.target.closest('[data-admin-section="new-client"], a[href="#new-client"], a[href="/clients/#new-client"]');
            if (!edit && !add) return;
            event.preventDefault(); event.stopImmediatePropagation();
            openClientDialog(edit?.dataset.editClient);
        }, true);
        if (clientForm && !clientForm.elements.maintenanceNextBillDate) {
            const field=document.createElement('label');
            field.innerHTML='Next billing date<input type="date" name="maintenanceNextBillDate">';
            clientForm.elements.maintenanceCycle?.closest('label').after(field);
        }
        const taxInput = clientForm?.elements.taxAmount;
        if (taxInput && taxInput.tagName !== 'SELECT') {
            const select = document.createElement('select'); select.name = 'taxAmount';
            select.innerHTML = '<option value="0">None</option><option value="0.13">HST 13%</option><option value="0.05">GST 5%</option>';
            taxInput.replaceWith(select);
        }
        const serviceChoices = clientForm?.querySelector('input[name="serviceTypes"]')?.closest('.admin-service-checks');
        if (serviceChoices) {
            const primary = ['maintenance','aeo','geo','technical-seo','website','content','ads','design'];
            const ordered = [...primary.map(type=>SERVICE_LABELS.find(row=>row.types[0]===type)), ...SERVICE_LABELS.filter(row=>!primary.includes(row.types[0]))];
            serviceChoices.innerHTML = ordered.map(row=>`<label class="portal-check"><input type="checkbox" name="serviceTypes" value="${row.types[0]}"><span class="admin-pill service-pill" data-service="${row.types[0]}">${row.label}</span></label>`).join('');
        }
        if (clientForm && !clientForm.querySelector('.client-editor-account')) {
            const account = document.createElement('section');
            account.className = 'client-editor-section client-editor-account';
            const accountHeading = document.createElement('h3');
            accountHeading.textContent = 'Account Details';
            account.append(accountHeading);
            const accountType = clientForm.querySelector('[name="accountType"]')?.closest('label');
            const lead = clientForm.querySelector('[data-account-lead]');
            const grid = clientForm.querySelector('.dash-form__grid');
            clientForm.prepend(account);
            for (const element of [accountType, lead, grid]) if(element) account.append(element);
            for (const section of [...clientForm.children]) {
                if (section.tagName !== 'DIV' || section.classList.contains('dash-form__actions')) continue;
                const heading = section.querySelector('h3');
                if (!heading) continue;
                section.classList.add('client-editor-section');
                if (/credentials/i.test(heading.textContent)) { heading.textContent='Client Credentials';section.classList.add('client-editor-credentials'); }
                else if (/total revenue/i.test(heading.textContent)) { heading.textContent='Billing Summary';section.classList.add('client-editor-billing'); }
                else if (/work with us/i.test(heading.textContent)) heading.textContent='Work With Us';
                else if (/services/i.test(heading.textContent)) heading.textContent='Service Pricing';
            }
            for (const block of clientForm.querySelectorAll('[data-package-block]')) {
                const type=block.dataset.packageBlock;
                const label=block.querySelector('.portal-check span');
                if(label){label.classList.add('admin-pill','service-pill');label.dataset.service=type;}
            }
        }
        const inviteCard = $('[data-invite-card]');
        const inviteUrlEl = $('[data-invite-url]');
        const inviteBtn = $('[data-invite-client]');
        const temporaryAccess = $('[data-temporary-access]');
        const temporaryEmail = $('[data-temporary-email]');
        const temporaryPassword = $('[data-temporary-password]');
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
            const isPrivate = isClient && clientForm.visibility?.value === 'private';
            if (clientForm.email) clientForm.email.required = !isPrivate;
            if (inviteBtn && isPrivate) inviteBtn.hidden = true;
            $$('[data-admin-client-only]', clientForm).forEach((el) => {
                el.hidden = !isClient;
            });
            const nameLabel = $('[data-name-label]', clientForm);
            if (nameLabel) nameLabel.textContent = isClient ? 'Contact name' : 'Full name';
            const lead = $('[data-account-lead]');
            if (lead) {
                lead.textContent = isPrivate ? 'Private / Gary only. No client portal account or invitation is created.' : isClient
                    ? 'Manage client records here. Portal accounts and invitations are separate actions.'
                    : type === 'super-admin'
                      ? 'Super admins can create clients and invite other admins.'
                      : 'Admins can manage clients and the dashboard, but cannot invite other admins.';
            }
            if (clientForm.name) clientForm.name.required = isClient && !clientForm.slug.value;
            if (clientForm.contactName) clientForm.contactName.required = !isClient;
            const submit = clientForm.querySelector('[type="submit"]');
            if (submit && !clientForm.slug.value) {
                submit.textContent = isClient ? 'Add client' : type === 'super-admin' ? 'Add super admin' : 'Add admin';
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
                    <td><span class="team-member"><img src="${escapeHtml(row.avatarUrl || '/assets/icons/favicon-192x192.png')}" alt="" width="36" height="36">${escapeHtml(row.name || '—')}</span></td>
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
            window.dispatchEvent(new CustomEvent('workspace-data', {detail:data}));
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

        function showTemporaryAccess(account) {
            const password = account?.temporaryPassword || '';
            if (!temporaryAccess || !temporaryEmail || !temporaryPassword) return;
            temporaryAccess.hidden = !password;
            temporaryEmail.value = password ? account?.email || '' : '';
            temporaryPassword.value = password;
        }

        function fillClientForm(client) {
            if (!clientForm) return;
            clientForm.slug.value = client?.slug || '';
            if (clientForm.visibility) {clientForm.visibility.value=client?.visibility || 'shared';clientForm.visibility.disabled=!user.canManagePrivateClients;}
            if (clientForm.accountType) clientForm.accountType.value = 'client';
            clientForm.name.value = client?.name || '';
            clientForm.contactName.value = client?.contactName || '';
            clientForm.email.value = client?.email || '';
            clientForm.elements.phone.value = client?.phone || '';
            clientForm.elements.website.value = client?.website || '';
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
            if (inviteBtn) inviteBtn.hidden = !client || client.visibility === 'private';
            const archiveBtn = $('[data-archive-client-btn]', clientForm);
            if (archiveBtn) {
                archiveBtn.hidden = !client?.slug;
                if (client?.slug) archiveBtn.setAttribute('data-archive-client', client.slug);
                else archiveBtn.removeAttribute('data-archive-client');
            }
            showInvite(null);
            showTemporaryAccess(null);
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
            setPackageOn(clientForm, 'management', Boolean(management));
            setPackageOn(clientForm, 'seo', Boolean(seo));
            setPackageOn(clientForm, 'aeo', Boolean(aeo));
            setPackageOn(clientForm, 'maintenance', Boolean(maintenance));
            if (clientForm.hostingAmount) clientForm.hostingAmount.value = billedAmount(hosting);
            if (clientForm.hostingCycle) clientForm.hostingCycle.value = hosting?.cycle === 'monthly' ? 'monthly' : 'yearly';
            if (clientForm.hostingLastBilled) clientForm.hostingLastBilled.value = (hosting?.lastBilled || '').slice(0, 10);
            if (clientForm.hostingNextBillDate) clientForm.hostingNextBillDate.value = (hosting?.nextBillDate || '').slice(0, 10);
            if (clientForm.managementAmount) clientForm.managementAmount.value = billedAmount(management);
            if (clientForm.managementCycle) clientForm.managementCycle.value = management?.cycle || 'monthly';
            if (clientForm.elements.monthlyReportEnabled) clientForm.elements.monthlyReportEnabled.value = client?.monthlyReportEnabled ? 'yes' : 'no';
            if (clientForm.seoAmount) clientForm.seoAmount.value = billedAmount(seo);
            if (clientForm.seoCycle) clientForm.seoCycle.value = seo?.cycle || 'monthly';
            if (clientForm.aeoAmount) clientForm.aeoAmount.value = billedAmount(aeo);
            if (clientForm.aeoCycle) clientForm.aeoCycle.value = aeo?.cycle || 'monthly';
            if (clientForm.maintenanceAmount) clientForm.maintenanceAmount.value = billedAmount(maintenance);
            if (clientForm.maintenanceCycle) clientForm.maintenanceCycle.value = maintenance?.cycle || 'monthly';
            if (clientForm.maintenanceNextBillDate) clientForm.maintenanceNextBillDate.value = nextMaintenanceBill(client || {});
            if (clientForm.discount) clientForm.discount.value = Number(client?.discount) > 0 ? String(client.discount) : '';
            if (clientForm.taxAmount) clientForm.taxAmount.value = [0.13, 0.05].includes(Number(client?.taxAmount)) ? String(Number(client.taxAmount)) : '0';
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
            event.preventDefault();
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
            else if ($(`[data-admin-panel="${id}"]`)) setSection(id, clientFilter);
            else showClients('overview');
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
                    document.querySelector('[data-admin-panel="new-client"] .admin-panel__title').textContent=client.name;
                    const actions=document.createElement('div');actions.className='workspace-tabs';actions.innerHTML=`<a href='/clients/#overview'>← All Clients</a><a href='/clients/?credentialClient=${encodeURIComponent(client.slug)}#credentials'>Credentials</a><a href='/clients/#reports'>Reports</a><a href='/google-platforms/'>Google accounts</a>`;clientForm.before(actions);
                }
            })();
        }
        $('[data-visibility-filter]')?.addEventListener('change', () => renderClientsTable(data.clients,clientFilter,clientQuery));
        if (clientForm?.visibility) clientForm.visibility.disabled=!user.canManagePrivateClients;
        clientForm?.visibility?.addEventListener('change', syncAccountType);
        $('[data-client-search]')?.addEventListener('input', (event) => {
            clientQuery = String(event.target.value || '').trim().toLowerCase();
            renderClientsTable(data.clients, clientFilter, clientQuery);
        });
        $('[data-clients-body]')?.addEventListener('click', async (event) => {
            const toggle = event.target.closest('[data-maintenance-toggle]');
            if (toggle) {
                const client = data.clients.find(row => row.slug === toggle.dataset.maintenanceToggle);
                if (!client) return;
                toggle.disabled = true;
                const status = maintenanceActive(client) ? 'inactive' : 'active';
                try {
                    const existing = serviceOf(client, 'maintenance');
                    await request(`/api/clients/${encodeURIComponent(client.slug)}/services${existing ? '/maintenance' : ''}`, {
                        method: existing ? 'PATCH' : 'POST', body: {type: 'maintenance', status},
                    });
                    if (existing) existing.status = status;
                    else (client.services ||= []).push({type: 'maintenance', status});
                    renderClientsTable(data.clients, clientFilter, clientQuery);
                    show(okEl, `${client.name} maintenance is now ${status}.`);
                } catch (error) {
                    toggle.disabled = false;
                    show(errorEl, error.message || 'Could not save maintenance status. Try again.');
                }
                return;
            }
            const row = event.target.closest('tr[data-open-client]');
            if (!row || event.target.closest('a, button, select')) return;
            location.href = row.getAttribute('data-href');
        });
        $('[data-clients-body]')?.addEventListener('keydown', (event) => {
            if (event.target.closest('button, select, a') || (event.key !== 'Enter' && event.key !== ' ')) return;
            const row = event.target.closest('tr[data-open-client]');
            if (!row) return;
            event.preventDefault();
            location.href = row.getAttribute('data-href');
        });
        $('[data-client-account-body]')?.addEventListener('click', (event) => {
            const row = event.target.closest('tr[data-href]');
            if (!row || event.target.closest('a, button, select')) return;
            location.href = row.getAttribute('data-href');
        });
        $('[data-client-account-body]')?.addEventListener('keydown', (event) => {
            if (event.target.closest('button, select, a') || (event.key !== 'Enter' && event.key !== ' ')) return;
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
                          issueTemporaryPassword: true,
                      }
                    : {
                          visibility: clientForm.visibility?.value || 'shared',
                          name: clientForm.name.value,
                          contactName: clientForm.contactName.value,
                          email: clientForm.email.value,
                          phone: clientForm.elements.phone.value,
                          website: /^https?:\/\/$/i.test(String(clientForm.elements.website.value || '').trim())
                              ? ''
                              : clientForm.elements.website.value,
                          ...packagePayload(clientForm),
                      };
                if (!isStaffAccount && (!clientForm.slug.value || clientForm.dataset.credentialsLoaded === '1')) {
                    Object.assign(payload, readCredentialState($('[data-credential-list]', clientForm)));
                }
                const slug = clientForm.slug.value;
                if (slug) {
                    await request(`/api/clients/${encodeURIComponent(slug)}`, { method: 'PATCH', body: payload });
                    await refresh();
                    const fresh = await request(`/api/clients/${encodeURIComponent(slug)}`);
                    if (fresh.client) {
                        data.clients = data.clients.map(client => client.slug === slug ? {...client, ...fresh.client} : client);
                        paint();
                    }
                    show(okEl, 'Client updated.');
                    if (clientDialog.open) clientDialog.close();
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
                if (clientDialog.open) clientPanel.hidden = false;
                showTemporaryAccess(created.account);
                showInvite(created.account?.temporaryPassword ? null : created.invite);
                const emailed = created.invite?.emailed;
                const who = created.account?.email || created.invite?.email || payload.email;
                const kind = isStaffAccount ? (type === 'super-admin' ? 'Super admin' : 'Admin') : 'Client';
                show(
                    okEl,
                    !isStaffAccount
                        ? 'Client record created. No portal account was created and no email was sent.'
                        : emailed
                        ? `${kind} ready. A login email was sent to ${who}, and the temporary login is shown below.`
                        : `${kind} ready. Copy the temporary login below and send it securely to ${who}.`
                );
            } catch (error) {
                show(errorEl, error.message || 'Could not save that client.');
            } finally {
                submit.disabled = false;
            }
        });

        $('[data-create-portal-account]', clientForm)?.addEventListener('click', async () => {
            const slug = clientForm.slug.value;
            if (!slug) return show(errorEl, 'Save the client record first.');
            try {
                const response = await fetch(`/api/clients/${encodeURIComponent(slug)}/account`, { method: 'POST', credentials: 'same-origin' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not create portal account');
                show(okEl, `Portal account ready for ${result.account.email}. No email was sent. Use Send login link to invite them.`);
            } catch (error) { show(errorEl, error.message); }
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

        $('[data-copy-temporary-access]')?.addEventListener('click', async () => {
            const email = temporaryEmail?.value || '';
            const password = temporaryPassword?.value || '';
            if (!email || !password) return;
            const details = [
                'Leanne Digital login',
                `Email: ${email}`,
                `Temporary password: ${password}`,
                'Login: https://leannedigital.com/login/',
                'You will be asked to choose a permanent password after signing in.',
            ].join('\n');
            try {
                await navigator.clipboard.writeText(details);
                show(okEl, 'Temporary login details copied.');
            } catch {
                temporaryPassword.select();
                show(errorEl, 'Copy failed — select the temporary password and copy it manually.');
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
                if(portfolioDialog.open)portfolioDialog.close();
                show(okEl, payload.slug ? 'Portfolio updated.' : 'Portfolio added.');
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
                    setSection('portfolio');
                    openPortfolio(project);
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
