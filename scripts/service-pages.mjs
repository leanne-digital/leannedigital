import { SERVICE_LINKS } from './site-config.mjs';

export const SERVICE_PAGE_PATHS = [
    ...SERVICE_LINKS.map((link) => link.path),
    '/google-ads/',
];

export function slugFromServicePath(servicePath) {
    return servicePath.replace(/^\/|\/$/g, '');
}
