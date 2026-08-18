import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { getMigrations } from 'better-auth/db/migration';
import { jwt } from 'better-auth/plugins';
import { oauthProvider, oauthProviderAuthServerMetadata } from '@better-auth/oauth-provider';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { randomPassword } from '../auth.mjs';
import { isOAuthStaffEmail, oauthStaffDeniedMessage } from './staff.mjs';
import {
    MCP_SCOPE_READ,
    OAUTH_BASE_PATH,
    OAUTH_CONSENT_PATH,
    OAUTH_LOGIN_PATH,
    OAUTH_SCOPES,
    OFFLINE_SCOPE,
    accessTokenTtl,
    isHttpsIssuer,
    oauthAdminEmail,
    oauthDataDir,
    oauthEnabled,
    oauthIssuer,
    oauthResource,
    oauthSecret,
    refreshTokenTtl,
} from './config.mjs';

let started = null;
let starting = null;

function persistGeneratedAdminPassword(email, password) {
    const file = path.join(oauthDataDir(), 'admin-bootstrap.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
        file,
        `${JSON.stringify({ generatedAt: new Date().toISOString(), email, temporaryPassword: password }, null, 2)}\n`,
        { encoding: 'utf8', mode: 0o600 }
    );
    return file;
}

async function seedOAuthAdmin(auth) {
    const email = oauthAdminEmail();
    const fromEnv = Boolean(String(process.env.OAUTH_ADMIN_PASSWORD || '').trim());
    const password = String(process.env.OAUTH_ADMIN_PASSWORD || '').trim() || randomPassword(20);
    try {
        await auth.api.signUpEmail({
            body: {
                email,
                password,
                name: 'Leanne Digital MCP Admin',
            },
        });
        if (!fromEnv) {
            const file = persistGeneratedAdminPassword(email, password);
            console.log(`OAuth admin account created for ${email}. Temporary password written to ${file}`);
        } else {
            console.log(`OAuth admin account created for ${email}`);
        }
        return { email, created: true };
    } catch (error) {
        const message = String(error?.message || error || '');
        if (/already exists|unique|USER_ALREADY_EXISTS/i.test(message)) {
            return { email, created: false };
        }
        throw error;
    }
}

async function createOAuthRuntime({ port } = {}) {
    if (!oauthEnabled()) return null;

    const issuer = oauthIssuer(port);
    const resource = oauthResource(port);
    const secure = isHttpsIssuer(issuer);
    const dataDir = oauthDataDir();
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'better-auth.sqlite');
    const database = new DatabaseSync(dbPath);

    const auth = betterAuth({
        secret: oauthSecret(),
        baseURL: issuer,
        basePath: OAUTH_BASE_PATH,
        database,
        trustedOrigins: [issuer],
        rateLimit: {
            enabled: true,
            window: 60,
            max: 80,
        },
        disabledPaths: [
            '/token',
            '/sign-up/email',
            '/forget-password',
            '/request-password-reset',
            '/reset-password',
            '/change-password',
            '/update-user',
            '/delete-user',
            '/change-email',
        ],
        emailAndPassword: {
            enabled: true,
            disableSignUp: false,
            minPasswordLength: 12,
        },
        session: {
            expiresIn: 60 * 60 * 8,
            cookieCache: {
                enabled: false,
            },
        },
        advanced: {
            useSecureCookies: secure,
            ipAddress: {
                ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'],
                trustedProxies: ['127.0.0.1', '::1'],
            },
            defaultCookieAttributes: {
                httpOnly: true,
                sameSite: 'lax',
                secure,
                path: OAUTH_BASE_PATH,
            },
        },
        hooks: {
            after: createAuthMiddleware(async (ctx) => {
                if (ctx.path !== '/sign-in/email' && ctx.path !== '/oauth2/consent') return;
                const email = ctx.context.newSession?.user?.email || ctx.context.session?.user?.email;
                if (email && !isOAuthStaffEmail(email)) {
                    throw new APIError('FORBIDDEN', { message: oauthStaffDeniedMessage() });
                }
            }),
        },
        plugins: [
            jwt({
                jwks: {
                    keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' },
                },
            }),
            oauthProvider({
                loginPage: OAUTH_LOGIN_PATH,
                consentPage: OAUTH_CONSENT_PATH,
                scopes: OAUTH_SCOPES,
                validAudiences: [resource],
                accessTokenExpiresIn: accessTokenTtl(),
                refreshTokenExpiresIn: refreshTokenTtl(),
                codeExpiresIn: 600,
                grantTypes: ['authorization_code', 'refresh_token'],
                allowDynamicClientRegistration: true,
                allowUnauthenticatedClientRegistration: true,
                allowPublicClientPrelogin: true,
                clientRegistrationDefaultScopes: [MCP_SCOPE_READ, OFFLINE_SCOPE],
                clientRegistrationAllowedScopes: [MCP_SCOPE_READ, OFFLINE_SCOPE],
                advertisedMetadata: {
                    scopes_supported: OAUTH_SCOPES,
                },
                rateLimit: {
                    register: { window: 60, max: 5 },
                    token: { window: 60, max: 20 },
                    authorize: { window: 60, max: 30 },
                },
                silenceWarnings: {
                    oauthAuthServerConfig: true,
                    openidConfig: true,
                },
            }),
        ],
    });

    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    await seedOAuthAdmin(auth);

    let advertisedIssuer = `${issuer}${OAUTH_BASE_PATH}`;
    try {
        const meta = await auth.api.getOAuthServerConfig();
        if (meta?.issuer) advertisedIssuer = String(meta.issuer).replace(/\/$/, '');
    } catch {
        // Fall back to origin + /oauth, which is Better Auth's default issuer.
    }

    return {
        auth,
        handler: toNodeHandler(auth),
        fromNodeHeaders,
        metadataHandler: oauthProviderAuthServerMetadata(auth),
        issuer: advertisedIssuer,
        publicOrigin: issuer,
        resource,
        adminEmail: oauthAdminEmail(),
        database,
    };
}

export async function startOAuth(options = {}) {
    if (started) return started;
    if (!oauthEnabled()) return null;
    if (!starting) {
        starting = createOAuthRuntime(options)
            .then((runtime) => {
                started = runtime;
                if (runtime) {
                    console.log(`OAuth issuer ${runtime.issuer}`);
                    console.log(`OAuth resource ${runtime.resource}`);
                    console.log(`OAuth data dir ${oauthDataDir()}`);
                }
                return runtime;
            })
            .catch((error) => {
                starting = null;
                throw error;
            });
    }
    return starting;
}

export function getOAuth() {
    return started;
}

export function newOAuthSecret() {
    return randomBytes(32).toString('hex');
}
