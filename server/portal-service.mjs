import {
    createClient,
    deleteClient,
    updateClient,
} from '../scripts/client-store.mjs';
import {
    deleteUsersForClient,
    getUserByEmail,
    provisionClientAccount,
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

export async function createClientWithAccount(input) {
    const client = await createClient(input);
    const account = await provisionClientAccount(client, input);
    return {
        client,
        account: {
            email: account.email,
            temporaryPassword: account.temporaryPassword || undefined,
            created: account.created,
        },
    };
}

export async function updateClientWithAccount(id, input) {
    const client = await updateClient(id, input);
    const existing = syncClientUser(client, input);
    if (!existing) await provisionClientAccount(client, input);
    return { client };
}

export async function deleteClientWithAccount(id) {
    const client = await deleteClient(id);
    deleteUsersForClient(client.slug);
    return client;
}

export { getUserByEmail };
