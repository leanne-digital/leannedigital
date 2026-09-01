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
                login(email, password) {
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
            login(email, password) {
                return request('/api/auth/login', {
                    method: 'POST',
                    body: { email, password },
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
            ? `<a href="/clients/">Clients</a>`
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

        if (type === 'login') {
            if (new URLSearchParams(location.search).get('reset') === '1') {
                show(okEl, 'Password updated. Log in with your new password.');
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
                    const data = await api.login(payload.email, payload.password);
                    location.replace(nextPath(data.user));
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

    const EYE_SHOW =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5c-5.2 0-9.3 3.3-11 7 1.7 3.7 5.8 7 11 7s9.3-3.3 11-7c-1.7-3.7-5.8-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5z"/></svg>';
    const EYE_HIDE =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.3 2.3 2 3.6l3.1 3.1C3.3 8.2 1.8 9.9 1 12c1.7 3.7 5.8 7 11 7 1.7 0 3.3-.3 4.7-.9l3.7 3.6 1.3-1.3L3.3 2.3zM12 17c-3.7 0-6.8-2.1-8.5-5 .6-1.1 1.6-2.2 2.8-3.1l1.8 1.8A5 5 0 0 0 12 17zm0-10c3.7 0 6.8 2.1 8.5 5-.5.9-1.2 1.8-2.1 2.6l1.5 1.5c1.3-1.1 2.3-2.5 3.1-4.1-1.7-3.7-5.8-7-11-7-1.2 0-2.4.2-3.5.5l1.7 1.7C10.7 7.1 11.3 7 12 7zm0 3a2 2 0 0 1 2 2c0 .3 0 .5-.1.7l-2.6-2.6c.2 0 .4-.1.7-.1z"/></svg>';

    function wrapPasswordInput(input) {
        if (!input || input.dataset.ldPassword === '1' || input.closest('.ld-password')) return;
        const wrap = document.createElement('div');
        wrap.className = 'ld-password';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
        input.dataset.ldPassword = '1';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ld-password__toggle';
        btn.setAttribute('aria-label', 'Show password');
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = EYE_SHOW;
        btn.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.setAttribute('aria-pressed', show ? 'true' : 'false');
            btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
            btn.innerHTML = show ? EYE_HIDE : EYE_SHOW;
        });
        wrap.appendChild(btn);
    }

    function enhancePasswordFields(root) {
        (root || document).querySelectorAll('input[type="password"]').forEach(wrapPasswordInput);
        if (root && root.matches?.('input[type="password"]')) wrapPasswordInput(root);
    }

    function watchPasswordFields() {
        enhancePasswordFields(document);
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    enhancePasswordFields(node);
                }
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    async function boot() {
        watchPasswordFields();
        const local = await localApiAlive();
        const useLilipadd = !local && (validLilipadd() || (await waitForLilipadd(2500)));
        const api = createApi(useLilipadd ? 'lilipadd' : 'local');
        if (form) bindForm(api);
        if (gated) gate(api);
    }

    boot();
})();
