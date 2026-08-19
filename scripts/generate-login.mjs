import {
    escapeHtml,
    renderFullFooter,
    renderHead,
    renderNav,
} from './layout.mjs';
import { generateClientPortalPage } from './generate-portal.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROBOTS = 'noindex, nofollow';
const SCRIPT_V = '20260819h';

function writePage(relativeDir, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function scripts(depth) {
    const prefix = '../'.repeat(depth);
    return `    <script src="${prefix}js/site-nav.js" defer></script>
    <script src="${prefix}js/portal-auth.js?v=${SCRIPT_V}" defer></script>`;
}

function authPage({ title, description, depth, path: currentPath, heading, lead, form, links }) {
    return `${renderHead({
        title: `${title} | Leanne Digital`,
        description,
        depth,
        extraCss: ['login.css'],
        robots: ROBOTS,
        canonical: `https://leannedigital.com${currentPath}`,
        path: currentPath,
    })}
<body class="page-inner">
${renderNav(depth, currentPath)}
    <main id="main">
        <section class="login-page section--navy">
            <div class="container login-page__wrap">
                <div class="login-card">
                    <h1 class="login-card__title">${escapeHtml(heading)}</h1>
                    <p class="login-card__lead">${escapeHtml(lead)}</p>
                    ${form}
                    ${links}
                </div>
            </div>
        </section>
    </main>
${renderFullFooter(depth)}
${scripts(depth)}
</body>
</html>
`;
}

function loginForm() {
    return `                    <form class="login-form" data-portal-form="login" method="post" action="/api/auth/login">
                        <p class="login-form__error" data-portal-error hidden></p>
                        <p class="login-form__ok" data-portal-ok hidden></p>
                        <div class="login-form__field">
                            <label for="email">Email</label>
                            <input id="email" name="email" type="email" autocomplete="username" required>
                        </div>
                        <div class="login-form__field">
                            <label for="password">Password</label>
                            <input id="password" name="password" type="password" autocomplete="current-password" required>
                        </div>
                        <button class="ld-btn" type="submit">Log in</button>
                    </form>`;
}

function forgotForm() {
    return `<form class="login-form" data-portal-form="forgot" method="post" action="/api/auth/forgot">
                        <p class="login-form__error" data-portal-error hidden></p>
                        <p class="login-form__ok" data-portal-ok hidden></p>
                        <div class="login-form__field">
                            <label for="email">Email</label>
                            <input id="email" name="email" type="email" autocomplete="email" required>
                        </div>
                        <button class="ld-btn" type="submit">Send reset link</button>
                    </form>`;
}

function resetForm() {
    return `<form class="login-form" data-portal-form="reset" method="post" action="/api/auth/reset">
                        <p class="login-form__error" data-portal-error hidden></p>
                        <div class="login-form__field">
                            <label for="password">New password</label>
                            <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
                        </div>
                        <div class="login-form__field">
                            <label for="confirm">Confirm password</label>
                            <input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required>
                        </div>
                        <button class="ld-btn" type="submit">Save new password</button>
                    </form>`;
}

function links(items) {
    return `<p class="login-card__links">${items
        .map((item) => `<a href="${item.href}">${escapeHtml(item.label)}</a>`)
        .join(' · ')}</p>`;
}

export function generateLoginPages() {
    writePage(
        'login',
        authPage({
            title: 'Client login',
            description: 'Log in to the Leanne Digital client portal.',
            depth: 1,
            path: '/login/',
            heading: 'Client login',
            lead: 'Use the login we emailed you. If this is your first visit, choose a password from that message first.',
            form: loginForm(),
            links: links([{ href: '/login/forgot/', label: 'Forgot password' }]),
        })
    );
    writePage(
        path.join('login', 'forgot'),
        authPage({
            title: 'Forgot password',
            description: 'Reset your Leanne Digital client portal password.',
            depth: 2,
            path: '/login/forgot/',
            heading: 'Forgot password',
            lead: 'Enter the email on your account and we will send a reset link.',
            form: forgotForm(),
            links: links([{ href: '/login/', label: 'Back to login' }]),
        })
    );
    writePage(
        path.join('login', 'reset'),
        authPage({
            title: 'Reset password',
            description: 'Choose a new password for the Leanne Digital client portal.',
            depth: 2,
            path: '/login/reset/',
            heading: 'Reset password',
            lead: 'Choose a new password with at least 8 characters.',
            form: resetForm(),
            links: links([{ href: '/login/', label: 'Back to login' }]),
        })
    );
    generateClientPortalPage();
    generateProfilePage();
}

export function generateProfilePage() {
    const html = `${renderHead({
        title: 'Your profile | Leanne Digital',
        description: 'Update your Leanne Digital account, photo, and password.',
        depth: 1,
        extraCss: ['login.css', 'clients.css', 'portal.css'],
        robots: ROBOTS,
        canonical: 'https://leannedigital.com/profile/',
        path: '/profile/',
    })}
<body class="page-inner" data-portal-gate data-portal-page="profile">
${renderNav(1, '/profile/')}
    <main id="main">
        <section class="portal-page section--navy">
            <div class="container portal-page__wrap">
                <header class="portal-hero">
                    <p class="portal-hero__eyebrow">Account</p>
                    <h1 class="portal-hero__title">Your profile</h1>
                    <p class="portal-hero__lead" data-profile-lead>Change your photo, name, and password.</p>
                </header>
                <p class="login-form__error" data-portal-error hidden></p>
                <p class="login-form__ok" data-portal-ok hidden></p>

                <section class="portal-panel" data-panel="password" hidden>
                    <div class="login-card portal-card">
                        <h2 class="login-card__title">Choose a password</h2>
                        <p class="login-card__lead">This is a temporary login. Pick a password you will remember, at least 8 characters.</p>
                        <form class="login-form" data-password-form>
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

                <section class="portal-panel portal-home" data-panel="home" hidden>
                    <article class="portal-card portal-card--profile">
                        <h2 class="dash-form__heading">Photo</h2>
                        <form class="portal-avatar" data-avatar-form>
                            <div class="portal-avatar__preview">
                                <img alt="" data-avatar-img hidden>
                                <span data-avatar-fallback>LD</span>
                            </div>
                            <div>
                                <p class="dash-copy dash-copy--left">Square JPG or PNG, under 400 KB.</p>
                                <label class="portal-avatar__pick">
                                    <span>Upload photo</span>
                                    <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
                                </label>
                            </div>
                        </form>
                        <p class="portal-profile__meta" data-profile-meta></p>
                    </article>
                    <form class="dash-form portal-form" data-profile-form>
                        <h2 class="dash-form__heading">Details</h2>
                        <div class="dash-form__grid">
                            <label>Name
                                <input name="name" type="text" autocomplete="name" required>
                            </label>
                            <label>Email
                                <input name="email" type="email" autocomplete="email" readonly>
                            </label>
                        </div>
                        <p class="dash-copy dash-copy--left" data-role-note></p>
                        <div class="dash-form__actions">
                            <button class="ld-btn" type="submit">Save profile</button>
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
                    <p data-client-portal-link hidden><a class="ld-btn ld-btn--ghost" href="/client-portal/">Open your client portal</a></p>
                    <p data-admin-link hidden><a class="ld-btn ld-btn--ghost" href="/admin/">Back to dashboard</a></p>
                </section>
            </div>
        </section>
    </main>
${renderFullFooter(1)}
    <script src="../js/site-nav.js" defer></script>
    <script src="../js/portal-auth.js?v=${SCRIPT_V}" defer></script>
    <script src="../js/portal-profile.js?v=${SCRIPT_V}" defer></script>
</body>
</html>
`;
    writePage('profile', html);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    generateLoginPages();
    console.log('Generated login, forgot password, reset, client portal, and profile pages.');
}
