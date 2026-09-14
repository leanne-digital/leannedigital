import { APIError } from 'better-auth/api';
import { isOAuthStaffEmail, oauthStaffDeniedMessage } from './staff.mjs';

export function verifiedGoogleStaff(profile) {
    const email = String(profile.email || '').trim().toLowerCase();
    if (profile.email_verified !== true || !isOAuthStaffEmail(email)) {
        throw new APIError('FORBIDDEN', { message: oauthStaffDeniedMessage() });
    }
    return { email, emailVerified: true };
}

export function googleProvider() {
    const clientId = String(process.env.OAUTH_GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.OAUTH_GOOGLE_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret, prompt: 'select_account', disableIdTokenSignIn: true,
        mapProfileToUser: verifiedGoogleStaff };
}
