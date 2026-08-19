export const PLATFORM_OPTIONS = [
    'WordPress',
    'Wix',
    'Webflow',
    'Squarespace',
    'Shopify',
    'Showit',
    'Custom / HTML',
    'None yet',
    'Other',
];

export const DOMAIN_PROVIDERS = [
    'GoDaddy',
    'Hover',
    'Namecheap',
    'Google Domains / Squarespace',
    'Cloudflare',
    'Network Solutions',
    'Name.com',
    'Leanne Digital',
    'Other',
    'Not sure',
];

export const HOSTING_PROVIDERS = [
    'SiteGround',
    'WP Engine',
    'Kinsta',
    'Cloudways',
    'Bluehost',
    'HostGator',
    'Shopify',
    'Wix',
    'Squarespace',
    'Webflow',
    'Leanne Digital',
    'Other',
    'Not sure',
];

export const EMAIL_PROVIDERS = [
    'Google Workspace',
    'Microsoft 365',
    'GoDaddy',
    'Fastmail',
    'Proton',
    'iCloud',
    'Leanne Digital',
    'Other',
    'Not sure',
];

export const CONTACT_METHODS = [
    ['email', 'Email'],
    ['phone', 'Phone call'],
    ['text', 'Text message'],
];

export const SERVICE_NEEDS = [
    ['website', 'Website design or rebuild'],
    ['seo', 'SEO'],
    ['hosting', 'Hosting or domain help'],
    ['design', 'Graphic design / branding'],
    ['ads', 'Google Ads'],
    ['maintenance', 'Ongoing website care'],
];

export function isLddProvider(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z]/g, '')
        .includes('leannedigital');
}

export function choiceFromList(list, value) {
    const current = String(value || '').trim();
    if (!current) return { select: '', other: '' };
    if (list.includes(current)) return { select: current, other: '' };
    return { select: 'Other', other: current };
}

export function choiceToValue(select, other) {
    const picked = String(select || '').trim();
    if (picked === 'Other') return String(other || '').trim() || 'Other';
    return picked;
}

export function onboardingComplete(client) {
    return Boolean(client?.onboarding?.completedAt);
}
