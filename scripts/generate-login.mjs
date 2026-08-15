import {
    escapeHtml,
    renderFullFooter,
    renderHead,
    renderNav,
    renderPageScripts,
} from './layout.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROBOTS = 'noindex, nofollow';

function writePage(relativeDir, html) {
    const dir = path.join(ROOT, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function scripts(depth) {
    const prefix = '../'.repeat(depth);
    return `    <script src="${prefix}js/site-nav.js" defer></script>
    <script src="${prefix}js/portal-auth.js?v=20260815a" defer></script>`;
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
            lead: 'Use the email and password we sent you to open your reports, retainer, and files.',
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
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    generateLoginPages();
    console.log('Generated login, forgot password, and reset pages.');
}
