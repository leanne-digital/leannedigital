import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
    addProjectUpdate,
    createClientProject,
    createClientWithAccount,
    createPortfolioProject,
    deleteClientWithAccount,
    deletePortfolioProject,
    getAgencyClient,
    getClientProject,
    getClientRevenue,
    getDashboardStats,
    getMonthlyRevenue,
    getRevenueByService,
    getSiteConversions,
    getSiteStatistics,
    listAgencyClients,
    listClientProjects,
    listSeoClients,
    loadCalendlyBookings,
    loadPortfolioProjects,
    loadSubmissions,
    setLeadStatus,
    setProjectStatus,
    updateClientProject,
    updateClientWithAccount,
    updatePortfolioProject,
    updatesForProject,
} from './services/agency.mjs';

const SECRET_KEYS = new Set([
    'password',
    'temporarypassword',
    'passwordhash',
    'hash',
    'secret',
    'token',
    'accesstoken',
    'refreshtoken',
    'apikey',
    'api_key',
    'authorization',
    'credentials',
    'smtppass',
    'smtp_pass',
]);

const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

const clientFields = {
    name: z.string().describe('Company name, e.g. Some Company'),
    contactName: z.string().optional(),
    email: z.string().optional().describe('Login email. Defaults to the client email or slug@clients.leannedigital.com'),
    password: z.string().optional().describe('Optional portal password to set. Never returned in MCP output.'),
    website: z.string().optional(),
    googleDrive: z.string().optional().describe('Google Drive folder URL for this client'),
    location: z.string().optional(),
    platform: z.string().optional().describe('WordPress, Wix, Webflow, Squarespace, or Other'),
    currency: z.string().optional().describe('Default CAD'),
    hostingAmount: z.number().optional().describe('LDD hosting price, e.g. 250'),
    hostingCycle: z.enum(['monthly', 'yearly']).optional().describe('Default yearly for hosting'),
    seoAmount: z.number().optional(),
    aeoAmount: z.number().optional(),
    maintenanceAmount: z.number().optional(),
    managementAmount: z.number().optional(),
    bio: z.string().optional(),
};

const portfolioFields = {
    title: z.string().describe('Public portfolio piece title'),
    slug: z.string().optional(),
    seoTitle: z.string().optional(),
    description: z.string().optional(),
    websiteUrl: z.string().optional(),
    overview: z.string().optional().describe('HTML allowed. Shown on the public project page.'),
    tags: z.array(z.string()).optional().describe('Filter values such as web_design-full-custom'),
    featuredImage: z.string().optional().describe('Site path like /assets/images/portfolio/file.webp'),
    hidden: z.boolean().optional().describe('If true, omitted from the public /portfolio/ grid'),
};

const workProjectFields = {
    clientId: z.string().optional().describe('Client slug or numeric id'),
    clientSlug: z.string().optional(),
    name: z.string().optional().describe('e.g. Davis Window & Door — Technical SEO/AEO'),
    serviceType: z.string().optional().describe('seo, aeo, website, hosting, maintenance, google-ads, development, custom'),
    status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
    monthlyFee: z.number().optional(),
    fee: z.number().optional(),
    billingFrequency: z.enum(['monthly', 'yearly']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    notes: z.string().optional(),
};

export function compact(input) {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export function sanitizeForMcp(value, depth = 0) {
    if (value == null || depth > 8) return value;
    if (Array.isArray(value)) return value.map((item) => sanitizeForMcp(item, depth + 1));
    if (typeof value !== 'object') return value;
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        const normalized = key.replace(/[_-]/g, '').toLowerCase();
        if (SECRET_KEYS.has(normalized) || SECRET_KEYS.has(key.toLowerCase())) continue;
        out[key] = sanitizeForMcp(item, depth + 1);
    }
    return out;
}

function publicError(err) {
    const status = Number(err?.status) || 0;
    if (status >= 400 && status < 500 && err?.message) return String(err.message).slice(0, 300);
    return 'Tool failed';
}

function text(data) {
    return { content: [{ type: 'text', text: JSON.stringify(sanitizeForMcp(data), null, 2) }] };
}

function wrap(fn) {
    return async (args = {}) => {
        try {
            return text(await fn(args));
        } catch (err) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: publicError(err) }) }],
                isError: true,
            };
        }
    };
}

function readTool(server, name, description, schema, handler) {
    server.tool(name, `[read] ${description}`, schema, READ, wrap(handler));
}

function writeTool(server, name, description, schema, handler) {
    server.tool(name, `[write] ${description}`, schema, WRITE, wrap(handler));
}

function destructiveTool(server, name, description, schema, handler) {
    server.tool(name, `[write, destructive] ${description}`, schema, DESTRUCTIVE, wrap(handler));
}

export function createMcpServer({
    actor = { email: 'mcp', createdBy: 'mcp' },
    readOnly = false,
} = {}) {
    const server = new McpServer({
        name: 'leanne-digital',
        version: '1.4.0',
    });

    readTool(server, 'list_clients', 'List Leanne Digital clients. Optional serviceType filter (seo, hosting, maintenance). Does not change data.', {
        serviceType: z.string().optional(),
    }, async (input) => ({ clients: listAgencyClients({ role: 'staff' }, compact(input)) }));

    readTool(server, 'get_client', 'Get one client by slug or numeric id, including their client/service projects. Does not change data.', {
        id: z.string().describe('Slug like davis-window-and-door, or numeric id'),
    }, async ({ id }) => {
        const client = getAgencyClient(id);
        return { client, projects: listClientProjects({ client: client.slug }) };
    });

    readTool(server, 'list_seo_clients', 'Clients with an active SEO or AEO project/retainer. Does not change data.', {}, async () =>
        ({ clients: listSeoClients() })
    );

    readTool(server, 'list_projects', 'List client/service projects (not public portfolio pieces). Filter by client, serviceType, or status. Does not change data.', {
        client: z.string().optional().describe('Client slug or id'),
        serviceType: z.string().optional(),
        status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
    }, async (input) => ({ projects: listClientProjects(compact(input)) }));

    readTool(server, 'get_project', 'Get one client/service project and its status history. Does not change data.', {
        id: z.string().describe('Project id'),
    }, async ({ id }) => {
        const project = getClientProject(id);
        if (!project) return { error: 'Project not found' };
        return { project, updates: updatesForProject(id) };
    });

    readTool(server, 'list_project_updates', 'Chronological status/history updates for a client/service project. Does not change data.', {
        id: z.string(),
    }, async ({ id }) => ({ updates: updatesForProject(id) }));

    readTool(server, 'get_monthly_revenue', 'Operational MRR / expected revenue for a month (YYYY-MM), from active client projects. Does not change data.', {
        month: z.string().optional().describe('YYYY-MM. Defaults to this month.'),
    }, async ({ month }) => getMonthlyRevenue(month));

    readTool(server, 'get_client_revenue', 'Revenue for one client from their active projects. Does not change data.', {
        id: z.string().describe('Client slug or id'),
        month: z.string().optional(),
    }, async ({ id, month }) => getClientRevenue(id, month));

    readTool(server, 'get_revenue_by_service', 'Revenue broken down by service type (seo, hosting, maintenance, ...). Does not change data.', {
        month: z.string().optional(),
    }, async ({ month }) => getRevenueByService(month));

    readTool(server, 'portal_dashboard', 'Legacy retainer dashboard totals from client service records. Does not change data.', {}, async () =>
        ({ stats: getDashboardStats() })
    );

    readTool(server, 'get_site_statistics', 'Read Leanne Digital site traffic from Lilipadd. Does not collect analytics and does not change data.', {
        month: z.string().optional(),
    }, async ({ month }) => getSiteStatistics({ month }));

    readTool(server, 'get_site_conversions', 'Read Leanne Digital conversions from Lilipadd. Does not collect analytics and does not change data.', {
        month: z.string().optional(),
    }, async ({ month }) => getSiteConversions({ month }));

    readTool(server, 'list_portfolio_projects', 'Public website portfolio pieces, including hidden ones. Does not change data.', {}, async () =>
        ({ projects: loadPortfolioProjects() })
    );

    readTool(server, 'list_form_submissions', 'Contact form submissions and lead status. Does not change data.', {}, async () =>
        ({ inbox: loadSubmissions() })
    );

    readTool(server, 'list_calendly_bookings', 'Calendly bookings stored from the webhook. Does not change data.', {}, async () =>
        ({ bookings: loadCalendlyBookings() })
    );

    if (readOnly) return server;

    writeTool(server, 'create_client', 'Creates a client and portal login. Changes CRM data. Passwords are never returned over MCP.', clientFields, async (input) =>
        createClientWithAccount(compact(input))
    );

    writeTool(server, 'update_client', 'Updates an existing client retainer, contact details, or hosting amount. Changes CRM data.', {
        id: z.string().describe('Slug or numeric id'),
        ...clientFields,
        name: z.string().optional(),
    }, async ({ id, ...input }) => updateClientWithAccount(id, compact(input)));

    destructiveTool(server, 'delete_client', 'Permanently removes a client and their portal login. Requires confirm=true. This cannot be undone.', {
        id: z.string().describe('Slug or numeric id'),
        confirm: z.literal(true).describe('Must be true to delete'),
    }, async ({ id }) => ({ deleted: true, client: await deleteClientWithAccount(id) }));

    writeTool(server, 'create_project', 'Creates a client/service project such as SEO, maintenance, hosting, or Google Ads. Changes project data.', {
        ...workProjectFields,
        clientId: z.string().describe('Client slug or id'),
        serviceType: z.string().describe('seo, aeo, website, hosting, maintenance, google-ads, development, custom'),
    }, async (input) => ({ project: createClientProject(compact(input), actor) }));

    writeTool(server, 'update_project', 'Updates a client/service project. Changes project data.', {
        id: z.string(),
        ...workProjectFields,
    }, async ({ id, ...input }) => ({ project: updateClientProject(id, compact(input), actor) }));

    writeTool(server, 'pause_project', 'Pauses a client/service project. Changes project status.', {
        id: z.string(),
    }, async ({ id }) => ({ project: setProjectStatus(id, 'paused', { ...actor, message: 'Paused' }) }));

    writeTool(server, 'resume_project', 'Resumes a paused client/service project. Changes project status.', {
        id: z.string(),
    }, async ({ id }) => ({ project: setProjectStatus(id, 'active', { ...actor, message: 'Resumed' }) }));

    writeTool(server, 'complete_project', 'Marks a client/service project completed. Changes project status.', {
        id: z.string(),
    }, async ({ id }) => ({ project: setProjectStatus(id, 'completed', { ...actor, message: 'Completed' }) }));

    writeTool(server, 'add_project_update', 'Appends a status update without overwriting previous history. Changes project history.', {
        id: z.string(),
        message: z.string(),
        status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
    }, async ({ id, message, status }) =>
        ({ update: addProjectUpdate(id, { message, status, createdBy: actor.createdBy }) })
    );

    writeTool(server, 'create_portfolio_project', 'Adds a public portfolio piece and regenerates pages. Changes public website data.', portfolioFields, async (input) =>
        ({ project: await createPortfolioProject(compact(input)) })
    );

    writeTool(server, 'update_portfolio_project', 'Edits a public portfolio piece. Changes public website data.', {
        slug: z.string(),
        ...portfolioFields,
        title: z.string().optional(),
    }, async ({ slug, ...input }) => ({ project: await updatePortfolioProject(slug, compact(input)) }));

    destructiveTool(server, 'delete_portfolio_project', 'Removes a public portfolio piece. Requires confirm=true. This cannot be undone.', {
        slug: z.string(),
        confirm: z.literal(true).describe('Must be true to delete'),
    }, async ({ slug }) => ({ deleted: true, project: await deletePortfolioProject(slug) }));

    writeTool(server, 'set_lead_status', 'Updates follow-up status of a contact-form lead. Changes lead pipeline data.', {
        id: z.string(),
        status: z.enum(['new', 'contacted', 'won', 'closed']),
    }, async ({ id, status }) => setLeadStatus(id, status));

    return server;
}

export const MCP_READ_TOOLS = [
    'list_clients',
    'get_client',
    'list_seo_clients',
    'list_projects',
    'get_project',
    'list_project_updates',
    'get_monthly_revenue',
    'get_client_revenue',
    'get_revenue_by_service',
    'portal_dashboard',
    'get_site_statistics',
    'get_site_conversions',
    'list_portfolio_projects',
    'list_form_submissions',
    'list_calendly_bookings',
];

export const MCP_WRITE_TOOLS = [
    'create_client',
    'update_client',
    'delete_client',
    'create_project',
    'update_project',
    'pause_project',
    'resume_project',
    'complete_project',
    'add_project_update',
    'create_portfolio_project',
    'update_portfolio_project',
    'delete_portfolio_project',
    'set_lead_status',
];
