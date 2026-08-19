import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadClients } from '../scripts/client-store.mjs';
import { SITE_URL } from '../scripts/site-config.mjs';
import { mailConfigured, sendMail } from './mail.mjs';

const scryptAsync = promisify(scrypt);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USERS_FILE = path.join(ROOT, 'data', 'portal-users.json');
const SESSIONS_FILE = path.join(ROOT, 'data', 'portal-sessions.json');
const RESETS_FILE = path.join(ROOT, 'data', 'portal-resets.json');
const BOOTSTRAP_FILE = path.join(ROOT, 'data', 'portal-bootstrap.json');
const AVATARS_DIR = path.join(ROOT, 'data', 'avatars');

export const COOKIE_NAME = 'ld_portal';
const SESSION_DAYS = 7;
const RESET_MINUTES = 60;
const INVITE_DAYS = 14;
const PASSWORD_MIN = 8;

function readJson(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stamp() {
    return new Date().toISOString();
}

function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function accountEmail(client) {
    if (looksLikeEmail(client?.email)) return String(client.email).trim().toLowerCase();
    return `${client.slug}@clients.leannedigital.com`;
}

export function randomPassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = randomBytes(length);
    return [...bytes].map((byte) => chars[byte % chars.length]).join('');
}

async function hashPassword(password) {
    const salt = randomBytes(16).toString('hex');
    const derived = await scryptAsync(password, salt, 64);
    return `scrypt:${salt}:${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, stored) {
    if (!stored || !password) return false;
    const [algo, salt, hash] = String(stored).split(':');
    if (algo !== 'scrypt' || !salt || !hash) return false;
    const derived = await scryptAsync(password, salt, 64);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(derived);
    return a.length === b.length && timingSafeEqual(a, b);
}

function loadUsers() {
    return readJson(USERS_FILE, []);
}

function saveUsers(users) {
    writeJson(USERS_FILE, users);
}

function publicUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        clientSlug: user.clientSlug || null,
        name: user.name || null,
        mustChangePassword: Boolean(user.mustChangePassword),
        avatarUrl: user.avatarFile ? `/api/portal/avatar?u=${user.id}` : null,
    };
}

function nextUserId(users) {
    return Math.max(0, ...users.map((user) => Number(user.id) || 0)) + 1;
}

export function getUserByEmail(email) {
    const needle = String(email || '').trim().toLowerCase();
    return loadUsers().find((user) => user.email === needle) || null;
}

export function getUserById(id) {
    return loadUsers().find((user) => String(user.id) === String(id)) || null;
}

export function usersForClient(slug) {
    return loadUsers().filter((user) => user.clientSlug === slug);
}

export function deleteUsersForClient(slug) {
    saveUsers(loadUsers().filter((user) => user.clientSlug !== slug));
}

function appendBootstrap(entry) {
    const current = readJson(BOOTSTRAP_FILE, { generatedAt: stamp(), staff: null, clients: [] });
    if (entry.role === 'staff') current.staff = entry.account;
    else current.clients = [...(current.clients || []).filter((row) => row.slug !== entry.account.slug), entry.account];
    current.generatedAt = stamp();
    writeJson(BOOTSTRAP_FILE, current);
}

export async function createUser({ email, password, role, clientSlug, name, mustChangePassword = false }) {
    const users = loadUsers();
    const normalized = String(email || '').trim().toLowerCase();
    if (!looksLikeEmail(normalized)) {
        const error = new Error('A valid email is required for the account');
        error.status = 400;
        throw error;
    }
    if (users.some((user) => user.email === normalized)) {
        const error = new Error('An account with that email already exists');
        error.status = 409;
        throw error;
    }
    if (String(password || '').length < PASSWORD_MIN) {
        const error = new Error(`Password must be at least ${PASSWORD_MIN} characters`);
        error.status = 400;
        throw error;
    }
    const user = {
        id: nextUserId(users),
        email: normalized,
        passwordHash: await hashPassword(password),
        role: role === 'staff' ? 'staff' : 'client',
        clientSlug: role === 'staff' ? null : clientSlug || null,
        name: name || null,
        mustChangePassword: Boolean(mustChangePassword),
        createdAt: stamp(),
    };
    users.push(user);
    saveUsers(users);
    return user;
}

export async function provisionClientAccount(client, input = {}) {
    if (!client?.slug) {
        const error = new Error('Client is required');
        error.status = 400;
        throw error;
    }
    const existing = usersForClient(client.slug)[0] || (looksLikeEmail(input.email || client.email)
        ? getUserByEmail(input.email || client.email)
        : null);
    if (existing && existing.clientSlug === client.slug) {
        return { email: existing.email, created: false };
    }

    let email = looksLikeEmail(input.email) ? String(input.email).trim().toLowerCase() : accountEmail(client);
    if (getUserByEmail(email)) email = `${client.slug}@clients.leannedigital.com`;
    if (getUserByEmail(email)) {
        const error = new Error('Could not create a unique login email for this client');
        error.status = 409;
        throw error;
    }

    const temporaryPassword = input.password || randomPassword();
    const user = await createUser({
        email,
        password: temporaryPassword,
        role: 'client',
        clientSlug: client.slug,
        name: input.contactName || client.contactName || client.name,
        mustChangePassword: !input.password,
    });
    const account = {
        slug: client.slug,
        email: user.email,
        temporaryPassword,
    };
    if (!input.password) appendBootstrap({ role: 'client', account });
    return { ...account, created: true };
}

export async function seedStaffAccount() {
    if (loadUsers().some((user) => user.role === 'staff')) return null;
    const email = (process.env.PORTAL_STAFF_EMAIL || 'gary@leannedigital.com').trim().toLowerCase();
    const fromEnv = Boolean(process.env.PORTAL_STAFF_PASSWORD);
    const password = process.env.PORTAL_STAFF_PASSWORD || randomPassword(16);
    const user = await createUser({
        email,
        password,
        role: 'staff',
        name: 'Leanne Digital',
        mustChangePassword: !fromEnv,
    });
    if (!fromEnv) {
        appendBootstrap({
            role: 'staff',
            account: { email: user.email, temporaryPassword: password },
        });
    }
    return { email: user.email, temporaryPassword: fromEnv ? undefined : password, created: true };
}

export async function ensureClientAccounts() {
    const created = [];
    for (const client of loadClients()) {
        const result = await provisionClientAccount(client);
        if (result.created) created.push(result);
    }
    return created;
}

function loadSessions() {
    const now = Date.now();
    const sessions = readJson(SESSIONS_FILE, []).filter((session) => new Date(session.expiresAt).getTime() > now);
    writeJson(SESSIONS_FILE, sessions);
    return sessions;
}

export function createSession(userId) {
    const sessions = loadSessions();
    const session = {
        id: randomBytes(32).toString('hex'),
        userId,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
    sessions.push(session);
    writeJson(SESSIONS_FILE, sessions);
    return session;
}

export function destroySession(sessionId) {
    writeJson(
        SESSIONS_FILE,
        loadSessions().filter((session) => session.id !== sessionId)
    );
}

export function sessionFromCookie(header) {
    const match = String(header || '').match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : '';
}

export function getSessionUser(req) {
    const sessionId = sessionFromCookie(req.headers.cookie);
    if (!sessionId) return { session: null, user: null };
    const session = loadSessions().find((row) => row.id === sessionId);
    if (!session) return { session: null, user: null };
    const user = getUserById(session.userId);
    if (!user) return { session: null, user: null };
    return { session, user };
}

export function cookieHeader(sessionId, { clear = false } = {}) {
    if (clear || !sessionId) {
        return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
    }
    return `${COOKIE_NAME}=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
}

export async function login(email, password) {
    const user = getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
        const error = new Error('Invalid email or password');
        error.status = 401;
        throw error;
    }
    const session = createSession(user.id);
    return { user: publicUser(user), session };
}

function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

export function createResetToken(userId, { minutes = RESET_MINUTES } = {}) {
    const token = randomBytes(32).toString('hex');
    const resets = readJson(RESETS_FILE, []).filter((row) => new Date(row.expiresAt).getTime() > Date.now());
    resets.push({
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
    });
    writeJson(RESETS_FILE, resets);
    return token;
}

function resetUrlFor(origin, token) {
    const base = String(origin || process.env.SITE_URL || SITE_URL).replace(/\/$/, '');
    return `${base}/login/reset/?token=${token}`;
}

async function emailResetLink(user, resetUrl, kind = 'reset') {
    const name = user.name || 'there';
    const invite = kind === 'invite';
    const subject = invite
        ? 'Your Leanne Digital client portal'
        : 'Reset your Leanne Digital portal password';
    const text = invite
        ? [
              `Hi ${name},`,
              '',
              'We set up your Leanne Digital client portal. Choose a password with this link, then you can add your business details:',
              resetUrl,
              '',
              `This link expires in ${INVITE_DAYS} days. After that, use Forgot password on the login page.`,
              '',
              'Leanne Digital',
          ].join('\n')
        : [
              `Hi ${name},`,
              '',
              'Use this link to choose a new password for your Leanne Digital client portal:',
              resetUrl,
              '',
              'This link expires in 60 minutes. If you did not ask for a reset, you can ignore this email.',
              '',
              'Leanne Digital',
          ].join('\n');
    if (!mailConfigured()) {
        console.log(`${invite ? 'Portal invite' : 'Password reset'} for ${user.email}: ${resetUrl}`);
        return false;
    }
    try {
        await sendMail({ to: user.email, subject, text });
        return true;
    } catch (error) {
        console.error('Portal email failed:', error.message);
        console.log(`${invite ? 'Portal invite' : 'Password reset'} for ${user.email}: ${resetUrl}`);
        return false;
    }
}

export async function requestPasswordReset(email, origin) {
    const user = getUserByEmail(email);
    const generic = { ok: true, message: 'If that email has an account, a reset link is on the way.' };
    if (!user) return generic;

    const token = createResetToken(user.id);
    const resetUrl = resetUrlFor(origin, token);
    const emailed = await emailResetLink(user, resetUrl, 'reset');
    return {
        ...generic,
        ...(process.env.PORTAL_DEV_RESET_LINKS === '1' ? { resetUrl, emailed } : {}),
    };
}

export async function inviteUser(user, origin) {
    if (!user) {
        const error = new Error('Account not found');
        error.status = 404;
        throw error;
    }
    const token = createResetToken(user.id, { minutes: INVITE_DAYS * 24 * 60 });
    const resetUrl = resetUrlFor(origin, token);
    const emailed = await emailResetLink(user, resetUrl, 'invite');
    return {
        email: user.email,
        emailed,
        inviteUrl: resetUrl,
    };
}

export async function changePassword(userId, { currentPassword, password } = {}) {
    const users = loadUsers();
    const user = users.find((row) => String(row.id) === String(userId));
    if (!user) {
        const error = new Error('Not signed in');
        error.status = 401;
        throw error;
    }
    if (String(password || '').length < PASSWORD_MIN) {
        const error = new Error(`Password must be at least ${PASSWORD_MIN} characters`);
        error.status = 400;
        throw error;
    }
    if (!user.mustChangePassword) {
        if (!(await verifyPassword(currentPassword, user.passwordHash))) {
            const error = new Error('Current password is incorrect');
            error.status = 400;
            throw error;
        }
    }
    user.passwordHash = await hashPassword(password);
    user.mustChangePassword = false;
    saveUsers(users);
    return publicUser(user);
}

export function updateUserProfile(userId, input = {}) {
    const users = loadUsers();
    const user = users.find((row) => String(row.id) === String(userId));
    if (!user) {
        const error = new Error('Not signed in');
        error.status = 401;
        throw error;
    }
    if (input.name) user.name = String(input.name).trim();
    if ('avatarFile' in input) user.avatarFile = input.avatarFile || null;
    saveUsers(users);
    return publicUser(user);
}

function avatarExtension(mime) {
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/gif') return 'gif';
    return 'jpg';
}

export function saveUserAvatar(userId, dataUrl) {
    const match = String(dataUrl || '').match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) {
        const error = new Error('Upload a JPG, PNG, WebP, or GIF image');
        error.status = 400;
        throw error;
    }
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length || buffer.length > 400 * 1024) {
        const error = new Error('Keep the image under 400 KB');
        error.status = 400;
        throw error;
    }
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
    const ext = avatarExtension(match[1].toLowerCase());
    const filename = `${userId}.${ext}`;
    const previous = fs.existsSync(AVATARS_DIR)
        ? fs.readdirSync(AVATARS_DIR).filter((name) => name.startsWith(`${userId}.`))
        : [];
    for (const name of previous) {
        fs.unlinkSync(path.join(AVATARS_DIR, name));
    }
    fs.writeFileSync(path.join(AVATARS_DIR, filename), buffer);
    return updateUserProfile(userId, { avatarFile: filename });
}

export function avatarFileFor(user) {
    if (!user?.avatarFile) return null;
    const file = path.join(AVATARS_DIR, path.basename(user.avatarFile));
    return fs.existsSync(file) ? file : null;
}

export async function resetPassword(token, password) {
    if (!token) {
        const error = new Error('Reset link is missing or expired');
        error.status = 400;
        throw error;
    }
    if (String(password || '').length < PASSWORD_MIN) {
        const error = new Error(`Password must be at least ${PASSWORD_MIN} characters`);
        error.status = 400;
        throw error;
    }
    const tokenHash = hashToken(token);
    const resets = readJson(RESETS_FILE, []);
    const index = resets.findIndex(
        (row) => row.tokenHash === tokenHash && new Date(row.expiresAt).getTime() > Date.now()
    );
    if (index < 0) {
        const error = new Error('Reset link is missing or expired');
        error.status = 400;
        throw error;
    }
    const reset = resets[index];
    const users = loadUsers();
    const user = users.find((row) => row.id === reset.userId);
    if (!user) {
        const error = new Error('Reset link is missing or expired');
        error.status = 400;
        throw error;
    }
    user.passwordHash = await hashPassword(password);
    user.mustChangePassword = false;
    saveUsers(users);
    writeJson(
        RESETS_FILE,
        resets.filter((_, i) => i !== index)
    );
    writeJson(
        SESSIONS_FILE,
        loadSessions().filter((session) => session.userId !== user.id)
    );
    return publicUser(user);
}

export function canAccessClient(user, slug) {
    if (!user) return false;
    if (user.role === 'staff') return true;
    return user.clientSlug === slug;
}

export function clientVisibleTo(user, client) {
    return canAccessClient(user, client.slug);
}

export { publicUser, PASSWORD_MIN, AVATARS_DIR };
