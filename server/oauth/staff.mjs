import { getUserByEmail } from '../auth.mjs';
import { oauthAdminEmail } from './config.mjs';

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

export function isOAuthStaffEmail(email) {
    const needle = normalizeEmail(email);
    if (!needle) return false;
    if (needle === oauthAdminEmail()) return true;
    const portalUser = getUserByEmail(needle);
    return portalUser?.role === 'staff';
}

export function oauthStaffDeniedMessage() {
    return 'Only Leanne Digital staff may authorize the agency MCP. Client portal users cannot approve this access.';
}
