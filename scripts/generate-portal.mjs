import {
    escapeHtml,
    renderFullFooter,
    renderHead,
    renderNav,
} from './layout.mjs';
import {
    CONTACT_METHODS,
    DOMAIN_PROVIDERS,
    EMAIL_PROVIDERS,
    HOSTING_PROVIDERS,
    PLATFORM_OPTIONS,
    SERVICE_NEEDS,
} from './portal-options.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROBOTS = 'noindex, nofollow';
const SCRIPT_V = '20260819a';

function writePage(relativeDir, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function optionList(values) {
    return ['<option value="">Select</option>']
        .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
        .join('');
}

export function generateClientPortalPage() {
    const platformOpts = optionList(PLATFORM_OPTIONS);
    const domainOpts = optionList(DOMAIN_PROVIDERS);
    const hostingOpts = optionList(HOSTING_PROVIDERS);
    const emailOpts = optionList(EMAIL_PROVIDERS);
    const contactOpts = CONTACT_METHODS.map(
        ([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
    ).join('');
    const needChecks = SERVICE_NEEDS.map(
        ([value, label]) => `                        <label class="portal-check">
                            <input type="checkbox" name="need-${escapeHtml(value)}" value="${escapeHtml(value)}">
                            <span>${escapeHtml(label)}</span>
                        </label>`
    ).join('\n');

    const html = `${renderHead({
        title: 'Client Portal | Leanne Digital',
        description: 'Your Leanne Digital account, onboarding details, and project files.',
        depth: 1,
        extraCss: ['login.css', 'clients.css', 'portal.css'],
        robots: ROBOTS,
        canonical: 'https://leannedigital.com/client-portal/',
        path: '/client-portal/',
    })}
<body class="page-inner" data-portal-gate data-portal-page="client">
${renderNav(1, '/client-portal/')}
    <main id="main">
        <section class="portal-page section--navy">
            <div class="container portal-page__wrap">
                <header class="portal-hero">
                    <p class="portal-hero__eyebrow">Client portal</p>
                    <h1 class="portal-hero__title">Your workspace</h1>
                    <p class="portal-hero__lead" data-portal-lead>Log in to finish onboarding, update your details, and open your reports.</p>
                </header>
                <p class="login-form__error" data-portal-error hidden></p>
                <p class="login-form__ok" data-portal-ok hidden></p>

                <section class="portal-panel" data-panel="password" hidden>
                    <div class="login-card portal-card">
                        <h2 class="login-card__title">Choose a password</h2>
                        <p class="login-card__lead" data-password-lead>Pick a password you will remember. Use at least 8 characters.</p>
                        <form class="login-form" data-password-form>
                            <div class="login-form__field" data-current-wrap>
                                <label for="current-password">Current password</label>
                                <input id="current-password" name="currentPassword" type="password" autocomplete="current-password">
                            </div>
                            <div class="login-form__field">
                                <label for="new-password">New password</label>
                                <input id="new-password" name="password" type="password" autocomplete="new-password" minlength="8" required>
                            </div>
                            <div class="login-form__field">
                                <label for="confirm-password">Confirm password</label>
                                <input id="confirm-password" name="confirm" type="password" autocomplete="new-password" minlength="8" required>
                            </div>
                            <button class="ld-btn" type="submit">Save password</button>
                        </form>
                    </div>
                </section>

                <section class="portal-panel" data-panel="onboarding" hidden>
                    <form class="dash-form portal-form" data-onboarding-form>
                        <h2 class="dash-form__heading">Onboarding</h2>
                        <p class="dash-copy dash-copy--left">Tell us how to reach you and which tools you already use. We only need the provider names here — not the passwords.</p>
                        <h3 class="dash-form__heading">Business</h3>
                        <div class="dash-form__grid">
                            <label>Business name
                                <input name="name" type="text" required autocomplete="organization">
                            </label>
                            <label>Your name
                                <input name="contactName" type="text" required autocomplete="name">
                            </label>
                            <label>Email
                                <input name="email" type="email" required autocomplete="email">
                            </label>
                            <label>Cellphone
                                <input name="phone" type="tel" required autocomplete="tel">
                            </label>
                            <label>City / location
                                <input name="location" type="text" autocomplete="address-level2">
                            </label>
                            <label>Current website
                                <input name="website" type="url" placeholder="https://">
                            </label>
                            <label>Preferred contact
                                <select name="preferredContact">${contactOpts}</select>
                            </label>
                            <label>Website platform
                                <select name="platform">${platformOpts}</select>
                            </label>
                            <label data-other-wrap="platform" hidden>Platform (other)
                                <input name="platformOther" type="text" placeholder="What do you use?">
                            </label>
                            <label>Domain provider
                                <select name="domainProvider">${domainOpts}</select>
                            </label>
                            <label data-other-wrap="domainProvider" hidden>Domain provider (other)
                                <input name="domainProviderOther" type="text">
                            </label>
                            <label>Hosting provider
                                <select name="hostingProvider">${hostingOpts}</select>
                            </label>
                            <label data-other-wrap="hostingProvider" hidden>Hosting provider (other)
                                <input name="hostingProviderOther" type="text">
                            </label>
                            <label>Email provider
                                <select name="emailProvider">${emailOpts}</select>
                            </label>
                            <label data-other-wrap="emailProvider" hidden>Email provider (other)
                                <input name="emailProviderOther" type="text">
                            </label>
                        </div>
                        <h3 class="dash-form__heading">What you need help with</h3>
                        <div class="portal-checks">
${needChecks}
                        </div>
                        <h3 class="dash-form__heading">Analytics &amp; social</h3>
                        <div class="dash-form__grid">
                            <label>Google Analytics
                                <select name="googleAnalytics">
                                    <option value="">Not sure</option>
                                    <option value="yes">Yes, we have it</option>
                                    <option value="no">No</option>
                                    <option value="help">Need help setting it up</option>
                                </select>
                            </label>
                            <label>Google Search Console
                                <select name="searchConsole">
                                    <option value="">Not sure</option>
                                    <option value="yes">Yes, we have it</option>
                                    <option value="no">No</option>
                                    <option value="help">Need help setting it up</option>
                                </select>
                            </label>
                            <label>Instagram
                                <input name="instagram" type="url" placeholder="https://">
                            </label>
                            <label>Facebook
                                <input name="facebook" type="url" placeholder="https://">
                            </label>
                            <label>LinkedIn
                                <input name="linkedin" type="url" placeholder="https://">
                            </label>
                            <label>Google Business Profile
                                <input name="googleBusiness" type="url" placeholder="https://">
                            </label>
                        </div>
                        <label>Anything else we should know
                            <textarea name="notes" rows="4" placeholder="Goals, deadlines, brand files, or tools you already pay for."></textarea>
                        </label>
                        <div class="dash-form__actions">
                            <button class="ld-btn" type="submit">Save onboarding</button>
                        </div>
                    </form>
                </section>

                <section class="portal-panel portal-home" data-panel="home" hidden>
                    <div class="portal-home__grid">
                        <article class="portal-card portal-card--profile">
                            <h2 class="dash-form__heading">Profile</h2>
                            <form class="portal-avatar" data-avatar-form>
                                <div class="portal-avatar__preview">
                                    <img alt="" data-avatar-img hidden>
                                    <span data-avatar-fallback>LD</span>
                                </div>
                                <div>
                                    <p class="dash-copy dash-copy--left">Add a photo for your account. Square JPG or PNG, under 400 KB.</p>
                                    <label class="portal-avatar__pick">
                                        <span>Upload photo</span>
                                        <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
                                    </label>
                                </div>
                            </form>
                            <p class="portal-profile__meta" data-profile-meta></p>
                            <p><a class="ld-btn ld-btn--ghost" data-reports-link href="/clients/">Open reports</a></p>
                        </article>
                        <article class="portal-card">
                            <h2 class="dash-form__heading">Your stack</h2>
                            <dl class="portal-stack" data-stack-list></dl>
                            <p><button class="dash-form__add" type="button" data-edit-onboarding>Edit details</button></p>
                        </article>
                    </div>
                    <form class="dash-form portal-form" data-apps-form>
                        <h2 class="dash-form__heading">Other services</h2>
                        <p class="dash-copy dash-copy--left">Add logins for Mailchimp, plugins, or anything else we may need to manage. Skip the password if you would rather send it another way.</p>
                        <div class="dash-creds" data-app-list></div>
                        <p><button class="dash-form__add" type="button" data-add-app>Add a service</button></p>
                        <div class="dash-form__actions">
                            <button class="ld-btn" type="submit">Save services</button>
                        </div>
                    </form>
                    <form class="dash-form portal-form" data-account-password-form>
                        <h2 class="dash-form__heading">Password</h2>
                        <div class="dash-form__grid">
                            <label>Current password
                                <input name="currentPassword" type="password" autocomplete="current-password" required>
                            </label>
                            <label>New password
                                <input name="password" type="password" autocomplete="new-password" minlength="8" required>
                            </label>
                            <label>Confirm password
                                <input name="confirm" type="password" autocomplete="new-password" minlength="8" required>
                            </label>
                        </div>
                        <div class="dash-form__actions">
                            <button class="ld-btn" type="submit">Update password</button>
                        </div>
                    </form>
                </section>
            </div>
        </section>
    </main>
${renderFullFooter(1)}
    <script src="../js/site-nav.js" defer></script>
    <script src="../js/portal-auth.js?v=${SCRIPT_V}" defer></script>
    <script src="../js/portal-client.js?v=${SCRIPT_V}" defer></script>
</body>
</html>
`;
    writePage('client-portal', html);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    generateClientPortalPage();
    console.log('Generated client portal page.');
}
