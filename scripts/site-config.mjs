import { loadEnv } from './load-env.mjs';

loadEnv();

/** Public site origin — used for canonical URLs and Lilipadd tenant site_url. */
export const SITE_URL = 'https://leannedigital.com';

/** Lilipadd loader. Placeholders stay for publish; these fallbacks are used if deploy copies source as-is. */
export const LILIPADD = {
    snippetUrl:
        process.env.LILIPADD_SNIPPET_URL || 'https://api.lilipadd.com/v1/snippet.js',
    platformUrl:
        process.env.LILIPADD_PLATFORM_URL || 'https://app.lilipadd.com/v1/platform.js',
    // Public site key (same value that belongs in the HTML data-key attribute).
    siteKey:
        process.env.LILIPADD_SITE_KEY ||
        'lp_638916a39896504d0e9da82ff8976dee0edb4a1721805587',
};

/** Site pages and navigation — source of truth for static page generation. */

export const SERVICE_LINKS = [
    { path: '/free-website-visibility-strategy-session/', title: 'Free Website Visibility Strategy Session' },
    { path: '/website-design/', title: 'Website Design' },
    { path: '/website-management-support/', title: 'Website Management & Support' },
    { path: '/seo/', title: 'SEO' },
    { path: '/answer-engine-optimization-aeo/', title: 'Answer Engine Optimization (AEO)' },
    { path: '/graphic-design/', title: 'Graphic Design' },
    { path: '/winnipeg-logo-design/', title: 'Winnipeg Logo Design' },
    { path: '/indigenous-graphic-design/', title: 'Indigenous Graphic Design' },
    { path: '/indigenous-web-design/', title: 'Indigenous Web Design' },
];

export const PRIMARY_NAV = [
    { path: '/about/', title: 'About' },
    { path: '/portfolio/', title: 'Portfolio' },
    { type: 'services', title: 'Services', children: SERVICE_LINKS },
    { path: '/blog/', title: 'Blog' },
    { path: '/contact/', title: 'Contact' },
];

/** Paths with hand-built static pages — skipped by generate-pages.mjs */
export const BUILT_PAGES = new Set([
    '/about/',
    '/contact/',
    '/blog/',
    '/portfolio/',
    ...SERVICE_LINKS.map((link) => link.path),
    '/google-ads/',
    '/clients/',
    '/login/',
    '/login/forgot/',
    '/login/reset/',
    '/admin/',
    '/client-portal/',
]);

/** WordPress pages from Simply Static export (excluding homepage). */
export const COMING_SOON_PAGES = [
    { path: '/about/', title: 'About', description: 'Meet the Leanne Digital team in Winnipeg.' },
    { path: '/portfolio/', title: 'Portfolio', description: 'Recent website, brand, and marketing work.' },
    { path: '/blog/', title: 'Blog', description: 'Tips on web design, SEO, and digital marketing.' },
    { path: '/contact/', title: 'Contact', description: 'Get in touch with Leanne Digital.' },
    { path: '/website-design/', title: 'Website Design', description: 'Custom WordPress websites for Winnipeg businesses.' },
    { path: '/website-management-support/', title: 'Website Management & Support', description: 'Ongoing website care and support plans.' },
    { path: '/seo/', title: 'SEO Services', description: 'Search engine optimization for local growth.' },
    { path: '/graphic-design/', title: 'Graphic Design', description: 'Branding, logos, and marketing materials.' },
    { path: '/winnipeg-logo-design/', title: 'Winnipeg Logo Design', description: 'Logo design for Winnipeg brands.' },
    { path: '/indigenous-graphic-design/', title: 'Indigenous Graphic Design', description: 'Indigenous-led graphic design services.' },
    { path: '/indigenous-web-design/', title: 'Indigenous Web Design', description: 'Indigenous-led website design services.' },
    { path: '/free-website-visibility-strategy-session/', title: 'Free Website Visibility Strategy Session', description: 'Book a free visibility strategy session.' },
    { path: '/answer-engine-optimization-aeo/', title: 'Answer Engine Optimization (AEO)', description: 'Get found in AI search and answer engines.' },
    { path: '/google-ads/', title: 'Google Ads', description: 'Paid search campaigns that drive leads.' },
    { path: '/privacy-policy/', title: 'Privacy Policy', description: 'How Leanne Digital handles your information.' },
    { path: '/sitemap/', title: 'Sitemap', description: 'Browse all pages and posts on leannedigital.com.' },
    { path: '/client-portal/', title: 'Client Portal', description: 'Client resources and project access.' },
    { path: '/project-tracker/', title: 'Project Tracker', description: 'Track your project with Leanne Digital.' },
    { path: '/ldd-chat/', title: 'LDD Chat', description: 'Leanne Digital chat support.' },
    { path: '/seo-workshop/', title: 'SEO Workshop', description: 'SEO training and workshops.' },
    { path: '/newsletter/', title: 'Newsletter', description: 'Subscribe to Leanne Digital updates.' },
    { path: '/seo-workshop-thank-you/', title: 'SEO Workshop Thank You', description: 'Thanks for registering.' },
    { path: '/ld-hosting/', title: 'LD Hosting', description: 'Hosting services from Leanne Digital.' },
];
