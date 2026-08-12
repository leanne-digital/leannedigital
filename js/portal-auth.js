(function () {
    if (window.__LP_PORTAL__) return;

    if (window.__LP__ && window.__LP__.key && window.__LP__.base) {
        var script = document.createElement('script');
        script.src = window.__LP__.base + '/v1/modules/portal.js';
        script.defer = true;
        document.head.appendChild(script);
        return;
    }

    const form = document.querySelector('[data-portal-form]');
    const gated = document.body.hasAttribute('data-portal-gate');

    function show(el, message) {
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || '';
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

    async function me() {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            const type = res.headers.get('content-type') || '';
            if (!type.includes('application/json')) {
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
    }

    async function post(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Something went wrong');
        return data;
    }

    function injectBar(user) {
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
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
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

    async function bindForm() {
        const type = form.getAttribute('data-portal-form');
        const errorEl = form.querySelector('[data-portal-error]');
        const okEl = form.querySelector('[data-portal-ok]');

        if (type === 'login') {
            if (new URLSearchParams(location.search).get('reset') === '1') {
                show(okEl, 'Password updated. Log in with your new password.');
            }
            const session = await me();
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
            try {
                if (type === 'login') {
                    const data = await post('/api/auth/login', {
                        email: payload.email,
                        password: payload.password,
                    });
                    location.replace(nextPath(data.user));
                    return;
                }
                if (type === 'forgot') {
                    const data = await post('/api/auth/forgot', { email: payload.email });
                    show(okEl, data.message || 'If that email has an account, a reset link is on the way.');
                    return;
                }
                if (type === 'reset') {
                    if (payload.password !== payload.confirm) {
                        throw new Error('Passwords do not match');
                    }
                    const token = new URLSearchParams(location.search).get('token') || '';
                    await post('/api/auth/reset', { token, password: payload.password });
                    location.replace('/login/?reset=1');
                }
            } catch (error) {
                show(errorEl, error.message);
            }
        });
    }

    async function gate() {
        const session = await me();
        if (!session?.user) {
            location.replace(`/login/?next=${encodeURIComponent(location.pathname)}`);
            return;
        }
        if (session.user.role !== 'staff' && (location.pathname === '/clients/' || location.pathname === '/clients')) {
            location.replace(`/clients/${session.user.clientSlug}/`);
            return;
        }
        injectBar(session.user);
        applyRole(session.user);
    }

    if (form) bindForm();
    if (gated) gate();
})();
