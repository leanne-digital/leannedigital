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
import { loadClients } from './client-store.mjs';
import { loadClientProjects } from './client-project-store.mjs';
import { loadProjects } from './portfolio-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROBOTS = 'noindex, nofollow';
const SCRIPT_V = '20260819o';

const CLIENT_FILTERS = [
    { id: 'overview', label: 'Overview' },
    { id: 'seo-clients', label: 'SEO clients' },
    { id: 'maintenance-clients', label: 'Maintenance clients' },
    { id: 'hosting-clients', label: 'Hosting clients' },
    { id: 'management-clients', label: 'Site management' },
];

const SECTIONS = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'new-client', label: 'Add client' },
];

function writePage(relativeDir, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function adminBootstrap() {
    const work = loadClientProjects();
    const clients = loadClients()
        .filter((client) => !client.archivedAt)
        .map((client) => {
            const types = new Set((client.services || []).map((row) => row.type).filter(Boolean));
            for (const project of work) {
                if (project.status === 'cancelled') continue;
                if (project.clientSlug === client.slug || String(project.clientId) === String(client.id)) {
                    if (project.serviceType) types.add(project.serviceType);
                }
            }
            return {
                slug: client.slug,
                name: client.name,
                email: client.email || '',
                contactName: client.contactName || '',
                website: client.website || '',
                services: (client.services || []).map((row) => ({ type: row.type, label: row.label })),
                serviceTypes: [...types],
                reports: (client.reports || []).map((row) => ({ slug: row.slug, title: row.title })),
            };
        });
    return {
        clients,
        projects: loadProjects().map((project) => ({
            slug: project.slug,
            title: project.title,
            path: project.path,
            hidden: Boolean(project.hidden),
            categoriesLine: project.categoriesLine || '',
            tags: project.tags || [],
            seoTitle: project.seoTitle || '',
            websiteUrl: project.websiteUrl || '',
            description: project.description || '',
            overview: project.overview || '',
            featuredImage: project.featuredImage || '',
        })),
    };
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
    const filters = CLIENT_FILTERS.map(
        (section, index) =>
            `                    <button type="button" class="admin-nav__btn" data-client-filter="${section.id}"${index === 0 ? ' aria-current="page"' : ''}>${escapeHtml(section.label)}</button>`
    ).join('\n');
    const extras = SECTIONS.map(
        (section) =>
            `                    <button type="button" class="admin-nav__btn" data-admin-section="${section.id}">${escapeHtml(section.label)}</button>`
    ).join('\n');
    return `${filters}\n${extras}`;
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
        description: 'Staff admin for clients, hosting, retainers, and portfolio.',
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
                <p class="admin-hero__lead">Search a client, filter by service, and open a row to edit their details, credentials, and packages.</p>
            </div>
        </section>
        <section class="admin-body section--navy">
            <div class="container admin-shell">
                <nav class="admin-nav" aria-label="Admin sections">
${nav()}
                    <a class="admin-nav__link" href="/profile/">Profile</a>
                </nav>
                <div class="admin-content">
                    <p class="login-form__error" data-admin-error hidden></p>
                    <p class="login-form__ok" data-admin-ok hidden></p>
${panel(
    'overview',
    'Clients',
    'Filter the list from the left, or search. Click a row to edit that client.',
    `                    <div class="dash-grid" data-overview-stats></div>
                    <div class="admin-clients">
                        <div class="admin-clients-toolbar">
                            <label class="admin-search">
                                <span class="sr-only">Search clients</span>
                                <input type="search" data-client-search placeholder="Search by name, email, or website" autocomplete="off">
                            </label>
                            <button type="button" class="ld-btn" data-admin-section="new-client">Add client</button>
                        </div>
                        <h3 class="dash-form__heading" data-clients-heading>All clients</h3>
                        <div class="dash-table-wrap">
                            <table class="dash-table admin-table admin-clients-table">
                                <thead>
                                    <tr>
                                        <th>Client</th>
                                        <th>Contact</th>
                                        <th>Services</th>
                                    </tr>
                                </thead>
                                <tbody data-clients-body></tbody>
                            </table>
                        </div>
                        <p class="admin-empty" data-clients-empty hidden>No clients yet. Add a client to get started.</p>
                    </div>`
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
    'new-client',
    'Add or edit client',
    'Create a workspace, add hosting and retainers, or invite an admin. Copy the login link after you save.',
    `                    <form class="dash-form" data-client-form>
                        <input type="hidden" name="slug" value="">
                        <label>Account type
                            <select name="accountType" data-account-type>
                                <option value="client">Client</option>
                                <option value="admin">Admin</option>
                                <option value="super-admin">Super admin</option>
                            </select>
                        </label>
                        <p class="dash-copy dash-copy--left" data-account-lead>Clients get their own portal. Admins and super admins can sign in to this dashboard.</p>
                        <div class="dash-form__grid">
                            <label data-client-only>Business name
                                <input name="name" type="text" autocomplete="organization">
                            </label>
                            <label><span data-name-label>Contact name</span>
                                <input name="contactName" type="text" autocomplete="name">
                            </label>
                            <label>Email
                                <input name="email" type="email" required autocomplete="email">
                            </label>
                            <label data-client-only>Phone
                                <input name="phone" type="tel" autocomplete="tel">
                            </label>
                            <label data-client-only>Website
                                <input name="website" type="url" placeholder="https://">
                            </label>
                        </div>
                        <div data-client-only>
                            <h3 class="dash-form__heading">Services with us</h3>
                            <div class="portal-checks admin-service-checks">
                                <label class="portal-check"><input type="checkbox" name="serviceTypes" value="website"><span>Web development</span></label>
                                <label class="portal-check"><input type="checkbox" name="serviceTypes" value="maintenance"><span>Site maintenance</span></label>
                                <label class="portal-check"><input type="checkbox" name="serviceTypes" value="updates"><span>Site updates</span></label>
                                <label class="portal-check"><input type="checkbox" name="serviceTypes" value="hosting"><span>Hosting</span></label>
                                <label class="portal-check"><input type="checkbox" name="serviceTypes" value="design"><span>Graphic design</span></label>
                                <label class="portal-check"><input type="checkbox" name="serviceTypes" value="management"><span>Site management</span></label>
                                <label class="portal-check"><input type="checkbox" name="serviceTypes" value="ads"><span>Paid ads management</span></label>
                                <label class="portal-check"><input type="checkbox" name="serviceTypes" value="integrations"><span>Integrations</span></label>
                                <label class="portal-check"><input type="checkbox" name="serviceTypes" value="automations"><span>Automations</span></label>
                            </div>
                        </div>
                        <div data-client-only>
                            <h3 class="dash-form__heading">Credentials</h3>
                            <p class="dash-copy dash-copy--left">Hosting, domain, email, and any other logins we keep for this client. Passwords stay hidden until you tap the eye. Clients never see this list.</p>
                            <div class="dash-creds" data-credential-list></div>
                            <p><button class="dash-form__add" type="button" data-add-credential>Add a login</button></p>
                        </div>
                        <div data-client-only>
                            <h3 class="dash-form__heading">Packages</h3>
                            <p class="dash-copy dash-copy--left">Hosting and retainers we bill. Checking a service above without an amount only tags the account. Fill the amount here to put them on a package.</p>
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
                        </div>
                        <div class="dash-form__actions">
                            <button class="ld-btn" type="submit">Create account</button>
                            <button class="dash-form__reset" type="reset">Clear</button>
                            <button class="ld-btn ld-btn--ghost" type="button" data-invite-client hidden>Send login link</button>
                            <button class="dash-form__reset" type="button" data-archive-client-btn hidden>Archive client</button>
                        </div>
                    </form>
                    <aside class="admin-invite" data-invite-card hidden>
                        <h3 class="dash-form__heading">Send this login link</h3>
                        <p class="dash-copy dash-copy--left" data-invite-copy>Copy this and send it. They will choose a password, then land in the right portal.</p>
                        <input class="admin-invite__url" data-invite-url type="text" readonly>
                        <div class="dash-form__actions">
                            <button class="ld-btn" type="button" data-copy-invite>Copy link</button>
                        </div>
                    </aside>
                    <div class="admin-team" data-staff-wrap>
                        <h3 class="dash-form__heading">Team</h3>
                        <p class="dash-copy dash-copy--left">Admins and super admins who can open this dashboard.</p>
                        <div class="dash-table-wrap">
                            <table class="dash-table admin-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                    </tr>
                                </thead>
                                <tbody data-staff-body></tbody>
                            </table>
                        </div>
                    </div>`
)}
                </div>
            </div>
        </section>
    </main>
${renderFullFooter(1)}
    <script>window.__LD_ADMIN_BOOTSTRAP__ = ${JSON.stringify(adminBootstrap()).replace(/</g, '\\u003c')};</script>
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
