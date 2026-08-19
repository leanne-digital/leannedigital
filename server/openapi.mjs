export function openApiSpec(port = 4174) {
    const server = `http://127.0.0.1:${port}`;
    return {
        openapi: '3.1.0',
        info: {
            title: 'Leanne Digital Client Portal API',
            version: '1.4.0',
            description:
                'Leanne Digital staff API: clients, client/service projects, revenue, portfolio, leads, Calendly. Portfolio is public website work; /api/projects is agency work (SEO, hosting, maintenance).',
        },
        servers: [{ url: server }],
        security: [{ apiKey: [] }, { cookieAuth: [] }],
        components: {
            securitySchemes: {
                apiKey: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                },
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'ld_portal',
                },
            },
            schemas: {
                ClientInput: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', example: 'Some Company' },
                        contactName: { type: 'string' },
                        email: { type: 'string' },
                        password: { type: 'string', description: 'Optional. If omitted, a temporary password is returned once.' },
                        website: { type: 'string' },
                        googleDrive: { type: 'string', example: 'https://drive.google.com/drive/folders/...' },
                        location: { type: 'string' },
                        phone: { type: 'string' },
                        platform: { type: 'string', example: 'WordPress' },
                        domainProvider: { type: 'string' },
                        emailProvider: { type: 'string' },
                        hostingProvider: { type: 'string' },
                        currency: { type: 'string', example: 'CAD' },
                        hostingAmount: { type: 'number', example: 250 },
                        hostingCycle: { type: 'string', enum: ['monthly', 'yearly'], example: 'yearly' },
                        seoAmount: { type: 'number' },
                        aeoAmount: { type: 'number' },
                        maintenanceAmount: { type: 'number' },
                        managementAmount: { type: 'number', example: 50 },
                        hostingLastBilled: { type: 'string', example: '2025-12-18' },
                        hostingNextBillDate: { type: 'string', example: '2026-12-18' },
                        discount: { type: 'number', example: 50 },
                        taxAmount: { type: 'number', example: 21.25 },
                        credentials: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    kind: { type: 'string', enum: ['hosting', 'domain', 'email', 'app'] },
                                    label: { type: 'string' },
                                    url: { type: 'string' },
                                    username: { type: 'string' },
                                    password: { type: 'string' },
                                    notes: { type: 'string' },
                                },
                            },
                        },
                        bio: { type: 'string' },
                    },
                    required: ['name'],
                },
            },
        },
        paths: {
            '/api/auth/login': {
                post: {
                    summary: 'Log in',
                    security: [],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        email: { type: 'string' },
                                        password: { type: 'string' },
                                    },
                                    required: ['email', 'password'],
                                },
                            },
                        },
                    },
                    responses: { 200: { description: 'Sets ld_portal cookie' } },
                },
            },
            '/api/auth/logout': {
                post: {
                    summary: 'Log out',
                    responses: { 200: { description: 'Clears session cookie' } },
                },
            },
            '/api/auth/forgot': {
                post: {
                    summary: 'Request a password reset',
                    security: [],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { email: { type: 'string' } },
                                    required: ['email'],
                                },
                            },
                        },
                    },
                    responses: { 200: { description: 'Always succeeds without revealing whether the email exists' } },
                },
            },
            '/api/auth/reset': {
                post: {
                    summary: 'Set a new password from a reset token',
                    security: [],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        token: { type: 'string' },
                                        password: { type: 'string' },
                                    },
                                    required: ['token', 'password'],
                                },
                            },
                        },
                    },
                    responses: { 200: { description: 'Password updated' } },
                },
            },
            '/api/auth/password': {
                post: {
                    summary: 'Change password while signed in',
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        currentPassword: { type: 'string' },
                                        password: { type: 'string' },
                                    },
                                    required: ['password'],
                                },
                            },
                        },
                    },
                    responses: { 200: { description: 'Password updated' } },
                },
            },
            '/api/portal/me': {
                get: {
                    summary: 'Current user and client onboarding profile',
                    responses: { 200: { description: 'User plus client-safe profile' } },
                },
            },
            '/api/portal/profile': {
                patch: {
                    summary: 'Client updates onboarding, contact, and extra services',
                    responses: { 200: { description: 'Updated client profile' } },
                },
            },
            '/api/portal/avatar': {
                get: { summary: 'Current user avatar image', responses: { 200: { description: 'Image' } } },
                post: {
                    summary: 'Upload an avatar as a data URL',
                    responses: { 200: { description: 'Updated user' } },
                },
            },
            '/api/dashboard': {
                get: {
                    summary: 'Staff dashboard totals',
                    operationId: 'portalDashboard',
                    responses: { 200: { description: 'Counts, renewals, and revenue totals' } },
                },
            },
            '/api/clients': {
                get: {
                    summary: 'List clients',
                    operationId: 'listClients',
                    responses: { 200: { description: 'Staff see all clients; clients see only themselves' } },
                },
                post: {
                    summary: 'Create a client and portal login',
                    operationId: 'createClient',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ClientInput' },
                            },
                        },
                    },
                    responses: { 201: { description: 'Created client plus temporary password' } },
                },
            },
            '/api/clients/{id}': {
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Client slug or numeric id',
                    },
                ],
                get: {
                    summary: 'Get one client',
                    operationId: 'getClient',
                    responses: { 200: { description: 'Client' } },
                },
                patch: {
                    summary: 'Update a client',
                    operationId: 'updateClient',
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ClientInput' },
                            },
                        },
                    },
                    responses: { 200: { description: 'Updated' } },
                },
                delete: {
                    summary: 'Delete a client',
                    operationId: 'deleteClient',
                    responses: { 200: { description: 'Deleted' } },
                },
            },
            '/api/clients/{id}/invite': {
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                post: {
                    summary: 'Email a set-password login link',
                    operationId: 'inviteClient',
                    responses: { 200: { description: 'Invite sent or login URL returned' } },
                },
            },
            '/api/clients/seo': {
                get: {
                    summary: 'Active SEO/AEO clients',
                    operationId: 'listSeoClients',
                    responses: { 200: { description: 'Clients with an active SEO or AEO project' } },
                },
            },
            '/api/projects': {
                get: {
                    summary: 'List client/service projects',
                    operationId: 'listProjects',
                    parameters: [
                        { name: 'client', in: 'query', schema: { type: 'string' } },
                        { name: 'serviceType', in: 'query', schema: { type: 'string' } },
                        { name: 'status', in: 'query', schema: { type: 'string' } },
                    ],
                    responses: { 200: { description: 'Agency projects, not public portfolio pieces' } },
                },
                post: {
                    summary: 'Create a client/service project',
                    operationId: 'createProject',
                    responses: { 201: { description: 'Created' } },
                },
            },
            '/api/projects/{id}': {
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                get: { summary: 'Get project and history', operationId: 'getProject', responses: { 200: { description: 'Project' } } },
                patch: { summary: 'Update project', operationId: 'updateProject', responses: { 200: { description: 'Updated' } } },
            },
            '/api/projects/{id}/pause': {
                post: { summary: 'Pause project', operationId: 'pauseProject', responses: { 200: { description: 'Paused' } } },
            },
            '/api/projects/{id}/resume': {
                post: { summary: 'Resume project', operationId: 'resumeProject', responses: { 200: { description: 'Active' } } },
            },
            '/api/projects/{id}/complete': {
                post: { summary: 'Complete project', operationId: 'completeProject', responses: { 200: { description: 'Completed' } } },
            },
            '/api/projects/{id}/updates': {
                get: { summary: 'List project status updates', operationId: 'listProjectUpdates', responses: { 200: { description: 'Chronological history' } } },
                post: { summary: 'Add a project status update', operationId: 'addProjectUpdate', responses: { 201: { description: 'Appended' } } },
            },
            '/api/revenue': {
                get: {
                    summary: 'Monthly recurring / expected operational revenue from active projects',
                    operationId: 'getMonthlyRevenue',
                    parameters: [{ name: 'month', in: 'query', schema: { type: 'string', example: '2026-08' } }],
                    responses: { 200: { description: 'Totals, by service, by client' } },
                },
            },
            '/api/revenue/by-service': {
                get: { summary: 'Revenue by service type', operationId: 'getRevenueByService', responses: { 200: { description: 'Breakdown' } } },
            },
            '/api/revenue/clients/{id}': {
                get: { summary: 'Revenue for one client', operationId: 'getClientRevenue', responses: { 200: { description: 'Client revenue' } } },
            },
            '/api/analytics/statistics': {
                get: { summary: 'Site traffic from Lilipadd', operationId: 'getSiteStatistics', responses: { 200: { description: 'Lilipadd payload or unavailable' } } },
            },
            '/api/analytics/conversions': {
                get: { summary: 'Conversions from Lilipadd', operationId: 'getSiteConversions', responses: { 200: { description: 'Lilipadd payload or unavailable' } } },
            },
            '/api/portfolio': {
                get: { summary: 'Public portfolio pieces', operationId: 'listPortfolio', responses: { 200: { description: 'Portfolio' } } },
                post: { summary: 'Create a public portfolio piece', operationId: 'createPortfolio', responses: { 201: { description: 'Created' } } },
            },
            '/api/inbox': {
                get: { summary: 'Contact form submissions', operationId: 'listInbox', responses: { 200: { description: 'Inbox' } } },
            },
            '/api/calendly': {
                get: { summary: 'Stored Calendly bookings', operationId: 'listCalendly', responses: { 200: { description: 'Bookings' } } },
            },
        },
    };
}
