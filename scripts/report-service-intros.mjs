// Project introductions shared by current and archived client reports.
const introductions = {
    'davis-window-and-door': {
        serviceTitle: 'Technical SEO/AEO and Website Maintenance',
        serviceIntro: 'We help Davis Window & Door keep its website clear, useful and easy to find through technical SEO, answer engine optimization (AEO) and ongoing maintenance. Our work supports service content, site navigation and technical improvements so customers and search tools can understand the business.'
    },
    'gbt-logistics': {
        serviceTitle: 'SEO/AEO and Technical Maintenance',
        serviceIntro: 'We help GBT organize its SEO and answer engine optimization (AEO) strategies and put technical improvements into practice. Our work keeps the website clear, relevant and easy for search engines and AI-powered search tools to understand as search continues to evolve.'
    },
    'melissa-jean-art': {
        serviceTitle: 'Website Support and Marketing Consultation',
        serviceIntro: 'We support Melissa Jean Art with marketing guidance and practical Shopify improvements that help customers explore the artwork and shop with confidence.'
    },
    'oatley-vigmond': {
        serviceTitle: 'Monthly SEO/AEO and Website Maintenance',
        serviceIntro: 'We support Oatley Vigmond with technical SEO, answer engine optimization (AEO) and website maintenance. Our work improves content structure, internal links and site reliability to help people find useful legal information and make it easier for search engines and AI-powered search tools to understand the website.'
    },
    'shift-physiotherapy': {
        serviceTitle: 'Monthly SEO/AEO',
        serviceIntro: 'We support Shift Physiotherapy & Wellness with new content, SEO and answer engine optimization (AEO) guidance, and practical technical improvements. Our work helps people find relevant treatment information and makes the website easier for visitors and search tools to navigate and understand.'
    },
    'sierra-electrical': {
        serviceTitle: 'Monthly SEO/AEO and Google Ads Management',
        serviceIntro: 'We support Sierra Electrical with new content, SEO and answer engine optimization (AEO), technical improvements and Google Ads management. Our work helps connect people searching for electrical services with relevant information, while conversion tracking helps us review how visits and ad clicks lead to inquiries.'
    }
};

export function resolveReportServiceIntro(client, report = {}) {
    const defaults = introductions[client.slug] || {};
    return {
        ...report,
        serviceTitle: report.serviceTitle || defaults.serviceTitle,
        serviceIntro: report.serviceIntro || defaults.serviceIntro
    };
}
