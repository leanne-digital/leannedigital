import { escapeHtml } from './layout.mjs';

export const ADMIN_CLIENT_VIEWS = [
    { href: '/admin/', label: 'Overview' },
    { href: '/seo-clients/', label: 'SEO clients' },
    { href: '/technical-seo/', label: 'Technical SEO clients' },
    { href: '/maintenance/', label: 'Maintenance clients' },
    { href: '/hosting/', label: 'Hosting clients' },
    { href: '/site-management/', label: 'Site management' },
    { href: '/project-management/', label: 'Project management' },
];

export function renderAdminSidebar(currentRoute = '/admin/', { interactive = false } = {}) {
    const views = ADMIN_CLIENT_VIEWS.map((view) =>
        `                    <a class="admin-nav__link" href="${escapeHtml(view.href)}"${view.href === currentRoute ? ' aria-current="page"' : ''}>${escapeHtml(view.label)}</a>`
    ).join('\n');
    const tools = interactive
        ? `                    <a class="admin-nav__link" href="#portfolio" data-admin-section="portfolio">Portfolio</a>
                    <a class="admin-nav__link" href="#new-client" data-admin-section="new-client">Add client</a>`
        : `                    <a class="admin-nav__link" href="/admin/#portfolio">Portfolio</a>
                    <a class="admin-nav__link" href="/admin/#new-client">Add client</a>`;
    return `${views}
${tools}
                    <a class="admin-nav__link" href="/profile/">Profile</a>`;
}
