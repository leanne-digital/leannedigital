export const MCP_ADMIN_EMAILS = ['gary@leannedigital.com', 'leanne@leannedigital.com'];

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

export function isOAuthStaffEmail(email) {
    const needle = normalizeEmail(email);
    return MCP_ADMIN_EMAILS.includes(needle);
}

export function oauthStaffDeniedMessage() {
    return 'Only gary@leannedigital.com and leanne@leannedigital.com may authorize this MCP connection.';
}
