import fs from 'node:fs';
import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../data/login-security/', import.meta.url));
const fail = (message, status = 401) => Object.assign(new Error(message), { status });
const hash = value => createHash('sha256').update(String(value)).digest('hex');
function read(name, fallback) { try { return JSON.parse(fs.readFileSync(dir + name, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; } }
function write(name, data) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(dir + name + '.tmp', JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(dir + name + '.tmp', dir + name);
}
// Synchronous atomic updates: this application runs one Node process.
export function consumeLimit(key, max, windowMs, now = Date.now()) {
    const rows = read('limits.json', {});
    for (const [k, row] of Object.entries(rows)) if (row.until <= now) delete rows[k];
    const id = hash(key), row = rows[id] || { count: 0, until: now + windowMs };
    if (row.count >= max || Object.keys(rows).length > 20000) {
        const error = fail('Too many attempts. Please wait before trying again.', 429);
        error.retryAfter = Math.max(1, Math.ceil((row.until - now) / 1000));
        throw error;
    }
    row.count++; rows[id] = row; write('limits.json', rows);
}
export function clientIp(req) {
    const peer = req.socket.remoteAddress || 'unknown';
    // LiteSpeed appends the actual client to X-Forwarded-For; never trust the leftmost value.
    if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) {
        return String(req.headers['x-forwarded-for'] || peer).split(',').at(-1).trim();
    }
    return peer;
}
export function guardBrowserWrite(req) {
    const host = req.headers.host || '';
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    const allowed = local ? `http://${host}` : 'https://leannedigital.com';
    if ((req.headers.origin && req.headers.origin !== allowed && req.headers.origin !== 'https://www.leannedigital.com') || req.headers['sec-fetch-site'] === 'cross-site') throw fail('Request origin not allowed.', 403);
    if (req.url.split('?')[0] !== '/api/auth/logout' && !String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw fail('JSON request required.', 415);
}
export function limitAuth(req, action, email = '') {
    const minute = 60000;
    if (!email) consumeLimit(`ip:${action}:${clientIp(req)}`, action === 'forgot' ? 10 : 30, 15 * minute);
    else consumeLimit(`account:${action}:${String(email).trim().toLowerCase()}`, action === 'forgot' ? 3 : 10, (action === 'forgot' ? 60 : 15) * minute);
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function encodeSecret(bytes) {
    let bits = 0, value = 0, out = '';
    for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits) out += alphabet[(value << (5 - bits)) & 31];
    return out;
}
function decodeSecret(secret) {
    let bits = 0, value = 0; const out = [];
    for (const c of secret) { value = (value << 5) | alphabet.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
    return Buffer.from(out);
}
export function totp(secret, step = Math.floor(Date.now() / 30000), digits = 6) {
    const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
    const mac = createHmac('sha1', decodeSecret(secret)).update(counter).digest();
    return String((mac.readUInt32BE(mac[19] & 15) & 0x7fffffff) % (10 ** digits)).padStart(digits, '0');
}
function equal(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
function key() {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    try { return fs.readFileSync(dir + 'mfa.key'); } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        const value = randomBytes(32); fs.writeFileSync(dir + 'mfa.key', value, { mode: 0o600, flag: 'wx' }); return value;
    }
}
function encrypt(secret) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv); return Buffer.concat([iv, cipher.update(secret), cipher.final(), cipher.getAuthTag()]).toString('base64'); }
function decrypt(value) { const data = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12)); cipher.setAuthTag(data.subarray(-16)); return Buffer.concat([cipher.update(data.subarray(12, -16)), cipher.final()]).toString(); }
const challenges = new Map();
export function hasMfa(userId) { return Boolean(read('mfa.json', {})[userId]); }
export function startMfa(user) {
    const now = Date.now();
    for (const [id, c] of challenges) if (c.expires < now || c.userId === user.id) challenges.delete(id);
    if (challenges.size > 1000) throw fail('Please try again shortly.', 429);
    const record = read('mfa.json', {})[user.id];
    const secret = record ? null : encodeSecret(randomBytes(20));
    const challenge = randomBytes(32).toString('hex');
    challenges.set(hash(challenge), { userId: user.id, passwordHash: user.passwordHash, secret, expires: now + 600000, attempts: 0 });
    return { mfaRequired: true, challenge, setupRequired: !record, ...(secret ? { secret } : {}) };
}
export function finishMfa(challenge, code, getUser) {
    const id = hash(challenge), c = challenges.get(id);
    if (!c || c.expires < Date.now() || c.attempts >= 5) throw fail('Verification expired. Log in again.');
    c.attempts++;
    consumeLimit(`mfa-user:${c.userId}`, 10, 900000);
    const user = getUser(c.userId);
    if (!user || user.passwordHash !== c.passwordHash || user.role !== 'staff') throw fail('Verification expired. Log in again.');
    const records = read('mfa.json', {}), record = records[c.userId];
    if (c.secret && record) throw fail('Verification expired. Log in again.');
    const secret = c.secret || decrypt(record.secret);
    const clean = String(code || '').replace(/[\s-]/g, '').toUpperCase();
    const step = Math.floor(Date.now() / 30000);
    const match = [step - 1, step, step + 1].find(s => equal(clean, totp(secret, s)) && s > (record?.lastStep ?? -1));
    const recovery = record?.recovery?.indexOf(hash(clean)) ?? -1;
    if (match === undefined && recovery < 0) throw fail('Invalid or already used verification code.');
    let recoveryCodes;
    if (c.secret) {
        recoveryCodes = Array.from({ length: 10 }, () => randomBytes(10).toString('hex').toUpperCase());
        records[c.userId] = { secret: encrypt(secret), lastStep: match, recovery: recoveryCodes.map(hash) };
    } else {
        if (recovery >= 0) record.recovery.splice(recovery, 1); else record.lastStep = match;
    }
    write('mfa.json', records); challenges.delete(id);
    return { user, recoveryCodes };
}
