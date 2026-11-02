(function () {
    if (window.__LP_PORTAL__) return;
    window.__LP_PORTAL__ = true;

    const TOKEN_KEY = 'lp_portal_token';
    const form = document.querySelector('[data-portal-form]');
    const gated = document.body.hasAttribute('data-portal-gate');

    function show(el, message) {
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || '';
    }

    function validLilipadd() {
        const lp = window.__LP__;
        return Boolean(lp && lp.base && typeof lp.key === 'string' && lp.key.indexOf('lp_') === 0);
    }

    function hasPlatformLoader() {
        return Boolean(
            document.querySelector(
                'script[src*="platform.js"], script[src*="snippet.js"], script[data-key]'
            )
        );
    }

    function waitForLilipadd(ms) {
        if (validLilipadd()) return Promise.resolve(true);
        if (!hasPlatformLoader()) return Promise.resolve(false);
        return new Promise((resolve) => {
            const started = Date.now();
            const timer = setInterval(() => {
                if (validLilipadd()) {
                    clearInterval(timer);
                    resolve(true);
                    return;
                }
                if (Date.now() - started > ms) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 50);
        });
    }

    function getToken() {
        try {
            return localStorage.getItem(TOKEN_KEY) || '';
        } catch {
            return '';
        }
    }

    function setToken(token) {
        try {
            if (token) localStorage.setItem(TOKEN_KEY, token);
            else localStorage.removeItem(TOKEN_KEY);
        } catch {
            /* storage blocked */
        }
    }

    function nextPath(user) {
        const next = new URLSearchParams(location.search).get('next');
        const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '';
        if (user?.mustChangePassword) {
            return user.role === 'staff' ? '/profile/' : '/client-portal/';
        }
        if (user?.role === 'client' && user.clientSlug) {
            const own = `/clients/${user.clientSlug}`;
            if (!safe || safe === '/clients/' || safe === '/clients' || safe.startsWith('/admin')) {
                return `${own}/`;
            }
            if (safe === '/client-portal' || safe.startsWith('/client-portal/')) return '/client-portal/';
            if (!safe.startsWith(`${own}/`) && safe !== own) return '/client-portal/';
            return safe.endsWith('/') || safe.includes('.') ? safe : `${safe}/`;
        }
        return safe || '/admin/';
    }

    function isJsonResponse(res) {
        return (res.headers.get('content-type') || '').includes('application/json');
    }

    function messageFor(res, data, action) {
        if (data && data.error) {
            if (data.error === 'Invalid email or password' || data.error === 'Unauthorized' || data.error === 'Not signed in') {
                return 'That email or password did not match. Check both and try again, or reset your password.';
            }
            if (data.error === 'Portal is not enabled' || data.error === 'Invalid site key') {
                return 'The client portal is not available right now. Please try again shortly.';
            }
            return data.error;
        }
        if (res.status === 401) {
            return 'That email or password did not match. Check both and try again, or reset your password.';
        }
        if (res.status === 429) {
            return action === 'forgot'
                ? 'Too many reset requests. Wait a minute and try again.'
                : 'Too many login attempts. Wait a minute and try again.';
        }
        if (res.status === 404 || res.status === 405 || !isJsonResponse(res)) {
            if (action === 'forgot') return 'We could not send a reset email right now. Please try again shortly.';
            if (action === 'reset') return 'We could not update your password right now. Please try again shortly.';
            return 'We could not log you in. The portal service is not reachable right now. Please try again shortly.';
        }
        if (res.status >= 500) {
            return 'The login service had a problem. Please try again in a moment.';
        }
        return 'Login did not work. Please try again.';
    }

    function isCrossOrigin(url) {
        return /^https?:/i.test(url) && !url.startsWith(location.origin);
    }

    async function request(url, { method = 'GET', body, action } = {}) {
        let res;
        try {
            res = await fetch(url, {
                method,
                credentials: isCrossOrigin(url) ? 'omit' : 'include',
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
            });
        } catch {
            throw new Error(
                isCrossOrigin(url)
                    ? 'The portal server blocked this login request. Please try again shortly.'
                    : 'We could not reach the login service. Check your connection and try again.'
            );
        }
        const data = isJsonResponse(res) ? await res.json().catch(() => ({})) : {};
        if (!res.ok) throw new Error(messageFor(res, data, action));
        return data;
    }

    function createApi(mode) {
        if (mode === 'lilipadd') {
            const endpoint = `${window.__LP__.base}/api/public/v1/portal/`;
            const withKey = (body) => ({
                key: window.__LP__.key,
                token: getToken(),
                ...body,
            });
            return {
                async me() {
                    if (!getToken()) return null;
                    try {
                        const data = await request(`${endpoint}me`, {
                            method: 'POST',
                            body: withKey({}),
                            action: 'me',
                        });
                        return data?.user ? data : null;
                    } catch {
                        setToken('');
                        return null;
                    }
                },
                login(email, password, enrollMfa = false) {
                    return request(`${endpoint}login`, {
                        method: 'POST',
                        body: withKey({ email, password }),
                        action: 'login',
                    }).then((data) => {
                        setToken(data.token || '');
                        return data;
                    });
                },
                forgot(email) {
                    return request(`${endpoint}forgot`, {
                        method: 'POST',
                        body: withKey({ email }),
                        action: 'forgot',
                    });
                },
                reset(token, password) {
                    return request(`${endpoint}reset`, {
                        method: 'POST',
                        body: withKey({ resetToken: token, token, password }),
                        action: 'reset',
                    });
                },
                async logout() {
                    try {
                        await request(`${endpoint}logout`, {
                            method: 'POST',
                            body: withKey({}),
                            action: 'logout',
                        });
                    } catch {
                        /* still clear local session */
                    }
                    setToken('');
                },
                portalMe() {
                    return Promise.reject(new Error('This client portal needs the Leanne Digital login service.'));
                },
                getClient() {
                    return Promise.reject(new Error('This client portal needs the Leanne Digital login service.'));
                },
                saveProfile() {
                    return Promise.reject(new Error('This client portal needs the Leanne Digital login service.'));
                },
                changePassword() {
                    return Promise.reject(new Error('This client portal needs the Leanne Digital login service.'));
                },
                saveAvatar() {
                    return Promise.reject(new Error('This client portal needs the Leanne Digital login service.'));
                },
                inviteClient() {
                    return Promise.reject(new Error('Invites need the Leanne Digital login service.'));
                },
                clients(op, extra) {
                    return request(`${endpoint}clients`, {
                        method: 'POST',
                        body: withKey({ op, ...(extra || {}) }),
                        action: 'clients',
                    });
                },
            };
        }

        return {
            async me() {
                try {
                    const res = await fetch('/api/auth/me', { credentials: 'include' });
                    if (!isJsonResponse(res)) {
                        if (location.port === '4173') {
                            location.replace(`http://127.0.0.1:4174${location.pathname}${location.search}`);
                            return null;
                        }
                        return null;
                    }
                    if (!res.ok) return null;
                    return res.json();
                } catch {
                    return null;
                }
            },
            login(email, password, enrollMfa = false) {
                return request('/api/auth/login', {
                    method: 'POST',
                    body: { email, password, enrollMfa },
                    action: 'login',
                });
            },
            forgot(email) {
                return request('/api/auth/forgot', {
                    method: 'POST',
                    body: { email },
                    action: 'forgot',
                });
            },
            reset(token, password) {
                return request('/api/auth/reset', {
                    method: 'POST',
                    body: { token, password },
                    action: 'reset',
                });
            },
            async logout() {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            },
            portalMe() {
                return request('/api/portal/me', { action: 'me' });
            },
            getClient(slug) {
                return request(`/api/clients/${encodeURIComponent(slug)}`, { action: 'clients' });
            },
            getSystemRecord(slug) {
                return request(`/api/clients/${encodeURIComponent(slug)}/system-record`, {action:'clients'});
            },
            saveSystemRecord(slug, fields) {
                return request(`/api/clients/${encodeURIComponent(slug)}/system-record`, {method:'PATCH',body:{fields},action:'clients'});
            },
            getSeoReport(slug, reportSlug) {
                return request(
                    `/api/clients/${encodeURIComponent(slug)}/reports/${encodeURIComponent(reportSlug)}`,
                    { action: 'clients' }
                );
            },
            saveSeoReport(slug, body) {
                return request(`/api/clients/${encodeURIComponent(slug)}/reports`, {
                    method: 'POST',
                    body,
                    action: 'clients',
                });
            },
            listSeoReports(slug) {
                return request(`/api/clients/${encodeURIComponent(slug)}/reports`, { action: 'clients' });
            },
            saveProfile(body) {
                return request('/api/portal/profile', {
                    method: 'PATCH',
                    body,
                    action: 'profile',
                });
            },
            changePassword(body) {
                return request('/api/auth/password', {
                    method: 'POST',
                    body,
                    action: 'reset',
                });
            },
            saveAvatar(image) {
                return request('/api/portal/avatar', {
                    method: 'POST',
                    body: { image },
                    action: 'profile',
                });
            },
            inviteClient(slug) {
                return request(`/api/clients/${encodeURIComponent(slug)}/invite`, {
                    method: 'POST',
                    body: {},
                    action: 'clients',
                });
            },
            async clients(op, extra) {
                extra = extra || {};
                if (op === 'list' || op === 'seed') {
                    return request('/api/clients', { method: 'GET', action: 'clients' });
                }
                if (op === 'create') {
                    return request('/api/clients', {
                        method: 'POST',
                        body: extra,
                        action: 'clients',
                    });
                }
                const slug = extra.slug || extra.id;
                if (op === 'update') {
                    return request(`/api/clients/${encodeURIComponent(slug)}`, {
                        method: 'PATCH',
                        body: extra,
                        action: 'clients',
                    });
                }
                if (op === 'delete') {
                    return request(`/api/clients/${encodeURIComponent(slug)}`, {
                        method: 'DELETE',
                        action: 'clients',
                    });
                }
                throw new Error('Unknown client operation');
            },
        };
    }

    async function localApiAlive() {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            return isJsonResponse(res);
        } catch {
            return false;
        }
    }

    function injectBar(api, user) {
        if (document.querySelector('.portal-bar')) return;
        const bar = document.createElement('div');
        bar.className = 'portal-bar';
        bar.setAttribute('role', 'navigation');
        bar.setAttribute('aria-label', 'Account');
        const dashboardHref = user.role === 'staff' || !user.clientSlug
            ? '/admin/'
            : '/client-portal/';
        const dashboardLabel = user.role === 'staff' || !user.clientSlug ? 'Dashboard' : 'Your portal';
        const extra = user.role === 'staff'
            ? `<a href="/clients/">Clients</a><a href="/hosting/">Hosting &amp; renewals</a>`
            : user.clientSlug
              ? `<a href="/clients/${user.clientSlug}/">Your account</a>`
              : '';
        const avatar = user.avatarUrl
            ? `<img class="portal-bar__avatar" src="${user.avatarUrl}" alt="">`
            : '';
        bar.innerHTML = `${avatar}<a class="portal-bar__dash" href="${dashboardHref}">${dashboardLabel}</a>${extra}<a class="portal-bar__profile" href="/profile/">Profile</a><a class="portal-bar__email" href="/profile/"></a><button type="button">Log out</button>`;
        bar.querySelector('.portal-bar__email').textContent = user.email;
        bar.querySelector('button').addEventListener('click', async () => {
            await api.logout();
            location.replace('/login/');
        });
        document.body.prepend(bar);
        document.documentElement.classList.add('has-portal-bar');
    }

    function applyRole(user) {
        if (user.role === 'staff') {
            document.querySelectorAll('[data-client-only]').forEach((el) => el.remove());
            return;
        }
        document.querySelectorAll('[data-admin-only]').forEach((el) => el.remove());
        const pageSlug = document.body.getAttribute('data-client-slug');
        if (pageSlug && user.clientSlug && pageSlug !== user.clientSlug) {
            location.replace(`/clients/${user.clientSlug}/`);
        }
    }

    async function bindForm(api) {
        const type = form.getAttribute('data-portal-form');
        const errorEl = form.querySelector('[data-portal-error]');
        const okEl = form.querySelector('[data-portal-ok]');
        let mfaChallenge = '';
        let completedUser = null;

        function handleLoginResult(data) {
            const submit = form.querySelector('button[type="submit"]');
                    if (data.mfaRequired) {
                        mfaChallenge = data.challenge;
                        form.querySelectorAll('.login-form__field').forEach(el => el.remove());
                        const field = document.createElement('div');
                        field.className = 'login-form__field';
                        const instructions = document.createElement('p');
                        instructions.textContent = data.setupRequired
                            ? 'Set up two-step verification. In your authenticator app, add an account using the setup key below (time-based), then enter its six-digit code. Keep this key private.'
                            : 'Enter the code from your authenticator app, or one of your saved recovery codes.';
                        field.append(instructions);
                        if (data.secret) {
                            const key = document.createElement('code'); key.textContent = data.secret;
                            key.style.cssText = 'display:block;overflow-wrap:anywhere;user-select:all;margin:16px 0'; field.append(key);
                        }
                        const label = document.createElement('label'); label.htmlFor = 'mfa-code'; label.textContent = 'Verification code';
                        const input = document.createElement('input'); input.id = 'mfa-code'; input.name = 'code'; input.autocomplete = 'one-time-code'; input.required = true; input.maxLength = 40;
                        const restart = document.createElement('a'); restart.href = '/login/'; restart.textContent = 'Start over';
                        field.append(label, input, restart); submit.before(field); submit.textContent = 'Verify and log in'; input.focus();
                        return;
                    }
                    if (data.recoveryCodes) {
                        completedUser = data.user;
                        form.querySelectorAll('.login-form__field').forEach(el => el.remove());
                        const box = document.createElement('div'); box.className = 'login-form__field';
                        const title = document.createElement('p'); title.textContent = 'Two-step verification is enabled. Save these recovery codes in your password manager before continuing. Each code works once if you lose your authenticator.';
                        const codes = document.createElement('pre'); codes.textContent = data.recoveryCodes.join('\n'); codes.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;user-select:all';
                        box.append(title, codes); submit.before(box); submit.textContent = 'I saved my codes — Continue';
                        return;
                    }
                    location.replace(nextPath(data.user));
        }

        if (type === 'login') {
            const option = document.createElement('label'); option.className = 'login-form__field';
            option.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:14px';
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = 'enrollMfa'; checkbox.style.cssText = 'width:18px;height:18px;flex:none';
            option.append(checkbox, document.createTextNode('Set up optional two-step verification (staff)'));
            form.querySelector('button[type="submit"]').before(option);
            if (new URLSearchParams(location.search).get('reset') === '1') {
                show(okEl, 'Password updated. Log in with your new password.');
            }
            const google = document.createElement('button'); google.type = 'button'; google.className = 'google-signin-icon';
            google.setAttribute('aria-label', 'Sign in with Google'); google.title = 'Sign in with Google';
            google.innerHTML = '<svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.84 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
            google.style.cssText = 'display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin:12px auto 0;padding:10px;border:1px solid #dadce0;border-radius:4px;background:#fff;cursor:pointer';
            google.hidden = true; form.append(google);
            request('/api/auth/google/status').then(data => { google.hidden = !data.enabled; }).catch(() => {});
            google.addEventListener('click', async () => {
                google.disabled = true; show(errorEl, '');
                try { const data = await request('/api/auth/google/start', {method:'POST',body:{},action:'login'}); location.assign(data.url); }
                catch (error) { show(errorEl,error.message); google.disabled = false; }
            });
            const googleState = new URLSearchParams(location.search).get('google');
            if (googleState === 'error') show(errorEl, 'Google sign-in was not completed or that account is not approved. Try again or use your email and password.');
            if (googleState === 'complete') {
                history.replaceState(null, '', '/login/');
                try { const data = await request('/api/auth/google/complete', {method:'POST',body:{},action:'login'}); handleLoginResult(data); }
                catch (error) { show(errorEl,error.message); }
            }
            const session = await api.me();
            if (session?.user) {
                location.replace(nextPath(session.user));
                return;
            }
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            show(errorEl, '');
            show(okEl, '');
            const payload = Object.fromEntries(new FormData(form).entries());
            const submit = form.querySelector('button[type="submit"]');
            if (submit) submit.disabled = true;
            try {
                if (type === 'login') {
                    if (completedUser) { location.replace(nextPath(completedUser)); return; }
                    const data = mfaChallenge
                        ? await request('/api/auth/mfa', { method: 'POST', body: { challenge: mfaChallenge, code: payload.code }, action: 'login' })
                        : await api.login(payload.email, payload.password, payload.enrollMfa === 'on');
                    handleLoginResult(data);
                    return;
                }
                if (type === 'forgot') {
                    const data = await api.forgot(payload.email);
                    show(okEl, data.message || 'If that email has an account, a reset link is on the way.');
                    return;
                }
                if (type === 'reset') {
                    if (payload.password !== payload.confirm) {
                        throw new Error('The two passwords do not match.');
                    }
                    const token = new URLSearchParams(location.search).get('token') || '';
                    if (!token) {
                        throw new Error('This reset link is missing or expired. Request a new one.');
                    }
                    await api.reset(token, payload.password);
                    location.replace('/login/?reset=1');
                }
            } catch (error) {
                show(errorEl, error.message);
            } finally {
                if (submit) submit.disabled = false;
            }
        });
    }

    async function gate(api) {
        const session = await api.me();
        if (!session?.user) {
            location.replace(`/login/?next=${encodeURIComponent(location.pathname)}`);
            return;
        }
        if (
            session.user.role !== 'staff' &&
            (location.pathname === '/clients/' ||
                location.pathname === '/clients' ||
                location.pathname === '/hosting/' ||
                location.pathname === '/hosting' ||
                location.pathname === '/seo-clients/' ||
                location.pathname === '/seo-clients' ||
                location.pathname === '/technical-seo/' ||
                location.pathname === '/technical-seo' ||
                location.pathname === '/maintenance/' ||
                location.pathname === '/maintenance' ||
                location.pathname === '/site-management/' ||
                location.pathname === '/site-management' ||
                location.pathname === '/project-management/' ||
                location.pathname === '/project-management' ||
                location.pathname === '/admin/' ||
                location.pathname === '/admin')
        ) {
            location.replace(session.user.clientSlug ? `/clients/${session.user.clientSlug}/` : '/client-portal/');
            return;
        }
        injectBar(api, session.user);
        applyRole(session.user);
        window.__LD_PORTAL__ = { api, user: session.user };
        document.dispatchEvent(new CustomEvent('ld-portal-ready', { detail: window.__LD_PORTAL__ }));
    }

    async function boot() {
        const local = await localApiAlive();
        const useLilipadd = !local && (validLilipadd() || (await waitForLilipadd(2500)));
        const api = createApi(useLilipadd ? 'lilipadd' : 'local');
        if (form) bindForm(api);
        if (gated) gate(api);
        else if (document.body.hasAttribute('data-client-hub')) api.me().then(session => {
            if (!session?.user) return;
            injectBar(api,session.user);
            window.__LD_PORTAL__={api,user:session.user};
            document.dispatchEvent(new CustomEvent('ld-portal-ready',{detail:window.__LD_PORTAL__}));
        });
    }

    boot();
})();
