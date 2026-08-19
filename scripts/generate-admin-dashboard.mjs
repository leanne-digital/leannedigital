import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    escapeHtml,
    renderFullFooter,
    renderHead,
    renderNav,
} from './layout.mjs';
import { PORTFOLIO_FILTERS } from './portfolio-filters.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROBOTS = 'noindex, nofollow';
const SCRIPT_V = '20260819a';

const SECTIONS = [
    { id: 'overview', label: 'Overview' },
    { id: 'seo-clients', label: 'SEO clients' },
    { id: 'maintenance-clients', label: 'Maintenance clients' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'leads', label: 'Leads' },
    { id: 'submissions', label: 'Form submissions' },
    { id: 'calendly', label: 'Calendly bookings' },
];

function writePage(relativeDir, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function tagCheckboxes() {
    return PORTFOLIO_FILTERS.map((group) => {
        const options = group.options
            .map(
                (option) => `                            <label class="admin-check">
                                <input type="checkbox" name="tags" value="${escapeHtml(option.value)}">
                                <span>${escapeHtml(option.label)}</span>
                            </label>`
            )
            .join('\n');
        return `                        <fieldset class="admin-tags">
                            <legend>${escapeHtml(group.label)}</legend>
${options}
                        </fieldset>`;
    }).join('\n');
}

function nav() {
    return SECTIONS.map(
        (section, index) =>
            `                    <button type="button" class="admin-nav__btn" data-admin-section="${section.id}"${index === 0 ? ' aria-current="page"' : ''}>${escapeHtml(section.label)}</button>`
    ).join('\n');
}

function panel(id, title, lead, body) {
    return `                <section class="admin-panel" data-admin-panel="${id}"${id === 'overview' ? '' : ' hidden'}>
                    <h2 class="admin-panel__title">${escapeHtml(title)}</h2>
                    <p class="admin-panel__lead">${escapeHtml(lead)}</p>
${body}
                </section>`;
}

export function generateAdminDashboard() {
    const html = `${renderHead({
        title: 'Admin Dashboard | Leanne Digital',
        description: 'Staff admin for clients, portfolio, leads, form submissions, and bookings.',
        depth: 1,
        extraCss: ['login.css', 'clients.css', 'admin-dashboard.css'],
        robots: ROBOTS,
        canonical: 'https://leannedigital.com/admin/',
        path: '/admin/',
    })}
<body class="page-inner" data-portal-gate data-portal-role="staff">
${renderNav(1, '/admin/')}
    <main id="main">
        <section class="admin-hero section--navy">
            <div class="container">
                <h1 class="admin-hero__title">Admin dashboard</h1>
                <p class="admin-hero__lead">Clients, portfolio, leads, form submissions, and Calendly bookings in one place.</p>
            </div>
        </section>
        <section class="admin-body section--navy">
            <div class="container admin-shell">
                <nav class="admin-nav" aria-label="Admin sections">
${nav()}
                    <a class="admin-nav__link" href="/clients/">All clients</a>
                </nav>
                <div class="admin-content">
                    <p class="login-form__error" data-admin-error hidden></p>
                    <p class="login-form__ok" data-admin-ok hidden></p>
${panel(
    'overview',
    'Overview',
    'A snapshot of retainers, portfolio pieces, and incoming work.',
    `                    <div class="dash-grid" data-overview-stats></div>
                    <p class="admin-empty" data-overview-empty hidden>Sign in as staff to load live counts.</p>`
)}
${panel(
    'seo-clients',
    'SEO clients',
    'Clients on monthly SEO or AEO retainers. Open a name to see reports and billing.',
    `                    <div class="clients-grid" data-seo-grid></div>
                    <p class="admin-empty" data-seo-empty hidden>No SEO or AEO retainers yet.</p>`
)}
${panel(
    'maintenance-clients',
    'Maintenance clients',
    'Hosting, website maintenance, and static site management accounts.',
    `                    <div class="clients-grid" data-maintenance-grid></div>
                    <p class="admin-empty" data-maintenance-empty hidden>No hosting or maintenance accounts yet.</p>`
)}
${panel(
    'portfolio',
    'Portfolio',
    'Add, edit, or remove projects. Hidden projects stay here but do not show on the public portfolio.',
    `                    <form class="dash-form" data-portfolio-form>
                        <input type="hidden" name="slug" value="">
                        <div class="dash-form__grid">
                            <label>Project title
                                <input name="title" type="text" required>
                            </label>
                            <label>SEO title
                                <input name="seoTitle" type="text" placeholder="Optional">
                            </label>
                            <label>Website URL
                                <input name="websiteUrl" type="url" placeholder="https://">
                            </label>
                            <label>Featured image
                                <input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
                            </label>
                        </div>
                        <p class="dash-copy dash-copy--left" data-image-preview></p>
                        <label>Short description
                            <textarea name="description" rows="3" placeholder="Used for search results and project pages."></textarea>
                        </label>
                        <label>Project overview
                            <textarea name="overview" rows="8" placeholder="Shown on the project page. HTML is allowed."></textarea>
                        </label>
                        <h3 class="dash-form__heading">Categories</h3>
${tagCheckboxes()}
                        <label class="admin-check admin-check--hide">
                            <input name="hidden" type="checkbox">
                            <span>Hide this project from the public portfolio</span>
                        </label>
                        <div class="dash-form__actions">
                            <button class="ld-btn" type="submit">Save project</button>
                            <button class="dash-form__reset" type="reset">Clear</button>
                        </div>
                    </form>
                    <div class="dash-table-wrap">
                        <table class="dash-table admin-table">
                            <thead>
                                <tr>
                                    <th>Project</th>
                                    <th>Categories</th>
                                    <th>Public</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody data-portfolio-body></tbody>
                        </table>
                    </div>
                    <p class="admin-empty" data-portfolio-empty hidden>No portfolio projects yet.</p>`
)}
${panel(
    'leads',
    'Leads',
    'People who submitted the contact form. Update status as you follow up.',
    `                    <div class="dash-table-wrap">
                        <table class="dash-table admin-table">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Service</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody data-leads-body></tbody>
                        </table>
                    </div>
                    <p class="admin-empty" data-leads-empty hidden>No leads yet. New contact form messages will show up here.</p>`
)}
${panel(
    'submissions',
    'Form submissions',
    'Full contact form messages, including the page they came from.',
    `                    <div class="admin-submissions" data-submissions-list></div>
                    <p class="admin-empty" data-submissions-empty hidden>No form submissions yet.</p>`
)}
${panel(
    'calendly',
    'Calendly bookings',
    'Discovery calls and other Calendly events. Point a Calendly webhook at /api/webhooks/calendly to keep this list current.',
    `                    <div class="dash-table-wrap">
                        <table class="dash-table admin-table">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>Event</th>
                                    <th>Invitee</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody data-calendly-body></tbody>
                        </table>
                    </div>
                    <p class="admin-empty" data-calendly-empty hidden>No Calendly bookings stored yet. After you connect the webhook, new bookings will appear here.</p>`
)}
                </div>
            </div>
        </section>
    </main>
${renderFullFooter(1)}
    <script src="../js/site-nav.js" defer></script>
    <script src="../js/portal-auth.js?v=${SCRIPT_V}" defer></script>
    <script src="../js/admin-dashboard.js?v=${SCRIPT_V}" defer></script>
</body>
</html>
`;
    writePage('admin', html);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    generateAdminDashboard();
    console.log('Generated /admin/.');
}
