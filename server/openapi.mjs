export function openApiSpec(port = 4174) {
    const server = `http://127.0.0.1:${port}`;
    return {
        openapi: '3.1.0',
        info: {
            title: 'Leanne Digital Client Portal API',
            version: '1.1.0',
            description:
                'Staff dashboard and client CRUD. Creating a client also creates a portal login. Staff see every client; clients only see their own page.',
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
                        platform: { type: 'string', example: 'WordPress' },
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
        },
    };
}
