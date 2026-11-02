export const CLIENT_SERVICE_TAGS = ['website', 'maintenance', 'aeo', 'geo', 'technical-seo', 'content', 'ads', 'design', 'hosting', 'management', 'updates', 'integrations', 'automations', 'seo', 'development', 'graphic-design', 'google-ads', 'project-management'];

export function normalizeServiceTags(value) {
    if (!Array.isArray(value) || value.some(type => typeof type !== 'string' || !CLIENT_SERVICE_TAGS.includes(type))) {
        throw Object.assign(new Error('Choose valid client services'), {status: 400});
    }
    return [...new Set(value)];
}
