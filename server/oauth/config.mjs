import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const OAUTH_BASE_PATH = '/oauth';
export const OAUTH_LOGIN_PATH = '/oauth/login';
export const OAUTH_CONSENT_PATH = '/oauth/consent';
export const MCP_SCOPE_READ = 'mcp:read';
export const MCP_SCOPE_WRITE = 'mcp:write';
export const OFFLINE_SCOPE = 'offline_access';
export const OAUTH_SCOPES = [MCP_SCOPE_READ, OFFLINE_SCOPE];
export const CSRF_COOKIE = 'ld_oauth_csrf';
export const MAX_OAUTH_BODY_BYTES = 64 * 1024;

export function oauthDataDir() {
    const configured = String(process.env.OAUTH_DATA_DIR || '').trim();
    return configured || path.join(ROOT, 'runtime', 'oauth');
}

export function oauthSecret() {
    return String(process.env.OAUTH_SECRET || process.env.BETTER_AUTH_SECRET || '').trim();
}

export function oauthEnabled() {
    return oauthSecret().length >= 32;
}

export function oauthIssuer(port) {
    const configured = String(process.env.OAUTH_ISSUER || '').trim().replace(/\/$/, '');
    if (configured) return configured;
    return `http://127.0.0.1:${port || process.env.PORTAL_API_PORT || 4174}`;
}

export function oauthResource(port) {
    const configured = String(process.env.OAUTH_RESOURCE || '').trim().replace(/\/$/, '');
    if (configured) return configured;
    return `${oauthIssuer(port)}/mcp`;
}

export function oauthAdminEmail() {
    return String(
        process.env.OAUTH_ADMIN_EMAIL || process.env.PORTAL_STAFF_EMAIL || 'gary@leannedigital.com'
    )
        .trim()
        .toLowerCase();
}

export function accessTokenTtl() {
    const n = Number(process.env.OAUTH_ACCESS_TOKEN_TTL);
    return Number.isFinite(n) && n > 0 ? n : 900;
}

export function refreshTokenTtl() {
    const n = Number(process.env.OAUTH_REFRESH_TOKEN_TTL);
    return Number.isFinite(n) && n > 0 ? n : 60 * 60 * 24 * 30;
}

export function isHttpsIssuer(issuer) {
    return String(issuer || '').startsWith('https://');
}
