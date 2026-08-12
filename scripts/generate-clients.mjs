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

function portalScripts(depth) {
    const prefix = '../'.repeat(depth);
    return `    <script src="${prefix}js/site-nav.js" defer></script>
    <script src="${prefix}js/portal-auth.js" defer></script>`;
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

function renderDashboard(stats) {
    const currency = stats.totals.currency || 'CAD';
    const cards = [
        ['Clients', String(stats.clients)],
        ['Website hosting', String(stats.hosting)],
        ['Up for renewal', String(stats.renewals.length)],
        ['Monthly retainers', String(stats.recurringClients)],
    ]
        .map(
            ([label, value]) => `                <article class="dash-stat">
                    <p class="dash-stat__value">${escapeHtml(value)}</p>
                    <h2 class="dash-stat__label">${escapeHtml(label)}</h2>
                </article>`
        )
        .join('\n');
    const recurring = [
        ['SEO', stats.recurring.seo],
        ['AEO', stats.recurring.aeo],
        ['Site maintenance', stats.recurring.maintenance],
        ['Combo', stats.recurring.combo],
    ]
        .map(
            ([label, value]) => `                <article class="dash-stat dash-stat--sub">
                    <p class="dash-stat__value">${value}</p>
                    <h2 class="dash-stat__label">${escapeHtml(label)}</h2>
                </article>`
        )
        .join('\n');
    const totals = [
        ['Monthly total', money(stats.totals.monthly, currency)],
        ['Yearly total', money(stats.totals.yearly, currency)],
        ['Annualized', money(stats.totals.annualized, currency)],
        ['All-time (est.)', money(stats.totals.allTime, currency)],
    ]
        .map(
            ([label, value]) => `                <article class="dash-stat dash-stat--money">
                    <p class="dash-stat__value">${escapeHtml(value)}</p>
                    <h2 class="dash-stat__label">${escapeHtml(label)}</h2>
                </article>`
        )
        .join('\n');
    const renewals = stats.renewals.length
        ? `<div class="dash-renewals">
                ${stats.renewals
                    .map((row) => {
                        const when = row.overdue ? 'Overdue' : formatDay(row.nextBillDate);
                        return `                <a class="dash-renewal${row.overdue ? ' dash-renewal--overdue' : ''}" href="/clients/${escapeHtml(row.slug)}/">
                    <span>${escapeHtml(row.name)}</span>
                    <strong>${escapeHtml(money(row.amount, currency))}</strong>
                    <em>${escapeHtml(when)}</em>
                </a>`;
                    })
                    .join('\n')}
            </div>`
        : '<p class="client-empty">No hosting renewals in the next 60 days.</p>';

    return `            <section class="dash-panel" data-admin-only>
                <h2 class="client-reports__heading">Overview</h2>
                <div class="dash-grid">
${cards}
                </div>
                <h2 class="client-reports__heading">Monthly recurring clients</h2>
                <p class="dash-copy">SEO, AEO, site maintenance, or a combo of those retainers.</p>
                <div class="dash-grid">
${recurring}
                </div>
                <h2 class="client-reports__heading">Revenue</h2>
                <div class="dash-grid">
${totals}
                </div>
                <h2 class="client-reports__heading">Hosting renewals</h2>
                ${renewals}
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
            const monthly = billed.filter((service) => service.cycle !== 'yearly');
            const yearly = billed.filter((service) => service.cycle === 'yearly');
            const totals = [];
            if (monthly.length) totals.push(`${money(serviceTotal(monthly))} / month`);
            if (yearly.length) totals.push(`${money(serviceTotal(yearly))} / year`);
            const total = totals.length
                ? totals.join(' · ')
                : reports.length
                    ? `${reports.length} monthly report${reports.length === 1 ? '' : 's'}`
                    : 'Active client';
            return `                <a class="client-card" href="/clients/${escapeHtml(client.slug)}/">
                    <h2 class="client-card__name">${escapeHtml(client.name)}</h2>
                    <p class="client-card__tags">${tags}</p>
                    <p class="client-card__meta">${escapeHtml(total)}</p>
                    <span class="client-card__cta">Open client</span>
                </a>`;
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
                <p class="clients-hero__lead">Client counts, hosting renewals, and recurring SEO, AEO, and maintenance income.</p>
            </div>
        </section>
        <section class="clients-list section--navy">
            <div class="container">
${renderDashboard(portalStats(clients))}
                <h2 class="client-reports__heading">All clients</h2>
                <div class="clients-grid">
${cards}
                </div>
            </div>
        </section>
    </main>
${renderFullFooter(1)}
${portalScripts(1)}
</body>
</html>
`;
}

function renderRetainer(client) {
    const services = client.services || [];
    if (!services.length) return '';
    const rows = services
        .map((service) => {
            const amount = service.amount ? cycleLabel(service) : 'Included';
            return `                    <div class="client-retainer__row">
                        <span>${escapeHtml(service.label || SERVICE_LABELS[service.type] || service.type)}</span>
                        <strong>${escapeHtml(amount)}</strong>
                    </div>`;
        })
        .join('\n');
    const billed = services.filter((service) => service.amount);
    const monthly = billed.filter((service) => service.cycle !== 'yearly');
    const yearly = billed.filter((service) => service.cycle === 'yearly');
    const totals = [];
    if (monthly.length) totals.push(`${money(serviceTotal(monthly))} / month`);
    if (yearly.length) totals.push(`${money(serviceTotal(yearly))} / year`);
    const nextBill = billed.find((service) => service.nextBillDate)?.nextBillDate;
    const footer = [
        totals.length ? `<p class="client-retainer__total">${escapeHtml(totals.join(' · '))}</p>` : '',
        nextBill ? `<p class="client-retainer__next">Next hosting bill ${escapeHtml(nextBill)}</p>` : '',
    ]
        .filter(Boolean)
        .join('\n');

    return `            <section class="client-retainer">
                <h2 class="client-reports__heading">Retainer</h2>
                <div class="client-retainer__card">
${rows}
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
                    <a class="client-reports__back" href="/clients/" data-admin-only>Dashboard</a>
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
    const clients = loadClients();
    writePage('clients', renderIndex(clients));
    for (const client of clients) {
        writePage(path.join('clients', client.slug), renderClientPage(client));
        for (const report of client.reports || []) {
            writePage(path.join('clients', client.slug, report.slug), renderReportPage(client, report));
        }
    }
    writePage(path.join('clients', 'shift'), renderShiftRedirect());
    console.log(`Generated client hub, login pages, and ${clients.length} client pages.`);
}

main();
