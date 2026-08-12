import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getClient, loadClients } from '../scripts/client-store.mjs';
import { portalStats } from '../scripts/portal-stats.mjs';
import {
    createClientWithAccount,
    deleteClientWithAccount,
    updateClientWithAccount,
} from './portal-service.mjs';

const clientFields = {
    name: z.string().describe('Company name, e.g. Some Company'),
    contactName: z.string().optional(),
    email: z.string().optional().describe('Login email. Defaults to the client email or slug@clients.leannedigital.com'),
    password: z.string().optional().describe('Optional portal password. If omitted, a temporary password is returned once.'),
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
    bio: z.string().optional(),
};

function compact(input) {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function text(data) {
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({
    name: 'leanne-digital-client-portal',
    version: '1.0.0',
});

server.tool(
    'list_clients',
    'List every client in the Leanne Digital portal, including hosting, SEO, AEO, and maintenance retainers.',
    {},
    async () => text({ clients: loadClients() })
);

server.tool(
    'portal_dashboard',
    'Staff dashboard: client counts, hosting renewals, monthly recurring SEO/AEO/maintenance/combo clients, and monthly, yearly, and all-time totals.',
    {},
    async () => text({ stats: portalStats(loadClients()) })
);

server.tool(
    'get_client',
    'Get one client by slug or numeric id.',
    { id: z.string().describe('Slug like some-company, or numeric id') },
    async ({ id }) => {
        const client = getClient(id);
        if (!client) return text({ error: 'Client not found' });
        return text({ client });
    }
);

server.tool(
    'create_client',
    'Create a client with just a name if needed. Every client gets a portal login. Returns a temporary password once unless you set password.',
    clientFields,
    async (input) => text(await createClientWithAccount(compact(input)))
);

server.tool(
    'update_client',
    'Update an existing client retainer, Google Drive link, contact details, or hosting amount.',
    { id: z.string().describe('Slug or numeric id'), ...clientFields, name: z.string().optional() },
    async ({ id, ...input }) => text(await updateClientWithAccount(id, compact(input)))
);

server.tool(
    'delete_client',
    'Remove a client and their portal login.',
    { id: z.string().describe('Slug or numeric id') },
    async ({ id }) => {
        const client = await deleteClientWithAccount(id);
        return text({ deleted: true, client });
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);
