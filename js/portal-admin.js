(function () {
    const LABELS = {
        seo: 'SEO',
        aeo: 'AEO',
        hosting: 'Hosting',
        maintenance: 'Maintenance',
        management: 'Site management',
    };
    const RECURRING = ['seo', 'aeo', 'maintenance', 'management'];
    const RENEWAL_DAYS = 60;

    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function money(amount) {
        const n = Number(amount) || 0;
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD',
            maximumFractionDigits: 0,
        }).format(n);
    }

    function day(value) {
        if (!value) return '';
        const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function amountOf(service) {
        return Number(service?.amount) || 0;
    }

    function service(client, type) {
        return (client.services || []).find((row) => row.type === type) || null;
    }

    function bootstrap() {
        const el = document.getElementById('ld-clients-data');
        if (!el) return [];
        try {
            return JSON.parse(el.textContent || '[]');
        } catch {
            return [];
        }
    }

    function hostingStatus(nextBillDate, now) {
        if (!nextBillDate) return 'unbilled';
        const due = new Date(String(nextBillDate).includes('T') ? nextBillDate : `${nextBillDate}T00:00:00`);
        if (Number.isNaN(due.getTime())) return 'unbilled';
        const days = Math.round((due.getTime() - now.getTime()) / 86400000);
        if (days < 0) return 'overdue';
        if (days <= RENEWAL_DAYS) return 'due-soon';
        return 'upcoming';
    }

    function statusLabel(status) {
        if (status === 'overdue') return 'Overdue';
        if (status === 'due-soon') return 'Due soon';
        if (status === 'unbilled') return 'No due date';
        return 'Upcoming';
    }

    function hostingRows(clients, now) {
        const rows = [];
        for (const client of clients) {
            const hosting = service(client, 'hosting');
            const hosted = amountOf(hosting) || client.hosting?.lddHosted || client.hosting?.type === 'LDD';
            if (!hosted && !hosting) continue;
            const amount = amountOf(hosting);
            const cycle = hosting?.cycle === 'monthly' ? 'monthly' : amount ? 'yearly' : '';
            const nextBillDate = hosting?.nextBillDate || '';
            rows.push({
                slug: client.slug,
                name: client.name,
                amount,
                cycle,
                lastBilled: hosting?.lastBilled || '',
                nextBillDate,
                status: hostingStatus(nextBillDate, now),
            });
        }
        rows.sort((a, b) => {
            if (!a.nextBillDate) return 1;
            if (!b.nextBillDate) return -1;
            return String(a.nextBillDate).localeCompare(String(b.nextBillDate));
        });
        return rows;
    }

    function recurringKind(client) {
        const types = [...new Set(
            (client.services || [])
                .filter((row) => RECURRING.includes(row.type) && amountOf(row))
                .map((row) => row.type)
        )];
        if (types.length >= 2) return 'combo';
        return types[0] || null;
    }

    function statsFrom(clients) {
        const now = new Date();
        const accounts = hostingRows(clients, now);
        const recurring = { seo: 0, aeo: 0, maintenance: 0, management: 0, combo: 0 };
        let monthly = 0;
        let yearly = 0;
        let managementMonthly = 0;
        let hostingMonthly = 0;
        let allTime = 0;
        for (const client of clients) {
            for (const row of client.services || []) {
                const amount = amountOf(row);
                if (!amount) continue;
                const yearlyCycle = row.cycle === 'yearly';
                if (yearlyCycle) yearly += amount;
                else monthly += amount;
                allTime += amount;
                if (row.type === 'management' && !yearlyCycle) managementMonthly += amount;
                if (row.type === 'hosting') hostingMonthly += yearlyCycle ? amount / 12 : amount;
            }
            const kind = recurringKind(client);
            if (kind) recurring[kind] += 1;
        }
        return {
            clients: clients.length,
            hosting: accounts.length,
            renewals: accounts.filter((row) => row.status === 'overdue' || row.status === 'due-soon').length,
            retainers: recurring.seo + recurring.aeo + recurring.maintenance + recurring.management + recurring.combo,
            recurring,
            monthly,
            yearly,
            managementMonthly,
            hostingMonthly,
            annualized: monthly * 12 + yearly,
            allTime,
            accounts,
        };
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function clientTotal(client) {
        const billed = (client.services || []).filter((row) => amountOf(row));
        const monthly = billed.filter((row) => row.cycle !== 'yearly');
        const yearly = billed.filter((row) => row.cycle === 'yearly');
        const parts = [];
        if (monthly.length) {
            parts.push(`${money(monthly.reduce((sum, row) => sum + amountOf(row), 0))} / month`);
        }
        if (yearly.length) {
            parts.push(`${money(yearly.reduce((sum, row) => sum + amountOf(row), 0))} / year`);
        }
        return parts.join(' · ') || 'Active client';
    }

    function setStat(key, value) {
        const el = document.querySelector(`[data-stat="${key}"]`);
        if (el) el.textContent = value;
    }

    function render(clients) {
        const stats = statsFrom(clients);
        setStat('clients', String(stats.clients));
        setStat('hosting', String(stats.hosting));
        setStat('renewals', String(stats.renewals));
        setStat('retainers', String(stats.retainers));
        setStat('recurring-seo', String(stats.recurring.seo));
        setStat('recurring-aeo', String(stats.recurring.aeo));
        setStat('recurring-maintenance', String(stats.recurring.maintenance));
        setStat('recurring-management', String(stats.recurring.management));
        setStat('recurring-combo', String(stats.recurring.combo));
        setStat('rev-monthly', money(stats.monthly));
        setStat('rev-yearly', money(stats.yearly));
        setStat('rev-management', money(stats.managementMonthly));
        setStat('rev-hosting', money(Math.round(stats.hostingMonthly)));
        setStat('rev-annualized', money(stats.annualized));
        setStat('rev-alltime', money(stats.allTime));

        const body = $('[data-hosting-body]');
        if (body) {
            body.innerHTML = stats.accounts
                .map((row) => {
                    const cycle = row.cycle === 'monthly' ? 'Monthly' : row.cycle === 'yearly' ? 'Yearly' : '—';
                    return `<tr class="dash-hosting__row dash-hosting__row--${escapeHtml(row.status)}">
                        <td><a href="/clients/${escapeHtml(row.slug)}/">${escapeHtml(row.name)}</a></td>
                        <td>${escapeHtml(row.amount ? money(row.amount) : '—')}</td>
                        <td>${escapeHtml(cycle)}</td>
                        <td>${escapeHtml(day(row.lastBilled) || '—')}</td>
                        <td>${escapeHtml(day(row.nextBillDate) || '—')}</td>
                        <td>${escapeHtml(statusLabel(row.status))}</td>
                    </tr>`;
                })
                .join('');
        }

        const grid = $('[data-clients-grid]');
        if (grid) {
            grid.innerHTML = clients
                .slice()
                .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                .map((client) => {
                    const tags = [...new Set((client.services || []).filter((row) => amountOf(row)).map((row) => row.type))]
                        .map((type) => `<span class="client-tag">${escapeHtml(LABELS[type] || type)}</span>`)
                        .join('');
                    return `<article class="client-card" data-client-slug="${escapeHtml(client.slug)}">
                    <a href="/clients/${escapeHtml(client.slug)}/">
                    <h2 class="client-card__name">${escapeHtml(client.name)}</h2>
                    <p class="client-card__tags">${tags}</p>
                    <p class="client-card__meta">${escapeHtml(clientTotal(client))}</p>
                    <span class="client-card__cta">Open client</span>
                    </a>
                    <p class="client-card__admin">
                        <button type="button" data-edit-client="${escapeHtml(client.slug)}">Edit</button>
                        <button type="button" data-delete-client="${escapeHtml(client.slug)}">Delete</button>
                    </p>
                </article>`;
                })
                .join('');
        }
    }

    function payloadFrom(form) {
        const data = Object.fromEntries(new FormData(form).entries());
        const numberish = [
            'hostingAmount',
            'seoAmount',
            'aeoAmount',
            'maintenanceAmount',
            'managementAmount',
        ];
        for (const key of numberish) {
            if (data[key] === '') data[key] = '';
        }
        return data;
    }

    function fillForm(form, client) {
        form.reset();
        form.slug.value = client.slug || '';
        form.name.value = client.name || '';
        form.email.value = client.email || '';
        form.website.value = client.website || '';
        form.platform.value = client.platform || 'WordPress';
        const hosting = service(client, 'hosting');
        form.hostingAmount.value = hosting?.amount || '';
        form.hostingCycle.value = hosting?.cycle === 'monthly' ? 'monthly' : 'yearly';
        form.hostingLastBilled.value = (hosting?.lastBilled || '').slice(0, 10);
        form.hostingNextBillDate.value = (hosting?.nextBillDate || '').slice(0, 10);
        form.managementAmount.value = service(client, 'management')?.amount || '';
        form.seoAmount.value = service(client, 'seo')?.amount || '';
        form.aeoAmount.value = service(client, 'aeo')?.amount || '';
        form.maintenanceAmount.value = service(client, 'maintenance')?.amount || '';
        form.querySelector('[type="submit"]').textContent = 'Save changes';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function boot({ api, user }) {
        if (!user || user.role !== 'staff') return;
        const form = $('[data-client-form]');
        if (!form) return;

        const errorEl = $('[data-form-error]', form);
        const okEl = $('[data-form-ok]', form);
        let clients = bootstrap();

        function show(el, message) {
            if (!el) return;
            el.hidden = !message;
            el.textContent = message || '';
        }

        async function refresh() {
            const data = await api.clients('list');
            let list = data.clients || [];
            if (!list.length && clients.length) {
                const seeded = await api.clients('seed', { clients });
                list = seeded.clients || clients;
            }
            clients = list;
            render(clients);
        }

        try {
            await refresh();
        } catch (error) {
            render(clients);
            show(errorEl, error.message || 'Showing saved dashboard data. Edits may not persist until the portal API is available.');
        }

        form.platform.addEventListener('change', () => {
            if (form.slug.value) return;
            if (form.platform.value === 'Static' && !form.managementAmount.value) {
                form.managementAmount.value = '50';
            }
        });

        form.addEventListener('reset', () => {
            form.slug.value = '';
            form.querySelector('[type="submit"]').textContent = 'Save client';
            show(errorEl, '');
            show(okEl, '');
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            show(errorEl, '');
            show(okEl, '');
            const payload = payloadFrom(form);
            const submit = form.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                const op = payload.slug ? 'update' : 'create';
                const result = await api.clients(op, payload);
                if (result.clients) clients = result.clients;
                else await refresh();
                render(clients);
                form.reset();
                show(okEl, op === 'create' ? 'Client added.' : 'Client updated.');
            } catch (error) {
                show(errorEl, error.message || 'Could not save that client.');
            } finally {
                submit.disabled = false;
            }
        });

        document.addEventListener('click', async (event) => {
            const edit = event.target.closest('[data-edit-client]');
            if (edit) {
                const client = clients.find((row) => row.slug === edit.getAttribute('data-edit-client'));
                if (client) fillForm(form, client);
                return;
            }
            const del = event.target.closest('[data-delete-client]');
            if (!del) return;
            const slug = del.getAttribute('data-delete-client');
            const client = clients.find((row) => row.slug === slug);
            if (!client || !confirm(`Delete ${client.name}? This cannot be undone.`)) return;
            show(errorEl, '');
            show(okEl, '');
            try {
                const result = await api.clients('delete', { slug });
                clients = result.clients || clients.filter((row) => row.slug !== slug);
                render(clients);
                if (form.slug.value === slug) form.reset();
                show(okEl, `${client.name} deleted.`);
            } catch (error) {
                show(errorEl, error.message || 'Could not delete that client.');
            }
        });
    }

    if (window.__LD_PORTAL__) boot(window.__LD_PORTAL__);
    document.addEventListener('ld-portal-ready', (event) => boot(event.detail));
})();
