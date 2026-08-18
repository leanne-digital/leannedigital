import { createLocalJWKSet, decodeJwt, jwtVerify } from 'jose';
import { MCP_SCOPE_READ, MCP_SCOPE_WRITE, oauthEnabled } from './config.mjs';
import { getOAuth } from './auth.mjs';

function tokenScopes(payload) {
    const raw = payload?.scope || payload?.scp || '';
    if (Array.isArray(raw)) return raw.map(String);
    return String(raw)
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
}

function audienceList(payload) {
    const aud = payload?.aud;
    if (!aud) return [];
    return Array.isArray(aud) ? aud.map(String) : [String(aud)];
}

export function looksLikeJwt(token) {
    const parts = String(token || '').split('.');
    return parts.length === 3 && parts.every(Boolean);
}

export async function verifyMcpAccessToken(token, { audience, requiredScopes = [MCP_SCOPE_READ] } = {}) {
    if (!oauthEnabled()) {
        return { ok: false, error: 'invalid_token', description: 'OAuth is not configured' };
    }
    const oauth = getOAuth();
    if (!oauth) {
        return { ok: false, error: 'invalid_token', description: 'OAuth is not ready' };
    }
    const expectedAudience = audience || oauth.resource;
    const value = String(token || '').trim();
    if (!value) {
        return { ok: false, error: 'invalid_token', description: 'Missing access token' };
    }

    try {
        let payload;
        if (looksLikeJwt(value)) {
            const jwks = await oauth.auth.api.getJwks();
            const verified = await jwtVerify(value, createLocalJWKSet(jwks), {
                issuer: oauth.issuer,
                audience: expectedAudience,
                clockTolerance: 5,
            });
            payload = verified.payload;
        } else {
            const result = await oauth.auth.api.introspectOAuthToken?.({
                body: { token: value },
            }).catch(() => null);
            if (!result || result.active !== true) {
                return { ok: false, error: 'invalid_token', description: 'Access token is not active' };
            }
            payload = result;
            const aud = audienceList(payload);
            if (expectedAudience && !aud.includes(expectedAudience)) {
                return { ok: false, error: 'invalid_token', description: 'Access token audience is invalid' };
            }
            if (payload.iss && payload.iss !== oauth.issuer) {
                return { ok: false, error: 'invalid_token', description: 'Access token issuer is invalid' };
            }
        }

        const scopes = tokenScopes(payload);
        const missing = requiredScopes.filter((scope) => !scopes.includes(scope));
        if (missing.length) {
            return {
                ok: false,
                error: 'insufficient_scope',
                description: `Missing required scope: ${missing.join(' ')}`,
                scopes,
            };
        }

        const expiresAt = Number(payload.exp);
        if (!Number.isFinite(expiresAt)) {
            return { ok: false, error: 'invalid_token', description: 'Access token has no expiration' };
        }

        return {
            ok: true,
            payload,
            scopes,
            expiresAt,
            clientId: String(payload.azp || payload.client_id || payload.sub || ''),
            email: String(payload.email || ''),
            subject: String(payload.sub || ''),
            audience: audienceList(payload),
        };
    } catch {
        return { ok: false, error: 'invalid_token', description: 'Access token is invalid or expired' };
    }
}

export function decodeJwtUnsafe(token) {
    try {
        return decodeJwt(token);
    } catch {
        return null;
    }
}

export function tokenHasWriteScope(scopes = []) {
    return scopes.includes(MCP_SCOPE_WRITE);
}
