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
import { loadClientProjects } from './client-project-store.mjs';
import { portalStats } from './portal-stats.mjs';
import { generateLoginPages } from './generate-login.mjs';
import { generateAdminDashboard } from './generate-admin-dashboard.mjs';
import { rewriteLegacyLinks } from './seo.mjs';
import { loadReportRecord, renderSeoReportBody } from './seo-report-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'data', 'client-reports');
const ROBOTS = 'noindex, nofollow';
const SCRIPT_V = '20260827a';

const SERVICE_OFFERINGS = [
    { types: ['seo'], title: 'Monthly SEO', description: 'Ongoing technical, on-page, content, and visibility work to strengthen organic search performance.' },
    { types: ['aeo'], title: 'Monthly AEO', description: 'Optimization for AI search, answer engines, structured content, and clear machine-readable information.' },
    { types: ['technical-seo'], title: 'Monthly Technical SEO Management', description: 'Technical auditing, crawl and indexation monitoring, and ongoing fixes that keep the site search-ready.' },
    { types: ['management', 'website'], title: 'Managed AI-Assisted Website', description: 'Ongoing website improvements, content support, and AI-assisted development for a current, effective site.' },
    { types: ['maintenance'], title: 'WordPress Website Backups and Security Management', description: 'Regular backups, software updates, monitoring, and security care for WordPress websites.' },
    { types: ['hosting'], title: 'Website Hosting', description: 'Managed hosting, uptime support, and technical infrastructure care for the website.' },
];

const SERVICE_LABELS = {
    seo: 'SEO',
    aeo: 'AEO',
    hosting: 'Hosting',
    maintenance: 'Maintenance',
    management: 'Site management',
    website: 'Web development',
    ads: 'Paid ads management',
    'project-management': 'Project management',
};

const SERVICE_DESCRIPTIONS = {
    seo: 'Ongoing technical, on-page, content, and visibility work to strengthen organic search performance.',
    aeo: 'Optimization for AI search, answer engines, structured content, and clear machine-readable information.',
    hosting: 'Managed hosting, uptime support, and technical infrastructure care for the website.',
    maintenance: 'Regular updates, monitoring, backups, and fixes to keep the site secure and reliable.',
    management: 'Ongoing page updates, content support, and day-to-day website care.',
    website: 'Website planning, design, development, and launch support.',
    ads: 'Paid campaign planning, management, and performance optimization.',
    'project-management': 'Ongoing project management, coordination, and technical liaison support.',
};

function writePage(relativeDir, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function reportBody(slug, reportSlug) {
    const record = loadReportRecord(slug, reportSlug);
    if (record) return renderSeoReportBody(record);
    const file = path.join(REPORTS_DIR, slug, `${reportSlug}.html`);
    if (!fs.existsSync(file)) return '';
    const legacyHtml = rewriteLegacyLinks(fs.readFileSync(file, 'utf8')).replace(
        new RegExp(`href=["']/?admin/${slug}/?["']`, 'gi'),
        `href="/clients/${slug}/"`
    );
    return `<article class="seo-report seo-report--legacy">\n${legacyHtml}\n</article>`;
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
        ? `\n    <script src="${prefix}js/portal-admin.js?v=20260819o" defer></script>`
        : '';
    return `    <script src="${prefix}js/site-nav.js" defer></script>
    <script src="${prefix}js/portal-auth.js?v=${SCRIPT_V}" defer></script>
    <script src="${prefix}js/client-workspace.js?v=${SCRIPT_V}" defer></script>${adminScript}
    <script>
    document.addEventListener('click', function (event) {
        var row = event.target.closest('tr[data-href]');
        if (!row || event.target.closest('a')) return;
        location.href = row.getAttribute('data-href');
    });
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        var row = event.target.closest('tr[data-href]');
        if (!row) return;
        event.preventDefault();
        location.href = row.getAttribute('data-href');
    });
    </script>`;
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

function hostingCycleLabel(cycle) {
    return cycle === 'monthly' ? 'Monthly' : cycle === 'yearly' ? 'Yearly' : '—';
}

function hostingProviderLabel(client) {
    if (client.hosting?.provider) return client.hosting.provider;
    if (client.hosting?.lddHosted) return 'Leanne Digital';
    return client.hosting?.type || '—';
}

function renderHostingDirectory(clients) {
    const stats = portalStats(clients);
    const rows = stats.hostingAccounts.map((account) => {
        const client = clients.find((entry) => entry.slug === account.slug);
        return `                            <tr class="hosting-directory__row hosting-directory__row--${escapeHtml(account.status)}" data-href="/clients/${escapeHtml(account.slug)}/" tabindex="0">
                                <td><a href="/clients/${escapeHtml(account.slug)}/">${escapeHtml(account.name)}</a></td>
                                <td>${escapeHtml(hostingProviderLabel(client || {}))}</td>
                                <td>${escapeHtml(account.amount ? money(account.amount) : '—')}</td>
                                <td>${escapeHtml(hostingCycleLabel(account.cycle))}</td>
                                <td>${escapeHtml(formatDay(account.nextBillDate) || 'No due date')}</td>
                                <td><span class="hosting-directory__status">${escapeHtml(statusLabel(account.status))}</span></td>
                            </tr>`;
    }).join('\n');

    return `${renderHead({
        title: 'Hosting Clients | Leanne Digital',
        description: 'Leanne Digital hosting accounts and renewal schedule.',
        depth: 0,
        extraCss: ['clients.css'],
        robots: ROBOTS,
        canonical: `${SITE_URL}/hosting/`,
        path: '/hosting/',
    })}
<body class="page-inner hosting-directory" data-portal-gate data-portal-role="staff">
${renderNav(0, '/hosting/')}
    <main id="main">
        <section class="clients-hero section--navy">
            <div class="container">
                <h1 class="clients-hero__title">Hosting clients</h1>
                <p class="clients-hero__lead">Active website-hosting accounts, their current billing amount, and the next renewal date.</p>
            </div>
        </section>
        <section class="section--navy hosting-directory__body">
            <div class="container">
                <div class="dash-grid hosting-directory__stats" aria-label="Hosting summary">
                    <article class="dash-stat"><p class="dash-stat__value">${escapeHtml(String(stats.hosting))}</p><h2 class="dash-stat__label">Hosting clients</h2></article>
                    <article class="dash-stat"><p class="dash-stat__value">${escapeHtml(String(stats.renewals.length))}</p><h2 class="dash-stat__label">Due within 60 days</h2></article>
                    <article class="dash-stat"><p class="dash-stat__value">${escapeHtml(money(stats.totals.hostingMonthly))}</p><h2 class="dash-stat__label">Average monthly value</h2></article>
                </div>
                <div class="dash-table-wrap hosting-directory__table-wrap">
                    <table class="dash-table hosting-directory__table">
                        <thead>
                            <tr><th>Client</th><th>Provider</th><th>Amount paid</th><th>Cycle</th><th>Next due</th><th>Status</th></tr>
                        </thead>
                        <tbody>
${rows || '                            <tr><td colspan="6">No hosting clients are currently recorded.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    </main>
${renderFullFooter(0)}
${portalScripts(0)}
</body>
</html>`;
}

function renderServiceDirectory({ route, title, lead, types }, clients) {
    const rows = loadClientProjects()
        .filter((project) => types.includes(project.serviceType) && project.status !== 'cancelled')
        .sort((a, b) => a.clientName.localeCompare(b.clientName))
        .map((project) => {
            const client = clients.find((entry) => entry.slug === project.clientSlug);
            const status = String(project.status || 'active').replace(/-/g, ' ');
            return `                            <tr class="service-directory__row service-directory__row--${escapeHtml(project.status || 'active')}" data-href="/clients/${escapeHtml(project.clientSlug)}/" tabindex="0">
                                <td><a href="/clients/${escapeHtml(project.clientSlug)}/">${escapeHtml(client?.name || project.clientName)}</a></td>
                                <td>${escapeHtml(project.name || '—')}</td>
                                <td>${escapeHtml(Number(project.fee) ? money(project.fee) : 'Rate to confirm')}</td>
                                <td>${escapeHtml(project.billingFrequency === 'yearly' ? 'Annual' : 'Monthly')}</td>
                                <td><span class="service-directory__status">${escapeHtml(status)}</span></td>
                                <td>${escapeHtml(project.notes || '—')}</td>
                            </tr>`;
        }).join('\n');

    return `${renderHead({
        title: `${title} | Leanne Digital`,
        description: lead,
        depth: 0,
        extraCss: ['clients.css'],
        robots: ROBOTS,
        canonical: `${SITE_URL}${route}`,
        path: route,
    })}
<body class="page-inner service-directory" data-portal-gate data-portal-role="staff">
${renderNav(0, route)}
    <main id="main">
        <section class="clients-hero section--navy">
            <div class="container">
                <p class="client-reports__back"><a href="/admin/">Admin dashboard</a></p>
                <h1 class="clients-hero__title">${escapeHtml(title)}</h1>
                <p class="clients-hero__lead">${escapeHtml(lead)}</p>
            </div>
        </section>
        <section class="section--navy service-directory__body">
            <div class="container">
                <div class="dash-table-wrap service-directory__table-wrap">
                    <table class="dash-table service-directory__table">
                        <thead><tr><th>Client</th><th>Project</th><th>2026 rate</th><th>Billing</th><th>Status</th><th>Notes</th></tr></thead>
                        <tbody>
${rows || '                            <tr><td colspan="6">No active clients are recorded for this service.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    </main>
${renderFullFooter(0)}
${portalScripts(0)}
</body>
</html>`;
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
                        <label>Contact name
                            <input name="contactName" type="text" autocomplete="off">
                        </label>
                        <label>Portal login email
                            <input name="email" type="email" autocomplete="off">
                        </label>
                        <label>Phone
                            <input name="phone" type="tel" autocomplete="off">
                        </label>
                        <label>Website
                            <input name="website" type="url" placeholder="https://">
                        </label>
                        <label>Platform
                            <select name="platform">
                                <option value="WordPress">WordPress</option>
                                <option value="Wix">Wix</option>
                                <option value="Webflow">Webflow</option>
                                <option value="Squarespace">Squarespace</option>
                                <option value="Shopify">Shopify</option>
                                <option value="Showit">Showit</option>
                                <option value="Static">Static site</option>
                                <option value="Custom / HTML">Custom / HTML</option>
                                <option value="None yet">None yet</option>
                                <option value="Other">Other</option>
                            </select>
                        </label>
                    </div>
                    <p class="dash-copy dash-copy--left" data-invite-note>Saving a new client emails them a login link to set their password. You can resend it after they exist.</p>
                    <p><button class="dash-form__add" type="button" data-invite-client hidden>Send login link</button></p>
                    <div class="dash-creds" data-client-apps hidden></div>
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

function renderClientsHub(clients) {
    const options = clients
        .filter((client) => !client.archivedAt)
        .map((client) => `                        <option value="${escapeHtml(client.slug)}">${escapeHtml(client.name)}</option>`)
        .join('\n');
    return `${renderHead({
        title: 'Clients | Leanne Digital',
        description: 'Choose a client to open their account.',
        depth: 1,
        extraCss: ['clients.css'],
        robots: ROBOTS,
        canonical: `${SITE_URL}/clients/`,
        path: '/clients/',
    })}
<body class="page-inner clients-picker" data-portal-gate data-portal-role="staff">
${renderNav(1, '/clients/')}
    <main id="main" class="clients-picker-main">
        <div class="container">
            <div class="clients-picker-panel">
                <h1>Clients</h1>
                <p>Select a client to open their services, reports, and credentials.</p>
                <label>Client
                    <select data-client-picker>
                        <option value="">Choose a client</option>
${options}
                    </select>
                </label>
            </div>
        </div>
    </main>
${renderFullFooter(1)}
${portalScripts(1)}
</body>
</html>
`;
}

function serviceCheckIcon() {
    return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10.5 3.6 3.6L16 5.8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25"/></svg>';
}

function serviceAvailableIcon() {
    return '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
}

function renderServiceList(client) {
    const activeTypes = new Set((client.services || []).map((service) => service.type));
    if ((client.reports || []).length) activeTypes.add('seo');
    if (client.hosting?.provider) activeTypes.add('hosting');
    const items = SERVICE_OFFERINGS.map((service) => {
        const active = service.types.some((type) => activeTypes.has(type));
        return `                    <li class="client-service-summary${active ? ' client-service-summary--active' : ''}">
                        <span class="client-service-summary__icon" aria-label="${active ? 'Included service' : 'Available service'}">${active ? serviceCheckIcon() : serviceAvailableIcon()}</span>
                        <div>
                            <h3>${escapeHtml(service.title)}</h3>
                            <p>${escapeHtml(service.description)}</p>
                        </div>
                    </li>`;
    }).join('\n');
    return `            <section class="client-reports">
                <h2 class="client-reports__heading">Services</h2>
                <ul class="client-service-list" aria-label="Available Leanne Digital services">
${items}
                </ul>
            </section>`;
}

function startedIso(client) {
    return String(client.started || client.createdAt || '').slice(0, 10);
}

function reportTypeLabel(report) {
    const kind = report.kind || (String(report.slug || '').includes('maintenance') ? 'maintenance' : 'seo');
    return kind === 'maintenance' ? 'Site maintenance report' : 'SEO report';
}

function planTypeLabel(service) {
    if (service.type === 'seo') return 'SEO plan';
    if (service.type === 'aeo') return 'AEO plan';
    if (service.type === 'hosting') return 'Hosting';
    if (service.type === 'maintenance') return 'Maintenance plan';
    if (service.type === 'management') return 'Site management';
    return SERVICE_LABELS[service.type] || service.label || service.type;
}

function reportRows(client) {
    const reports = [...(client.reports || [])].sort((a, b) =>
        String(b.monthKey || b.slug || '').localeCompare(String(a.monthKey || a.slug || ''))
    );
    return reports.map((report) => ({
        href: `/clients/${client.slug}/${report.slug}/`,
        item: report.title,
        type: reportTypeLabel(report),
        details: 'Open report',
    }));
}

function logRowMarkup() {
    return `<div class="seo-log-row" data-log-row>
                    <label>Date<input data-log="date" type="date"></label>
                    <label>Keyword<input data-log="keyword" type="text"></label>
                    <label>Source post<input data-log="source" type="text"></label>
                    <label>Target<input data-log="target" type="text" value="Page"></label>
                    <label>Links added / notes<input data-log="linksAdded" type="text"></label>
                    <button class="dash-form__remove" type="button" data-remove-log>Remove</button>
                </div>`;
}

function renderSeoReportComposer() {
    const months = [
        ['01', 'January'],
        ['02', 'February'],
        ['03', 'March'],
        ['04', 'April'],
        ['05', 'May'],
        ['06', 'June'],
        ['07', 'July'],
        ['08', 'August'],
        ['09', 'September'],
        ['10', 'October'],
        ['11', 'November'],
        ['12', 'December'],
    ]
        .map(([value, label]) => `                            <option value="${value}">${label}</option>`)
        .join('\n');
    return `                <form class="dash-form seo-composer" data-admin-only data-seo-report-form id="seo-report">
                    <h3 class="dash-form__heading">Create SEO report</h3>
                    <p class="dash-copy dash-copy--left">Upload this month’s screenshots and the Ubersuggest PDF, then edit each recap. Last month’s shots carry forward automatically. If the client has no Google Ads, leave that box off and we’ll put N/A.</p>
                    <input type="hidden" name="slug" value="">
                    <div class="dash-form__grid">
                        <label>Month
                            <select name="month" required>
${months}
                            </select>
                        </label>
                        <label>Year
                            <input name="year" type="number" min="2020" max="2100" required>
                        </label>
                    </div>
                    <label class="portal-check"><input name="hasGoogleAds" type="checkbox" checked><span>This client has Google Ads this month</span></label>
                    <div class="dash-form__grid">
                        <label>Technical SEO screenshot
                            <input name="techThisMonth" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
                        </label>
                        <label>Keywords SEO screenshot
                            <input name="keywordsThisMonth" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
                        </label>
                        <label>Ubersuggest keyword PDF
                            <input name="keywordPdf" type="file" accept="application/pdf">
                        </label>
                        <label data-ads-upload>Google Ads screenshot
                            <input name="adsImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
                        </label>
                    </div>
                    <p class="dash-copy dash-copy--left" data-asset-status></p>
                    <label>Campaign intro
                        <textarea name="campaignIntro" rows="6" placeholder="Who this campaign is for, the market, and the goal."></textarea>
                    </label>
                    <label>Monthly recap
                        <textarea name="monthlyRecap" rows="6" placeholder="What moved this month."></textarea>
                    </label>
                    <label>Technical SEO recap
                        <textarea name="technicalRecap" rows="5"></textarea>
                    </label>
                    <h4 class="dash-form__heading">Internal links added</h4>
                    <div data-link-log>${logRowMarkup()}</div>
                    <p><button class="dash-form__add" type="button" data-add-log="link">Add a link row</button></p>
                    <label>Keyword rankings recap
                        <textarea name="keywordsRecap" rows="5"></textarea>
                    </label>
                    <h4 class="dash-form__heading">New content and updates</h4>
                    <div data-content-log>${logRowMarkup()}</div>
                    <p><button class="dash-form__add" type="button" data-add-log="content">Add a content row</button></p>
                    <label>New content recap
                        <textarea name="contentRecap" rows="4"></textarea>
                    </label>
                    <label data-ads-recap>Google Ads recap
                        <textarea name="adsRecap" rows="4"></textarea>
                    </label>
                    <label>Next steps and strategy
                        <textarea name="nextSteps" rows="5"></textarea>
                    </label>
                    <div class="dash-form__actions">
                        <button class="ld-btn" type="submit">Save SEO report</button>
                    </div>
                </form>`;
}

function renderAccountTable(client) {
    const rows = reportRows(client);
    if (!rows.length) {
        return `            <section class="client-reports client-report-history">
                <h2 class="client-reports__heading">Reports</h2>
                <p class="client-empty client-empty--lead">SEO reports and site maintenance reports. Click a row to open it.</p>
                <div class="dash-table-wrap">
                    <table class="dash-table admin-table client-account-table client-report-history__table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Type</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody data-report-body>
                    <tr><td colspan="3">No reports yet.</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>`;
    }
    const body = rows
        .map((row) => {
            const item = `<a class="client-account-row__hit" href="${escapeHtml(row.href)}">${escapeHtml(row.item)}</a>`;
            return `                    <tr class="client-account-row" data-href="${escapeHtml(row.href)}" tabindex="0">
                        <td>${item}</td>
                        <td>${escapeHtml(row.type)}</td>
                        <td>${escapeHtml(row.details)}</td>
                    </tr>`;
        })
        .join('\n');
    return `            <section class="client-reports client-report-history">
                <h2 class="client-reports__heading">Reports</h2>
                <p class="client-empty client-empty--lead">SEO reports and site maintenance reports. Click a row to open it.</p>
                <div class="dash-table-wrap">
                    <table class="dash-table admin-table client-account-table client-report-history__table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Type</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody data-report-body>
${body}
                        </tbody>
                    </table>
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

function renderReportCover(client) {
    const cover = client.slug === 'oatley-vigmond'
        ? '/assets/clients/oatley-vigmond/oatley-vigmond-report-cover.png'
        : client.asset;

    if (!cover) {
        return `                <div class="client-report-cover client-report-cover--placeholder" role="img" aria-label="${escapeHtml(client.name)} report cover">
                    <span>${escapeHtml(client.name)}</span>
                    <small>Monthly report</small>
                </div>`;
    }

    return `                <figure class="client-report-cover">
                    <img src="${escapeHtml(cover)}" alt="${escapeHtml(client.name)} website overview">
                </figure>`;
}

function renderPreviousReports(client, report) {
    const reports = [...(client.reports || [])]
        .sort((a, b) => String(b.monthKey || b.slug || '').localeCompare(String(a.monthKey || a.slug || '')));
    const currentIndex = reports.findIndex((row) => row.slug === report.slug);
    const previousReports = currentIndex >= 0 ? reports.slice(currentIndex + 1) : [];

    if (!previousReports.length) return '';

    const rows = previousReports
        .map((previousReport) => `                        <tr>
                            <td>${escapeHtml(previousReport.title)}</td>
                            <td>SEO report</td>
                            <td><a href="/clients/${escapeHtml(client.slug)}/${escapeHtml(previousReport.slug)}/">View report</a></td>
                        </tr>`)
        .join('\n');

    return `                <section class="client-report-history" aria-labelledby="previous-reports-title">
                    <h2 id="previous-reports-title" class="client-report-history__title">Previous reports</h2>
                    <div class="dash-table-wrap">
                        <table class="dash-table client-report-history__table">
                            <thead>
                                <tr><th scope="col">Item</th><th scope="col">Type</th><th scope="col">Details</th></tr>
                            </thead>
                            <tbody>
${rows}
                            </tbody>
                        </table>
                    </div>
                </section>`;
}

function renderClientPage(client) {
    const bio = client.bio
        ? `<p class="client-profile__bio">${escapeHtml(client.bio)}</p>`
        : '';
    const asset = client.asset
        ? `<figure class="client-profile__asset">
                    <img src="${escapeHtml(client.asset)}" alt="${escapeHtml(client.name)} website overview">
                </figure>`
        : '';

    return `${renderHead({
        title: `${client.name} | Client Portal | Leanne Digital`,
        description: `Client portal for ${client.name}.`,
        depth: 2,
        extraCss: ['clients.css'],
        cssVersion: '20260831d',
        robots: ROBOTS,
        canonical: `${SITE_URL}/clients/${client.slug}/`,
    })}
<body class="page-inner" data-portal-gate data-client-slug="${escapeHtml(client.slug)}" data-client-workspace>
${renderNav(2, '/clients/')}
    <main id="main">
        <section class="clients-hero section--navy">
            <div class="container client-profile__header">
                <h1 class="client-reports__title">${escapeHtml(client.name)}</h1>
${bio}${asset ? `\n${asset}` : ''}
            </div>
        </section>
        <section class="client-page section--navy">
            <div class="container">
${renderServiceList(client)}
${renderAccountTable(client)}
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
        cssVersion: '20260831a',
        robots: ROBOTS,
        canonical: `${SITE_URL}/clients/${client.slug}/${report.slug}/`,
    })}
<body class="page-inner seo-report-page" data-client-slug="${escapeHtml(client.slug)}">
${renderNav(3, '/clients/')}
    <main id="main">
        <section class="clients-hero section--navy">
            <div class="container client-profile__header">
                <a class="client-reports__back" href="/clients/${escapeHtml(client.slug)}/">${escapeHtml(client.name)}</a>
${renderReportCover(client)}
${renderPreviousReports(client, report)}
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
    writePage('clients', renderClientsHub(clients));
    writePage('hosting', renderHostingDirectory(clients));
    writePage('seo-clients', renderServiceDirectory({
        route: '/seo-clients/',
        title: 'SEO clients',
        lead: 'Clients with active monthly SEO work, current billing information, and available reports.',
        types: ['seo'],
    }, clients));
    writePage('technical-seo', renderServiceDirectory({
        route: '/technical-seo/',
        title: 'Technical SEO clients',
        lead: 'Clients receiving ongoing technical SEO and AEO work, with current billing information and service details.',
        types: ['aeo'],
    }, clients));
    writePage('maintenance', renderServiceDirectory({
        route: '/maintenance/',
        title: 'Maintenance clients',
        lead: 'Clients receiving WordPress maintenance, backups, security, and ongoing website care.',
        types: ['maintenance'],
    }, clients));
    writePage('site-management', renderServiceDirectory({
        route: '/site-management/',
        title: 'Site management clients',
        lead: 'Clients receiving ongoing managed website updates and day-to-day technical support.',
        types: ['management'],
    }, clients));
    writePage('project-management', renderServiceDirectory({
        route: '/project-management/',
        title: 'Project management clients',
        lead: 'Clients receiving ongoing project management, coordination, and technical liaison support.',
        types: ['project-management'],
    }, clients));
    for (const client of clients) {
        writePage(path.join('clients', client.slug), renderClientPage(client));
        for (const report of client.reports || []) {
            writePage(path.join('clients', client.slug, report.slug), renderReportPage(client, report));
        }
    }
    writePage(path.join('clients', 'shift'), renderShiftRedirect());
    console.log(`Generated login pages, client portal, admin dashboard, ${clients.length} client report pages, and the /clients/ picker.`);
}

main();
