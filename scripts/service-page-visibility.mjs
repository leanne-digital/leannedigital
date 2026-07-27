import { assetPrefix, escapeHtml } from './layout.mjs';

export const VISIBILITY_CALENDLY_URL =
    'https://calendly.com/leannedigitaldesign/free-website-strategy-call?primary_color=4ec3cc';

const REVIEW_ITEMS = [
    {
        title: 'Your First Impression',
        text: 'We’ll look at your website through the eyes of a potential customer and identify what’s working and what might be causing visitors to leave.',
        icon: 'eye',
    },
    {
        title: 'Your Messaging',
        text: 'Does your website clearly explain who you help, what you do, and why someone should choose you? We’ll identify opportunities to strengthen your messaging and connect with your audience more effectively.',
        icon: 'message',
    },
    {
        title: 'Your Visibility',
        text: 'We’ll review how easily potential customers can find you online and discuss opportunities to improve your visibility through SEO and other digital marketing strategies.',
        icon: 'visibility',
    },
    {
        title: 'Your User Experience',
        text: 'We’ll look at how easy it is for visitors to navigate your website, find information, and take action.',
        icon: 'user',
    },
    {
        title: 'Your Calls to Action',
        text: 'Does your website clearly guide visitors toward the next step? We’ll review your contact forms, buttons, and conversion opportunities.',
        icon: 'action',
    },
];

const WALKAWAY_ITEMS = [
    'Actionable recommendations you can implement immediately',
    'A better understanding of what’s helping or hurting your online visibility',
    'Insights into how your website is perceived by potential customers',
    'Ideas for improving your messaging and customer experience',
    'A clearer path forward for growing your online presence',
];

const AUDIENCE_ITEMS = [
    'Have a website but aren’t getting the results they expected',
    'Want more inquiries, leads, or sales',
    'Feel their website no longer reflects their business',
    'Want to improve their visibility online',
    'Are unsure where to focus their marketing efforts',
];

function renderIcon(name) {
    const icons = {
        eye: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
        message: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4V6a2 2 0 0 1 2-2zm2 4v2h10V8H7zm0 4v2h7v-2H7z"/></svg>',
        visibility: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 6a9.77 9.77 0 0 1 8.94 6A9.77 9.77 0 0 1 12 18a9.77 9.77 0 0 1-8.94-6A9.77 9.77 0 0 1 12 6m0-2C6.27 4 1.73 7.11 0 12c1.73 4.89 6.27 8 12 8s10.27-3.11 12-8c-1.73-4.89-6.27-8-12-8zm0 5a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/><path fill="currentColor" d="M3 3l18 18-1.4 1.4L1.6 4.4z" opacity=".9"/></svg>',
        user: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"/></svg>',
        action: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"/></svg>',
    };

    return icons[name] || icons.action;
}

function renderCalendlyWidget(className) {
    return `<div
                        class="calendly-inline-widget ${className}"
                        data-url="${VISIBILITY_CALENDLY_URL}"
                        style="min-width:320px;height:700px;"
                    ></div>`;
}

function renderReviewCards() {
    const cards = REVIEW_ITEMS.map(
        (item) => `                    <article class="service-card">
                        <div class="service-card__icon">${renderIcon(item.icon)}</div>
                        <h3 class="service-card__title">${escapeHtml(item.title)}</h3>
                        <p class="service-card__text">${escapeHtml(item.text)}</p>
                    </article>`
    ).join('\n');

    return `        <section class="service-section section--navy" aria-labelledby="review-heading">
            <div class="container">
                <div class="service-section__panel">
                    <h2 class="service-section__heading" id="review-heading">What We'll Review</h2>
                    <div class="service-cards">
${cards}
                    </div>
                </div>
            </div>
        </section>`;
}

function renderWalkAway(prefix) {
    const items = WALKAWAY_ITEMS.map((item) => `                            <li>${escapeHtml(item)}</li>`).join(
        '\n'
    );

    return `        <section class="service-section section--navy service-section--alt" aria-labelledby="walkaway-heading">
            <div class="container">
                <div class="service-split">
                    <div class="service-split__content">
                        <h2 class="service-section__heading" id="walkaway-heading">What You'll Walk Away With</h2>
                        <ul class="service-checklist">
${items}
                        </ul>
                    </div>
                    <div class="service-split__media">
                        <img src="${prefix}assets/images/services/leanne-working.png" alt="Leanne Jones working on WordPress website design in Winnipeg" width="639" height="520" loading="lazy">
                    </div>
                </div>
            </div>
        </section>`;
}

function renderAudience(prefix) {
    const items = AUDIENCE_ITEMS.map((item) => `                            <li>${escapeHtml(item)}</li>`).join(
        '\n'
    );

    return `        <section class="service-section section--navy" aria-labelledby="audience-heading">
            <div class="container">
                <div class="service-split service-split--media-first">
                    <div class="service-split__media">
                        <img src="${prefix}assets/images/services/Website-Design-Audit.png" alt="Website design audit illustration" width="632" height="738" loading="lazy">
                    </div>
                    <div class="service-split__content">
                        <h2 class="service-section__heading" id="audience-heading">Who This Is For</h2>
                        <p>This strategy session is ideal for business owners who:</p>
                        <ul class="service-split__list">
${items}
                        </ul>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderBookingLead() {
    return `        <section class="service-section section--navy service-section--alt service-booking" aria-labelledby="book-heading">
            <div class="container">
                <div class="service-split service-booking__split">
                    <div class="service-split__content service-booking__copy">
                        <h2 class="service-section__heading service-section__heading--book" id="book-heading">Book Your Complimentary Strategy Session</h2>
                        <p class="service-booking__lead">Let’s take a fresh look at your website and uncover opportunities to improve your visibility, strengthen your connection with your audience, and help your business stand out online.</p>
                    </div>
                    <div class="service-split__media service-booking__media">
                        ${renderCalendlyWidget('service-booking__widget')}
                    </div>
                </div>
            </div>
        </section>`;
}

export function renderVisibilityStrategyHero(page) {
    return `        <section class="service-hero section--navy service-hero--visibility" aria-labelledby="service-heading">
            <div class="container service-hero__grid">
                <div class="service-hero__content">
                    <h1 class="service-hero__title" id="service-heading">${escapeHtml(page.hero.title)}</h1>
                    <div class="service-hero__lead">${page.hero.lead}</div>
                </div>
                <div class="service-hero__media service-hero__booking" id="book">
                    ${renderCalendlyWidget('service-hero__calendly')}
                </div>
            </div>
        </section>`;
}

export function renderVisibilityStrategyBody(depth) {
    const prefix = assetPrefix(depth);

    return [renderReviewCards(), renderWalkAway(prefix), renderAudience(prefix), renderBookingLead()].join('\n');
}

export function renderVisibilityStrategyScripts() {
    return '    <script src="https://assets.calendly.com/assets/external/widget.js" async></script>';
}
