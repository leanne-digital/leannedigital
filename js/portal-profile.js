(function () {
    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function show(el, message) {
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || '';
    }

    function initials(name) {
        const parts = String(name || 'LD').trim().split(/\s+/).slice(0, 2);
        return parts.map((part) => part[0] || '').join('').toUpperCase() || 'LD';
    }

    async function readImage(file) {
        if (!file || !file.type.startsWith('image/')) throw new Error('Choose a JPG, PNG, WebP, or GIF.');
        if (file.size > 400 * 1024) throw new Error('Keep the image under 400 KB.');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Could not read that image.'));
            reader.readAsDataURL(file);
        });
    }

    async function boot({ api, user }) {
        if (document.body.getAttribute('data-portal-page') !== 'profile') return;

        const errorEl = $('[data-portal-error]');
        const okEl = $('[data-portal-ok]');
        const panels = {
            password: $('[data-panel="password"]'),
            home: $('[data-panel="home"]'),
        };
        let state = { user };

        function setPanel(name) {
            Object.entries(panels).forEach(([key, el]) => {
                if (el) el.hidden = key !== name;
            });
        }

        function paint() {
            const current = state.user || {};
            const form = $('[data-profile-form]');
            if (form) {
                form.name.value = current.name || '';
                form.email.value = current.email || '';
            }
            const meta = $('[data-profile-meta]');
            if (meta) meta.textContent = [current.name, current.email].filter(Boolean).join(' · ');
            const roleNote = $('[data-role-note]');
            if (roleNote) {
                if (current.role === 'staff') {
                    roleNote.textContent =
                        current.privilege === 'admin'
                            ? 'You are an admin. You can manage clients from the dashboard.'
                            : 'You are a super admin. You can invite other admins and create client workspaces.';
                } else {
                    roleNote.textContent = 'This is your login. Business details live in your client portal.';
                }
            }
            const clientLink = $('[data-client-portal-link]');
            const adminLink = $('[data-admin-link]');
            if (clientLink) clientLink.hidden = current.role !== 'client';
            if (adminLink) adminLink.hidden = current.role !== 'staff';
            const img = $('[data-avatar-img]');
            const fallback = $('[data-avatar-fallback]');
            if (img && fallback) {
                if (current.avatarUrl) {
                    img.src = `${current.avatarUrl}${current.avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
                    img.hidden = false;
                    fallback.hidden = true;
                } else {
                    img.hidden = true;
                    fallback.hidden = false;
                    fallback.textContent = initials(current.name || current.email);
                }
            }
        }

        function showWorkspace() {
            if (state.user?.mustChangePassword) {
                setPanel('password');
                return;
            }
            paint();
            setPanel('home');
        }

        showWorkspace();

        async function submitPassword(form, requireCurrent) {
            show(errorEl, '');
            show(okEl, '');
            const payload = Object.fromEntries(new FormData(form).entries());
            if (payload.password !== payload.confirm) throw new Error('The two passwords do not match.');
            if (requireCurrent && !payload.currentPassword) throw new Error('Enter your current password.');
            const data = await api.changePassword({
                currentPassword: payload.currentPassword,
                password: payload.password,
            });
            state.user = data.user;
            window.__LD_PORTAL__.user = state.user;
            form.reset();
            show(okEl, 'Password updated.');
            showWorkspace();
        }

        $('[data-password-form]')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submit = event.target.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                await submitPassword(event.target, false);
            } catch (error) {
                show(errorEl, error.message);
            } finally {
                submit.disabled = false;
            }
        });

        $('[data-account-password-form]')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submit = event.target.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                await submitPassword(event.target, true);
            } catch (error) {
                show(errorEl, error.message);
            } finally {
                submit.disabled = false;
            }
        });

        $('[data-profile-form]')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            show(errorEl, '');
            show(okEl, '');
            const submit = event.target.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                const data = await api.saveProfile({ name: event.target.name.value });
                state.user = data.user || state.user;
                if (data.user) window.__LD_PORTAL__.user = data.user;
                paint();
                show(okEl, 'Profile saved.');
            } catch (error) {
                show(errorEl, error.message);
            } finally {
                submit.disabled = false;
            }
        });

        $('[data-avatar-form] input[name="avatar"]')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            show(errorEl, '');
            show(okEl, '');
            try {
                const image = await readImage(file);
                const data = await api.saveAvatar(image);
                state.user = data.user;
                window.__LD_PORTAL__.user = data.user;
                paint();
                show(okEl, 'Photo updated.');
            } catch (error) {
                show(errorEl, error.message);
            }
        });
    }

    if (window.__LD_PORTAL__) boot(window.__LD_PORTAL__);
    document.addEventListener('ld-portal-ready', (event) => boot(event.detail));
})();
