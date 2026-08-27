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

const SERVICE_SLOTS = [
    { type: 'seo', title: 'Ongoing Monthly SEO' },
    { type: 'maintenance', title: 'Site Maintenance' },
    { type: 'management', title: 'Monthly Site Management' },
    { type: 'hosting', title: 'Website Hosting' },
    { type: 'aeo', title: 'AEO' },
];

const SERVICE_LABELS = {
    seo: 'SEO',
    aeo: 'AEO',
    hosting: 'Hosting',
    maintenance: 'Maintenance',
    management: 'Site management',
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

function slotStatus(client, slot) {
    const service = (client.services || []).find((row) => row.type === slot.type);
    if (service?.amount) return cycleLabel(service) || service.label || 'Signed up';
    if (service) return service.label || 'Signed up';
    if (slot.type === 'seo' && (client.reports || []).length) return 'Ongoing Monthly SEO';
    if (slot.type === 'hosting' && client.hosting?.provider) {
        return [client.hosting.provider, client.hosting.lddHosted ? 'Hosted by us' : 'External hosting']
            .filter(Boolean)
            .join(' · ');
    }
    return 'None';
}

function renderServiceList(client) {
    const items = SERVICE_SLOTS.map(
        (slot) => `                    <li>
                        <details class="client-service" data-service-slot="${escapeHtml(slot.type)}">
                            <summary>
                                <span>${escapeHtml(slot.title)}</span>
                                <strong data-service-status>${escapeHtml(slotStatus(client, slot))}</strong>
                            </summary>
                            <div class="client-service__body" data-service-body></div>
                        </details>
                    </li>`
    ).join('\n');
    return `            <section class="client-reports">
                <h2 class="client-reports__heading">Services</h2>
                <ul class="client-service-list">
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

function accountRows(client) {
    const rows = [];
    const started = startedIso(client);
    const billed = new Set();
    const reports = [...(client.reports || [])].sort((a, b) =>
        String(b.monthKey || b.slug || '').localeCompare(String(a.monthKey || a.slug || ''))
    );
    for (const report of reports) {
        rows.push({
            href: `/clients/${client.slug}/${report.slug}/`,
            item: report.title,
            type: reportTypeLabel(report),
            details: 'Open report',
        });
    }
    for (const service of client.services || []) {
        billed.add(service.type);
        const bits = [service.amount ? cycleLabel(service) : 'Included'];
        if (started) bits.push(`Signed up ${formatDay(started)}`);
        if (service.lastBilled) bits.push(`Started ${formatDay(service.lastBilled)}`);
        if (service.nextBillDate) bits.push(`Next renewal ${formatDay(service.nextBillDate)}`);
        rows.push({
            href: '',
            item: service.label || SERVICE_LABELS[service.type] || service.type,
            type: planTypeLabel(service),
            details: bits.join(' · '),
        });
    }
    if (client.hosting?.provider && !billed.has('hosting')) {
        const bits = [client.hosting.provider, client.hosting.lddHosted ? 'Hosted by us' : 'External hosting'];
        if (started) bits.push(`Signed up ${formatDay(started)}`);
        rows.push({
            href: '',
            item: 'Hosting',
            type: 'Hosting',
            details: bits.join(' · '),
        });
    }
    return rows;
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
    const rows = accountRows(client).filter((row) => row.href);
    if (!rows.length) {
        return `            <section class="client-reports">
                <h2 class="client-reports__heading">Reports</h2>
                <p class="client-empty client-empty--lead">SEO reports and site maintenance reports. Click a row to open it.</p>
                <div class="dash-table-wrap">
                    <table class="dash-table admin-table client-account-table">
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
${renderSeoReportComposer()}
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
    return `            <section class="client-reports">
                <h2 class="client-reports__heading">Reports</h2>
                <p class="client-empty client-empty--lead">SEO reports and site maintenance reports. Click a row to open it.</p>
                <div class="dash-table-wrap">
                    <table class="dash-table admin-table client-account-table">
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
${renderSeoReportComposer()}
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
<body class="page-inner" data-portal-gate data-client-slug="${escapeHtml(client.slug)}" data-client-workspace>
${renderNav(2, '/clients/')}
    <main id="main">
        <section class="clients-hero section--navy">
            <div class="${headerClass}">
                <div class="client-profile__copy">
                    <a class="client-reports__back" href="/clients/" data-admin-only>All clients</a>
                    <a class="client-reports__back" href="/client-portal/" data-client-only>Your portal</a>
                    <a class="client-reports__back" href="/admin/?client=${escapeHtml(client.slug)}#new-client" data-admin-only>Edit in admin</a>
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
                <p class="login-form__error client-workspace-msg" data-workspace-error hidden></p>
                <p class="login-form__ok client-workspace-msg" data-workspace-ok hidden></p>
${renderServiceList(client)}
${renderAccountTable(client)}
                <section class="client-reports">
                    <h2 class="client-reports__heading">Credentials</h2>
                    <p class="client-empty client-empty--lead">Logins for tools this business uses. Passwords stay hidden until you tap the eye.</p>
                    <form class="dash-form" data-apps-form>
                        <div class="dash-creds" data-app-list></div>
                        <p><button class="dash-form__add" type="button" data-add-app>Add a login</button></p>
                        <div class="dash-form__actions">
                            <button class="ld-btn" type="submit">Save credentials</button>
                        </div>
                    </form>
                </section>
${renderIncludes(client)}
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
        cssVersion: '20260827c',
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
                <h1 class="client-reports__title">${escapeHtml(report.title)}</h1>
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
