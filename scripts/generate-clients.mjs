import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    escapeHtml,
    renderFullFooter,
    renderHead,
    renderNav,
} from './layout.mjs';
import { SITE_URL } from './site-config.mjs';
import { loadClients } from './client-store.mjs';
import { portalStats, packageTotals } from './portal-stats.mjs';
import { generateLoginPages } from './generate-login.mjs';
import { generateAdminDashboard } from './generate-admin-dashboard.mjs';
import { rewriteLegacyLinks } from './seo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'data', 'client-reports');
const ROBOTS = 'noindex, nofollow';

const SERVICE_LABELS = {
    seo: 'SEO',
    aeo: 'AEO',
    hosting: 'Hosting',
    maintenance: 'Maintenance',
    management: 'Site management',
};

const CHART_ICON = `<span class="client-month-card__icon" aria-hidden="true">
                    <svg viewBox="0 0 512 512"><path fill="currentColor" d="M332.8 320h38.4c6.4 0 12.8-6.4 12.8-12.8V172.8c0-6.4-6.4-12.8-12.8-12.8h-38.4c-6.4 0-12.8 6.4-12.8 12.8v134.4c0 6.4 6.4 12.8 12.8 12.8zm96 0h38.4c6.4 0 12.8-6.4 12.8-12.8V76.8c0-6.4-6.4-12.8-12.8-12.8h-38.4c-6.4 0-12.8 6.4-12.8 12.8v230.4c0 6.4 6.4 12.8 12.8 12.8zm-288 0h38.4c6.4 0 12.8-6.4 12.8-12.8v-70.4c0-6.4-6.4-12.8-12.8-12.8h-38.4c-6.4 0-12.8 6.4-12.8 12.8v70.4c0 6.4 6.4 12.8 12.8 12.8zm96 0h38.4c6.4 0 12.8-6.4 12.8-12.8V108.8c0-6.4-6.4-12.8-12.8-12.8h-38.4c-6.4 0-12.8 6.4-12.8 12.8v198.4c0 6.4 6.4 12.8 12.8 12.8zM496 384H64V80c0-8.84-7.16-16-16-16H16C7.16 64 0 71.16 0 80v336c0 17.67 14.33 32 32 32h464c8.84 0 16-7.16 16-16v-32c0-8.84-7.16-16-16-16z"/></svg>
                </span>`;

function writePage(relativeDir, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function reportBody(slug, reportSlug) {
    const file = path.join(REPORTS_DIR, slug, `${reportSlug}.html`);
    if (!fs.existsSync(file)) return '';
    return rewriteLegacyLinks(fs.readFileSync(file, 'utf8'));
}

function money(amount, currency = 'CAD') {
    if (amount == null || amount === '') return '';
    const value = Number(amount);
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
    return `$${formatted} ${currency}`;
}

function serviceTotal(services = []) {
    return services.reduce((sum, service) => sum + (Number(service.amount) || 0), 0);
}

function cycleLabel(service) {
    if (!service?.amount) return '';
    if (service.cycle === 'yearly') return `${money(service.amount)} / year`;
    return `${money(service.amount)} / month`;
}

function serviceTags(client) {
    const types = [...new Set((client.services || []).map((service) => service.type))];
    if ((client.reports || []).length && !types.includes('seo')) types.unshift('seo');
    return types;
}

function portalScripts(depth, admin = false) {
    const prefix = '../'.repeat(depth);
    const adminScript = admin
        ? `\n    <script src="${prefix}js/portal-admin.js?v=20260815a" defer></script>`
        : '';
    return `    <script src="${prefix}js/site-nav.js" defer></script>
    <script src="${prefix}js/portal-auth.js?v=20260815a" defer></script>${adminScript}`;
}

function renderLinks(client) {
    const items = [];
    if (client.website) {
        items.push(
            `<a href="${escapeHtml(client.website)}" target="_blank" rel="noopener noreferrer">Website</a>`
        );
    }
    if (client.googleDrive) {
        items.push(
            `<a href="${escapeHtml(client.googleDrive)}" target="_blank" rel="noopener noreferrer">Google Drive</a>`
        );
    }
    return items.length ? `<p class="client-profile__links">${items.join('')}</p>` : '';
}

function formatDay(iso) {
    if (!iso) return '';
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function statusLabel(status) {
    if (status === 'overdue') return 'Overdue';
    if (status === 'due-soon') return 'Due soon';
    if (status === 'unbilled') return 'No due date';
    return 'Upcoming';
}

function renderDashboard(stats) {
    const currency = stats.totals.currency || 'CAD';
    const cards = [
        ['clients', 'Clients', String(stats.clients)],
        ['hosting', 'Website hosting', String(stats.hosting)],
        ['renewals', 'Up for renewal', String(stats.renewals.length)],
        ['retainers', 'Monthly retainers', String(stats.recurringClients)],
    ]
        .map(
            ([key, label, value]) => `                <article class="dash-stat">
                    <p class="dash-stat__value" data-stat="${key}">${escapeHtml(value)}</p>
                    <h2 class="dash-stat__label">${escapeHtml(label)}</h2>
                </article>`
        )
        .join('\n');
    const recurring = [
        ['recurring-seo', 'SEO', stats.recurring.seo],
        ['recurring-aeo', 'AEO', stats.recurring.aeo],
        ['recurring-maintenance', 'Site maintenance', stats.recurring.maintenance],
        ['recurring-management', 'Site management', stats.recurring.management],
        ['recurring-combo', 'Combo', stats.recurring.combo],
    ]
        .map(
            ([key, label, value]) => `                <article class="dash-stat dash-stat--sub">
                    <p class="dash-stat__value" data-stat="${key}">${value}</p>
                    <h2 class="dash-stat__label">${escapeHtml(label)}</h2>
                </article>`
        )
        .join('\n');
    const totals = [
        ['rev-monthly', 'Monthly total', money(stats.totals.monthly, currency)],
        ['rev-yearly', 'Yearly total', money(stats.totals.yearly, currency)],
        ['rev-management', 'Site management / mo', money(stats.totals.managementMonthly, currency)],
        ['rev-hosting', 'Hosting / mo (avg)', money(stats.totals.hostingMonthly, currency)],
        ['rev-annualized', 'Annualized', money(stats.totals.annualized, currency)],
        ['rev-alltime', 'All-time (est.)', money(stats.totals.allTime, currency)],
    ]
        .map(
            ([key, label, value]) => `                <article class="dash-stat dash-stat--money">
                    <p class="dash-stat__value" data-stat="${key}">${escapeHtml(value)}</p>
                    <h2 class="dash-stat__label">${escapeHtml(label)}</h2>
                </article>`
        )
        .join('\n');
    const hostingRows = (stats.hostingAccounts || [])
        .map((row) => {
            const cycle = row.cycle === 'monthly' ? 'Monthly' : row.cycle === 'yearly' ? 'Yearly' : '—';
            const amount = row.amount ? money(row.amount, currency) : '—';
            return `                    <tr class="dash-hosting__row dash-hosting__row--${escapeHtml(row.status)}">
                        <td><a href="/clients/${escapeHtml(row.slug)}/">${escapeHtml(row.name)}</a></td>
                        <td>${escapeHtml(amount)}</td>
                        <td>${escapeHtml(cycle)}</td>
                        <td>${escapeHtml(formatDay(row.lastBilled) || '—')}</td>
                        <td>${escapeHtml(formatDay(row.nextBillDate) || '—')}</td>
                        <td>${escapeHtml(statusLabel(row.status))}</td>
                    </tr>`;
        })
        .join('\n');
    const hostingTable = hostingRows
        ? `<div class="dash-table-wrap">
                <table class="dash-table">
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Amount paid</th>
                            <th>Cycle</th>
                            <th>Last paid</th>
                            <th>Next due</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody data-hosting-body>
${hostingRows}
                    </tbody>
                </table>
            </div>`
        : '<p class="client-empty">No website hosting accounts yet.</p>';

    return `            <section class="dash-panel" data-admin-only>
                <h2 class="client-reports__heading">Overview</h2>
                <div class="dash-grid">
${cards}
                </div>
                <h2 class="client-reports__heading">Monthly recurring clients</h2>
                <p class="dash-copy">SEO, AEO, site maintenance, static site management ($50+/mo), or a combo of those retainers.</p>
                <div class="dash-grid dash-grid--five">
${recurring}
                </div>
                <h2 class="client-reports__heading">Revenue</h2>
                <div class="dash-grid">
${totals}
                </div>
                <h2 class="client-reports__heading">Website hosting accounts</h2>
                <p class="dash-copy">Every hosting retainer, when it was last paid, and when the next bill is due.</p>
                ${hostingTable}
                <h2 class="client-reports__heading">Add or edit a client</h2>
                <form class="dash-form" data-client-form>
                    <p class="login-form__error" data-form-error hidden></p>
                    <p class="login-form__ok" data-form-ok hidden></p>
                    <input type="hidden" name="slug" value="">
                    <h3 class="dash-form__heading">Client</h3>
                    <div class="dash-form__grid">
                        <label>Client name
                            <input name="name" type="text" required>
                        </label>
                        <label>Portal login email
                            <input name="email" type="email" autocomplete="off">
                        </label>
                        <label>Website
                            <input name="website" type="url" placeholder="https://">
                        </label>
                        <label>Platform
                            <select name="platform">
                                <option value="WordPress">WordPress</option>
                                <option value="Static">Static site</option>
                                <option value="Shopify">Shopify</option>
                                <option value="Other">Other</option>
                            </select>
                        </label>
                    </div>
                    <h3 class="dash-form__heading">Credentials</h3>
                    <p class="dash-copy dash-copy--left">Logins for hosting, domain, email, and other apps. Staff only — clients never see this.</p>
                    <div class="dash-creds" data-credential-list></div>
                    <p><button class="dash-form__add" type="button" data-add-credential>Add login</button></p>
                    <h3 class="dash-form__heading">Packages</h3>
                    <p class="dash-copy dash-copy--left">Our hosting, site management, maintenance, SEO, and AEO. Static sites start at $50/month management.</p>
                    <div class="dash-form__grid">
                        <label>Hosting amount
                            <input name="hostingAmount" type="number" min="0" step="1" placeholder="250">
                        </label>
                        <label>Hosting cycle
                            <select name="hostingCycle">
                                <option value="yearly">Yearly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </label>
                        <label>Hosting last paid
                            <input name="hostingLastBilled" type="date">
                        </label>
                        <label>Hosting next due
                            <input name="hostingNextBillDate" type="date">
                        </label>
                        <label>Site management / mo
                            <input name="managementAmount" type="number" min="0" step="1" placeholder="50">
                        </label>
                        <label>SEO / mo
                            <input name="seoAmount" type="number" min="0" step="1">
                        </label>
                        <label>AEO / mo
                            <input name="aeoAmount" type="number" min="0" step="1">
                        </label>
                        <label>Maintenance / mo
                            <input name="maintenanceAmount" type="number" min="0" step="1">
                        </label>
                        <label>Discount
                            <input name="discount" type="number" min="0" step="1" placeholder="0">
                        </label>
                        <label>Tax amount
                            <input name="taxAmount" type="number" min="0" step="0.01" placeholder="0">
                        </label>
                    </div>
                    <p class="dash-form__total">Total <strong data-package-total>$0 / mo</strong></p>
                    <p class="dash-copy dash-copy--left">Yearly hosting is averaged into the monthly total. Discount comes off before tax.</p>
                    <div class="dash-form__actions">
                        <button class="ld-btn" type="submit">Save client</button>
                        <button class="dash-form__reset" type="reset">Clear</button>
                    </div>
                </form>
            </section>`;
}

function renderIndex(clients) {
    const cards = clients
        .map((client) => {
            const tags = serviceTags(client)
                .map((type) => `<span class="client-tag">${escapeHtml(SERVICE_LABELS[type] || type)}</span>`)
                .join('');
            const reports = client.reports || [];
            const billed = (client.services || []).filter((service) => service.amount);
            const bill = packageTotals(client);
            const total = bill.total
                ? `${money(bill.total)} / month`
                : billed.length
                    ? cycleLabel(billed[0])
                    : reports.length
                        ? `${reports.length} monthly report${reports.length === 1 ? '' : 's'}`
                        : 'Active client';
            return `                <article class="client-card" data-client-slug="${escapeHtml(client.slug)}">
                    <a href="/clients/${escapeHtml(client.slug)}/">
                    <h2 class="client-card__name">${escapeHtml(client.name)}</h2>
                    <p class="client-card__tags">${tags}</p>
                    <p class="client-card__meta">${escapeHtml(total)}</p>
                    <span class="client-card__cta">Open client</span>
                    </a>
                    <p class="client-card__admin" data-admin-only>
                        <button type="button" data-edit-client="${escapeHtml(client.slug)}">Edit</button>
                        <button type="button" data-delete-client="${escapeHtml(client.slug)}">Delete</button>
                    </p>
                </article>`;
        })
        .join('\n');

    return `${renderHead({
        title: 'Client Dashboard | Leanne Digital',
        description: 'Staff dashboard for client retainers, hosting renewals, and monthly reports.',
        depth: 1,
        extraCss: ['clients.css'],
        robots: ROBOTS,
    })}
<body class="page-inner" data-portal-gate data-portal-role="staff">
${renderNav(1, '/clients/')}
    <main id="main">
        <section class="clients-hero section--navy">
            <div class="container">
                <h1 class="clients-hero__title">Client dashboard</h1>
                <p class="clients-hero__lead">Hosting due dates and amounts, retainers, site management fees, and every client you can add or edit. <a href="/admin/">Back to admin</a></p>
            </div>
        </section>
        <section class="clients-list section--navy">
            <div class="container">
${renderDashboard(portalStats(clients))}
                <h2 class="client-reports__heading">All clients</h2>
                <div class="clients-grid" data-clients-grid>
${cards}
                </div>
            </div>
        </section>
    </main>
${renderFullFooter(1)}
    <script type="application/json" id="ld-clients-data">${JSON.stringify(clients.map((client) => ({
        slug: client.slug,
        name: client.name,
        email: client.email || '',
        website: client.website || '',
        platform: client.platform || '',
        googleDrive: client.googleDrive || '',
        contactName: client.contactName || '',
        hosting: client.hosting || null,
        services: client.services || [],
        credentials: client.credentials || [],
        discount: Number(client.discount) || 0,
        taxAmount: Number(client.taxAmount) || 0,
    }))).replace(/</g, '\\u003c')}</script>
${portalScripts(1, true)}
</body>
</html>
`;
}

function renderRetainer(client) {
    const services = client.services || [];
    if (!services.length && !client.discount && !client.taxAmount) return '';
    const rows = services
        .map((service) => {
            const amount = service.amount ? cycleLabel(service) : 'Included';
            return `                    <div class="client-retainer__row">
                        <span>${escapeHtml(service.label || SERVICE_LABELS[service.type] || service.type)}</span>
                        <strong>${escapeHtml(amount)}</strong>
                    </div>`;
        })
        .join('\n');
    const bill = packageTotals(client);
    const extras = [];
    if (bill.discount) {
        extras.push(`                    <div class="client-retainer__row">
                        <span>Discount</span>
                        <strong>−${escapeHtml(money(bill.discount))} / month</strong>
                    </div>`);
    }
    if (bill.tax) {
        extras.push(`                    <div class="client-retainer__row">
                        <span>Tax</span>
                        <strong>${escapeHtml(money(bill.tax))} / month</strong>
                    </div>`);
    }
    const nextBill = services.find((service) => service.nextBillDate)?.nextBillDate;
    const footer = [
        bill.total ? `<p class="client-retainer__total">Total ${escapeHtml(money(bill.total))} / month</p>` : '',
        nextBill ? `<p class="client-retainer__next">Next hosting bill ${escapeHtml(nextBill)}</p>` : '',
    ]
        .filter(Boolean)
        .join('\n');

    return `            <section class="client-retainer">
                <h2 class="client-reports__heading">Packages</h2>
                <div class="client-retainer__card">
${rows}
${extras.join('\n')}
                    ${footer}
                </div>
            </section>`;
}

function renderIncludes(client) {
    const groups = client.includes || [];
    if (!groups.length) return '';
    const columns = groups
        .map((group) => {
            const items = (group.items || [])
                .map((item) => `                        <li>${escapeHtml(item)}</li>`)
                .join('\n');
            return `                <div class="client-includes__group">
                    <h3>${escapeHtml(group.title)}</h3>
                    <ul>
${items}
                    </ul>
                </div>`;
        })
        .join('\n');
    return `            <section class="client-includes">
                <h2 class="client-reports__heading">What's included</h2>
                <div class="client-includes__grid">
${columns}
                </div>
            </section>`;
}

function renderReports(client) {
    const reports = client.reports || [];
    if (!reports.length) {
        return `            <section class="client-reports">
                <h2 class="client-reports__heading">Reports</h2>
                <p class="client-empty">Monthly reports will show up here once the first one is ready.</p>
            </section>`;
    }
    const cards = reports
        .map(
            (report) => `                <a class="client-month-card" href="/clients/${escapeHtml(client.slug)}/${escapeHtml(report.slug)}/">
                    ${CHART_ICON}
                    <h2 class="client-month-card__title">${escapeHtml(report.title)}</h2>
                    <span class="client-month-card__cta">Open report</span>
                </a>`
        )
        .join('\n');
    return `            <section class="client-reports">
                <h2 class="client-reports__heading">Reports</h2>
                <div class="client-month-grid">
${cards}
                </div>
            </section>`;
}

function renderClientPage(client) {
    const bio = client.bio
        ? `<p class="client-profile__bio">${escapeHtml(client.bio)}</p>`
        : '';
    const contact = client.contactName ? escapeHtml(client.contactName) : '';
    const links = renderLinks(client);
    const asset = client.asset
        ? `<figure class="client-profile__asset">
                    <img src="${escapeHtml(client.asset)}" alt="${escapeHtml(client.name)} website" width="734" height="1024">
                </figure>`
        : '';
    const headerClass = client.asset
        ? 'container client-profile__header client-profile__header--asset'
        : 'container client-profile__header';

    return `${renderHead({
        title: `${client.name} | Client Portal | Leanne Digital`,
        description: `Client portal for ${client.name}.`,
        depth: 2,
        extraCss: ['clients.css'],
        robots: ROBOTS,
        canonical: `${SITE_URL}/clients/${client.slug}/`,
    })}
<body class="page-inner" data-portal-gate data-client-slug="${escapeHtml(client.slug)}">
${renderNav(2, '/clients/')}
    <main id="main">
        <section class="clients-hero section--navy">
            <div class="${headerClass}">
                <div class="client-profile__copy">
                    <a class="client-reports__back" href="/admin/" data-admin-only>Admin</a>
                    <h1 class="client-reports__title">${escapeHtml(client.name)}</h1>
                    ${contact ? `<p class="client-profile__lead">${contact}</p>` : ''}
                    ${links}
                    ${bio}
                </div>
                ${asset}
            </div>
        </section>
        <section class="client-page section--navy">
            <div class="container">
${renderRetainer(client)}
${renderIncludes(client)}
${renderReports(client)}
            </div>
        </section>
    </main>
${renderFullFooter(2)}
${portalScripts(2)}
</body>
</html>
`;
}

function renderReportPage(client, report) {
    const body = reportBody(client.slug, report.slug);

    return `${renderHead({
        title: `${report.title} SEO Report | ${client.name} | Leanne Digital`,
        description: `${report.title} SEO report for ${client.name}.`,
        depth: 3,
        extraCss: ['service-page.css', 'clients.css'],
        robots: ROBOTS,
        canonical: `${SITE_URL}/clients/${client.slug}/${report.slug}/`,
    })}
<body class="page-inner" data-portal-gate data-client-slug="${escapeHtml(client.slug)}">
${renderNav(3, '/clients/')}
    <main id="main">
        <section class="clients-hero section--navy">
            <div class="container client-profile__header">
                <a class="client-reports__back" href="/clients/${escapeHtml(client.slug)}/">${escapeHtml(client.name)}</a>
                <h1 class="client-reports__title">${escapeHtml(report.title)}</h1>
            </div>
        </section>
        <section class="client-report-page section--navy">
            <div class="container client-report-body">
${body}
            </div>
        </section>
    </main>
${renderFullFooter(3)}
${portalScripts(3)}
</body>
</html>
`;
}

function renderShiftRedirect() {
    return `${renderHead({
        title: 'Shift Physiotherapy SEO Reports | Leanne Digital',
        description: 'SEO reports for Shift Physiotherapy.',
        depth: 2,
        extraCss: ['clients.css'],
        robots: ROBOTS,
    })}
<body class="page-inner" data-portal-gate data-client-slug="shift-physiotherapy">
${renderNav(2, '/clients/')}
    <main id="main">
        <section class="clients-hero section--navy">
            <div class="container client-profile__header">
                <p class="client-profile__bio">This report page has moved.</p>
                <p><a class="ld-btn" href="/clients/shift-physiotherapy/">Open Shift Physiotherapy reports</a></p>
            </div>
        </section>
    </main>
${renderFullFooter(2)}
${portalScripts(2)}
</body>
</html>
`;
}

function main() {
    generateLoginPages();
    generateAdminDashboard();
    const clients = loadClients();
    writePage('clients', renderIndex(clients));
    for (const client of clients) {
        writePage(path.join('clients', client.slug), renderClientPage(client));
        for (const report of client.reports || []) {
            writePage(path.join('clients', client.slug, report.slug), renderReportPage(client, report));
        }
    }
    writePage(path.join('clients', 'shift'), renderShiftRedirect());
    console.log(`Generated client hub, login pages, admin dashboard, and ${clients.length} client pages.`);
}

main();
