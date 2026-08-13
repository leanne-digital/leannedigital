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
        if (user?.role === 'client' && user.clientSlug) {
            const own = `/clients/${user.clientSlug}`;
            if (!safe || safe === '/clients/' || safe === '/clients' || !safe.startsWith(`${own}/`) && safe !== own) {
                return `${own}/`;
            }
            return safe.endsWith('/') || safe.includes('.') ? safe : `${safe}/`;
        }
        return safe || '/clients/';
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

    async function request(url, { method = 'GET', body, action } = {}) {
        let res;
        try {
            res = await fetch(url, {
                method,
                credentials: 'include',
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
            });
        } catch {
            throw new Error('We could not reach the login service. Check your connection and try again.');
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
        const dashboard =
            user.role === 'staff'
                ? '<a href="/clients/">Dashboard</a>'
                : user.clientSlug
                    ? `<a href="/clients/${user.clientSlug}/">Your portal</a>`
                    : '';
        bar.innerHTML = `${dashboard}<span class="portal-bar__email"></span><button type="button">Log out</button>`;
        bar.querySelector('.portal-bar__email').textContent = user.email;
        bar.querySelector('button').addEventListener('click', async () => {
            await api.logout();
            location.replace('/login/');
        });
        document.body.prepend(bar);
    }

    function applyRole(user) {
        if (user.role === 'staff') return;
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
        if (session.user.role !== 'staff' && (location.pathname === '/clients/' || location.pathname === '/clients')) {
            location.replace(`/clients/${session.user.clientSlug}/`);
            return;
        }
        injectBar(api, session.user);
        applyRole(session.user);
    }

    async function boot() {
        const local = await localApiAlive();
        const useLilipadd = !local && (validLilipadd() || (await waitForLilipadd(2500)));
        const api = createApi(useLilipadd ? 'lilipadd' : 'local');
        if (form) bindForm(api);
        if (gated) gate(api);
    }

    boot();
})();
