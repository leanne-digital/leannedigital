export const PORTFOLIO_FILTERS = [
    {
        id: 'web_design',
        label: 'Web Design',
        options: [
            { value: 'web_design-ecommerce', label: 'Ecommerce' },
            { value: 'web_design-full-custom', label: 'Full Custom' },
            { value: 'web_design-one-page', label: 'One Page' },
        ],
    },
    {
        id: 'graphic_design',
        label: 'Graphic Design',
        options: [
            { value: 'graphic_design-branding', label: 'Branding' },
            { value: 'graphic_design-indigenous-design', label: 'Indigenous Design' },
            { value: 'graphic_design-logo-design', label: 'Logo Design' },
            { value: 'graphic_design-poster-design', label: 'Poster Design' },
            { value: 'graphic_design-slidedecks', label: 'Slidedecks' },
            { value: 'graphic_design-social-media', label: 'Social Media' },
        ],
    },
    {
        id: 'industry',
        label: 'Industry',
        options: [
            { value: 'industry-dating', label: 'Dating' },
            { value: 'industry-events-services', label: 'Events Services' },
            { value: 'industry-financial', label: 'Financial' },
            { value: 'industry-health-wellness', label: 'Health & Wellness' },
            { value: 'industry-hvac', label: 'HVAC' },
            { value: 'industry-indigenous', label: 'Indigenous' },
            { value: 'industry-landscaping', label: 'Landscaping' },
            { value: 'industry-law', label: 'Law' },
            { value: 'industry-luxury', label: 'Luxury' },
            { value: 'industry-moving', label: 'Moving' },
            { value: 'industry-real-estate-development', label: 'Real Estate & Development' },
            { value: 'industry-trades', label: 'Trades' },
            { value: 'industry-transport', label: 'Transport' },
            { value: 'industry-transportation-logistics', label: 'Transportation & Logistics' },
        ],
    },
    {
        id: 'seo',
        label: 'SEO',
        options: [
            { value: 'seo-do-it-for-you', label: 'Do It For You' },
            { value: 'seo-do-it-with-you', label: 'Do It With You' },
        ],
    },
];

export const FILTER_LABELS = Object.fromEntries(
    PORTFOLIO_FILTERS.flatMap((group) => group.options.map((option) => [option.value, option.label]))
);

export function tagsToLabelLine(tags) {
    return tags.map((tag) => FILTER_LABELS[tag] || tag).join(' | ');
}
