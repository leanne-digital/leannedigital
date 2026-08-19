import {
    createClient,
    archiveClient as archiveClientRecord,
    deleteClient,
    getClient,
    updateClient,
    updateClientPortalProfile,
} from '../scripts/client-store.mjs';
import { listClientProjects, presentProject, seedProjectsFromClientServices } from '../scripts/client-project-store.mjs';
import { onboardingComplete } from '../scripts/portal-options.mjs';
import {
    deleteUsersForClient,
    getUserByEmail,
    inviteUser,
    provisionClientAccount,
    publicUser,
    updateUserProfile,
    usersForClient,
} from './auth.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USERS_FILE = path.join(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    'data',
    'portal-users.json'
);

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
}

function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isPlaceholderEmail(email) {
    return String(email || '').toLowerCase().endsWith('@clients.leannedigital.com');
}

function syncClientUser(client, input = {}) {
    const users = readUsers();
    const user = users.find((row) => row.clientSlug === client.slug);
    if (!user) return null;
    if (looksLikeEmail(input.email)) {
        const email = String(input.email).trim().toLowerCase();
        const clash = users.find((row) => row.email === email && row.id !== user.id);
        if (!clash) user.email = email;
    }
    if (input.contactName) user.name = input.contactName;
    saveUsers(users);
    return user;
}

export function presentClient(client, user) {
    if (!client) return null;
    if (user?.role === 'staff') return client;
    return {
        slug: client.slug,
        name: client.name,
        contactName: client.contactName || '',
        email: client.email || '',
        phone: client.phone || '',
        location: client.location || '',
        website: client.website || '',
        platform: client.platform || '',
        domainProvider: client.domainProvider || '',
        emailProvider: client.emailProvider || '',
        hosting: {
            provider: client.hosting?.provider || '',
            type: client.hosting?.type || 'External',
            lddHosted: Boolean(client.hosting?.lddHosted),
        },
        onboarding: client.onboarding || { completedAt: null },
        onboardingComplete: onboardingComplete(client),
        clientApps: client.clientApps || [],
        reports: (client.reports || []).map((report) => ({ slug: report.slug, title: report.title })),
        services: (client.services || []).map((service) => ({ type: service.type, label: service.label })),
    };
}

export function listClientsFor(user, clients) {
    if (user?.role === 'staff') return clients;
    return clients.map((client) => presentClient(client, user));
}

function inviteableUser(client) {
    const user = usersForClient(client.slug)[0] || (looksLikeEmail(client.email) ? getUserByEmail(client.email) : null);
    if (!user || isPlaceholderEmail(user.email)) return null;
    return user;
}

export async function inviteClient(client, origin) {
    let user = inviteableUser(client);
    if (!user) {
        const account = await provisionClientAccount(client);
        user = getUserByEmail(account.email);
    }
    if (!user || isPlaceholderEmail(user.email)) {
        const error = new Error('Add a real client email before sending a login link');
        error.status = 400;
        throw error;
    }
    return inviteUser(user, origin);
}

export async function createClientWithAccount(input, { origin } = {}) {
    const client = await createClient(input);
    seedProjectsFromClientServices();
    const account = await provisionClientAccount(client, input);
    let invite = null;
    if (!isPlaceholderEmail(account.email)) {
        try {
            invite = await inviteClient(client, origin);
        } catch (error) {
            console.error('Client invite failed:', error.message);
        }
    }
    return {
        client,
        account: {
            email: account.email,
            temporaryPassword: account.temporaryPassword || undefined,
            created: account.created,
        },
        invite,
    };
}

export async function updateClientWithAccount(id, input) {
    const client = await updateClient(id, input);
    seedProjectsFromClientServices();
    const existing = syncClientUser(client, input);
    if (!existing) await provisionClientAccount(client, input);
    return { client };
}

export async function archiveClientWithAccount(id) {
    return { client: await archiveClientRecord(id), archived: true };
}

export async function updateOwnClientProfile(user, input = {}) {
    if (user.role !== 'client' || !user.clientSlug) {
        const error = new Error('Client account required');
        error.status = 403;
        throw error;
    }
    const current = getClient(user.clientSlug);
    if (!current) {
        const error = new Error('Client not found');
        error.status = 404;
        throw error;
    }
    const patch = {};
    if ('name' in input) patch.name = input.name;
    if ('contactName' in input) patch.contactName = input.contactName;
    if ('email' in input) patch.email = input.email;
    if ('phone' in input) patch.phone = input.phone;
    if ('location' in input) patch.location = input.location;
    if ('website' in input) patch.website = input.website;
    if ('platform' in input) patch.platform = input.platform;
    if ('domainProvider' in input) patch.domainProvider = input.domainProvider;
    if ('emailProvider' in input) patch.emailProvider = input.emailProvider;
    if ('hostingProvider' in input) patch.hostingProvider = input.hostingProvider;
    if ('clientApps' in input) patch.clientApps = input.clientApps;
    if ('onboarding' in input) {
        patch.onboarding = {
            ...input.onboarding,
            completedAt: input.onboarding?.completedAt || current.onboarding?.completedAt || new Date().toISOString(),
        };
    }
    const client = await updateClientPortalProfile(user.clientSlug, patch);
    syncClientUser(client, patch);
    if (patch.contactName) updateUserProfile(user.id, { name: patch.contactName });
    return presentClient(client, user);
}

export async function getPortalMe(user) {
    if (user.role === 'staff' || !user.clientSlug) {
        return { user: publicUser(user), client: null };
    }
    const client = getClient(user.clientSlug);
    if (!client) {
        const error = new Error('Client not found');
        error.status = 404;
        throw error;
    }
    return {
        user: publicUser(user),
        client: presentClient(client, user),
        projects: listClientProjects({ client: client.slug }).map((row) => presentProject(row, user)),
    };
}

export async function deleteClientWithAccount(id) {
    const client = await deleteClient(id);
    deleteUsersForClient(client.slug);
    return client;
}

export { getUserByEmail };
