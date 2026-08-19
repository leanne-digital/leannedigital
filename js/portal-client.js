(function () {
    const PLATFORM = ['WordPress', 'Wix', 'Webflow', 'Squarespace', 'Shopify', 'Showit', 'Custom / HTML', 'None yet', 'Other'];
    const DOMAIN = ['GoDaddy', 'Hover', 'Namecheap', 'Google Domains / Squarespace', 'Cloudflare', 'Network Solutions', 'Name.com', 'Leanne Digital', 'Other', 'Not sure'];
    const HOSTING = ['SiteGround', 'WP Engine', 'Kinsta', 'Cloudways', 'Bluehost', 'HostGator', 'Shopify', 'Wix', 'Squarespace', 'Webflow', 'Leanne Digital', 'Other', 'Not sure'];
    const EMAIL = ['Google Workspace', 'Microsoft 365', 'GoDaddy', 'Fastmail', 'Proton', 'iCloud', 'Leanne Digital', 'Other', 'Not sure'];
    const NEEDS = ['website', 'seo', 'hosting', 'design', 'ads', 'maintenance'];

    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function $$(sel, root) {
        return [...(root || document).querySelectorAll(sel)];
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

    function choice(list, value) {
        const current = String(value || '').trim();
        if (!current) return { select: '', other: '' };
        if (list.includes(current)) return { select: current, other: '' };
        return { select: 'Other', other: current };
    }

    function fromChoice(select, other) {
        if (select === 'Other') return String(other || '').trim() || 'Other';
        return String(select || '').trim();
    }

    function bindOther(form, name, list) {
        const select = form.elements[name];
        const wrap = form.querySelector(`[data-other-wrap="${name}"]`);
        if (!select || !wrap) return;
        const sync = () => {
            wrap.hidden = select.value !== 'Other';
        };
        select.addEventListener('change', sync);
        sync();
        return { apply(value) {
            const split = choice(list, value);
            select.value = split.select;
            const other = form.elements[`${name}Other`];
            if (other) other.value = split.other;
            sync();
        } };
    }

    function appRow(data = {}) {
        const wrap = document.createElement('div');
        wrap.className = 'dash-cred';
        wrap.innerHTML = `<input type="hidden" data-app="id" value="${escapeHtml(data.id || '')}">
            <label>Service
                <input data-app="label" type="text" value="${escapeHtml(data.label || '')}" placeholder="Mailchimp, Gravity Forms…">
            </label>
            <label>Login URL
                <input data-app="url" type="url" value="${escapeHtml(data.url || '')}" placeholder="https://">
            </label>
            <label>Username or email
                <input data-app="username" type="text" value="${escapeHtml(data.username || '')}" autocomplete="off">
            </label>
            <label>Password
                <input data-app="password" type="text" value="${escapeHtml(data.password || '')}" autocomplete="new-password">
            </label>
            <label>Notes
                <input data-app="notes" type="text" value="${escapeHtml(data.notes || '')}">
            </label>
            <button class="dash-form__remove" type="button" data-remove-app>Remove</button>`;
        return wrap;
    }

    function readApps(list) {
        return $$('.dash-cred', list)
            .map((row) => {
                const get = (key) => row.querySelector(`[data-app="${key}"]`)?.value.trim() || '';
                const label = get('label');
                const url = get('url');
                const username = get('username');
                const password = row.querySelector('[data-app="password"]')?.value || '';
                const notes = get('notes');
                if (!label && !url && !username && !password && !notes) return null;
                return { id: get('id'), label, url, username, password, notes };
            })
            .filter(Boolean);
    }

    function setApps(list, rows) {
        list.innerHTML = '';
        const items = rows && rows.length ? rows : [{}];
        for (const row of items) list.appendChild(appRow(row));
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
        if (!document.body.hasAttribute('data-portal-page')) return;
        if (user.role === 'staff') {
            location.replace('/admin/');
            return;
        }

        const errorEl = $('[data-portal-error]');
        const okEl = $('[data-portal-ok]');
        const panels = {
            password: $('[data-panel="password"]'),
            onboarding: $('[data-panel="onboarding"]'),
            home: $('[data-panel="home"]'),
        };
        const onboardForm = $('[data-onboarding-form]');
        const others = {
            platform: bindOther(onboardForm, 'platform', PLATFORM),
            domainProvider: bindOther(onboardForm, 'domainProvider', DOMAIN),
            hostingProvider: bindOther(onboardForm, 'hostingProvider', HOSTING),
            emailProvider: bindOther(onboardForm, 'emailProvider', EMAIL),
        };

        let state = { user, client: null, projects: [] };
        let editingOnboarding = false;

        function setPanel(name) {
            Object.entries(panels).forEach(([key, el]) => {
                if (el) el.hidden = key !== name;
            });
        }

        function fillOnboarding(client) {
            if (!client || !onboardForm) return;
            onboardForm.name.value = client.name || '';
            onboardForm.contactName.value = client.contactName || '';
            onboardForm.email.value = client.email || '';
            onboardForm.phone.value = client.phone || '';
            onboardForm.location.value = client.location || '';
            onboardForm.website.value = client.website || '';
            onboardForm.preferredContact.value = client.onboarding?.preferredContact || 'email';
            others.platform.apply(client.platform);
            others.domainProvider.apply(client.domainProvider);
            others.hostingProvider.apply(client.hosting?.provider);
            others.emailProvider.apply(client.emailProvider);
            const needs = new Set(client.onboarding?.servicesNeeded || []);
            for (const key of NEEDS) {
                const box = onboardForm.elements[`need-${key}`];
                if (box) box.checked = needs.has(key);
            }
            onboardForm.googleAnalytics.value = client.onboarding?.googleAnalytics || '';
            onboardForm.searchConsole.value = client.onboarding?.searchConsole || '';
            onboardForm.instagram.value = client.onboarding?.socials?.instagram || '';
            onboardForm.facebook.value = client.onboarding?.socials?.facebook || '';
            onboardForm.linkedin.value = client.onboarding?.socials?.linkedin || '';
            onboardForm.googleBusiness.value = client.onboarding?.socials?.googleBusiness || '';
            onboardForm.notes.value = client.onboarding?.notes || '';
        }

        function onboardingPayload() {
            const data = Object.fromEntries(new FormData(onboardForm).entries());
            return {
                name: data.name,
                contactName: data.contactName,
                email: data.email,
                phone: data.phone,
                location: data.location,
                website: data.website,
                platform: fromChoice(data.platform, data.platformOther),
                domainProvider: fromChoice(data.domainProvider, data.domainProviderOther),
                hostingProvider: fromChoice(data.hostingProvider, data.hostingProviderOther),
                emailProvider: fromChoice(data.emailProvider, data.emailProviderOther),
                onboarding: {
                    preferredContact: data.preferredContact,
                    googleAnalytics: data.googleAnalytics,
                    searchConsole: data.searchConsole,
                    notes: data.notes,
                    servicesNeeded: NEEDS.filter((key) => onboardForm.elements[`need-${key}`]?.checked),
                    socials: {
                        instagram: data.instagram,
                        facebook: data.facebook,
                        linkedin: data.linkedin,
                        googleBusiness: data.googleBusiness,
                    },
                },
            };
        }

        function renderHome() {
            const client = state.client || {};
            const lead = $('[data-portal-lead]');
            if (lead) {
                lead.textContent = client.onboardingComplete
                    ? 'Update your details, add tools we should know about, or open your reports.'
                    : 'Finish a few details so we can start work without chasing logins.';
            }
            const meta = $('[data-profile-meta]');
            if (meta) {
                meta.textContent = [client.contactName, client.email, client.phone].filter(Boolean).join(' · ');
            }
            const reports = $('[data-reports-link]');
            if (reports && client.slug) reports.href = `/clients/${client.slug}/`;
            const stack = $('[data-stack-list]');
            if (stack) {
                const rows = [
                    ['Business', client.name],
                    ['Platform', client.platform],
                    ['Domain', client.domainProvider],
                    ['Hosting', client.hosting?.provider],
                    ['Email', client.emailProvider],
                    ['Website', client.website],
                ];
                stack.innerHTML = rows
                    .map(
                        ([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`
                    )
                    .join('');
            }
            setApps($('[data-app-list]'), client.clientApps || []);
            renderProjects(state.projects);
            const img = $('[data-avatar-img]');
            const fallback = $('[data-avatar-fallback]');
            const avatarUrl = state.user?.avatarUrl;
            if (img && fallback) {
                if (avatarUrl) {
                    img.src = `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
                    img.hidden = false;
                    fallback.hidden = true;
                } else {
                    img.hidden = true;
                    fallback.hidden = false;
                    fallback.textContent = initials(client.contactName || client.name || state.user?.name);
                }
            }
        }

        function statusLabel(status) {
            const labels = { active: 'In progress', paused: 'Paused', completed: 'Complete', cancelled: 'Cancelled' };
            return labels[status] || status || 'In progress';
        }

        function renderProjects(projects) {
            const list = $('[data-projects-list]');
            const empty = $('[data-projects-empty]');
            if (!list) return;
            const rows = Array.isArray(projects) ? projects : [];
            if (!rows.length) {
                list.innerHTML = '';
                if (empty) empty.hidden = false;
                return;
            }
            if (empty) empty.hidden = true;
            list.innerHTML = rows
                .map((project) => {
                    const progress = Math.max(0, Math.min(100, Number(project.progress) || 0));
                    return `<article class="portal-project">
                        <div class="portal-project__head">
                            <h3>${escapeHtml(project.name)}</h3>
                            <span class="admin-pill">${escapeHtml(statusLabel(project.status))}</span>
                        </div>
                        <div class="portal-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}" aria-label="${escapeHtml(project.name)} progress">
                            <span class="portal-meter__fill" style="width:${progress}%"></span>
                        </div>
                        <p class="portal-meter__label">${progress}% · ${escapeHtml(statusLabel(project.status))}</p>
                    </article>`;
                })
                .join('');
        }

        function showWorkspace() {
            if (state.user?.mustChangePassword) {
                setPanel('password');
                const wrap = $('[data-current-wrap]');
                if (wrap) wrap.hidden = true;
                const lead = $('[data-password-lead]');
                if (lead) lead.textContent = 'This is a temporary login. Choose a password you will remember, then we will finish onboarding.';
                return;
            }
            if (!state.client?.onboardingComplete || editingOnboarding) {
                fillOnboarding(state.client);
                setPanel('onboarding');
                return;
            }
            renderHome();
            setPanel('home');
        }

        async function refresh() {
            const data = await api.portalMe();
            state = { user: data.user || state.user, client: data.client, projects: data.projects || [] };
            window.__LD_PORTAL__.user = state.user;
            showWorkspace();
        }

        try {
            await refresh();
        } catch (error) {
            show(errorEl, error.message || 'Could not load your portal.');
            return;
        }

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
            form.reset();
            show(okEl, 'Password updated.');
            editingOnboarding = false;
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

        onboardForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            show(errorEl, '');
            show(okEl, '');
            const submit = onboardForm.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                const data = await api.saveProfile(onboardingPayload());
                state.client = data.client;
                editingOnboarding = false;
                show(okEl, 'Onboarding saved. You can add extra services any time.');
                showWorkspace();
            } catch (error) {
                show(errorEl, error.message);
            } finally {
                submit.disabled = false;
            }
        });

        $('[data-apps-form]')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            show(errorEl, '');
            show(okEl, '');
            const submit = event.target.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                const data = await api.saveProfile({ clientApps: readApps($('[data-app-list]')) });
                state.client = data.client;
                setApps($('[data-app-list]'), state.client.clientApps || []);
                show(okEl, 'Services saved.');
            } catch (error) {
                show(errorEl, error.message);
            } finally {
                submit.disabled = false;
            }
        });

        $('[data-add-app]')?.addEventListener('click', () => {
            $('[data-app-list]').appendChild(appRow());
        });

        $('[data-app-list]')?.addEventListener('click', (event) => {
            if (!event.target.closest('[data-remove-app]')) return;
            event.target.closest('.dash-cred')?.remove();
            if (!$('[data-app-list] .dash-cred')) setApps($('[data-app-list]'), [{}]);
        });

        $('[data-edit-onboarding]')?.addEventListener('click', () => {
            editingOnboarding = true;
            show(okEl, '');
            showWorkspace();
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
                renderHome();
                show(okEl, 'Photo updated.');
            } catch (error) {
                show(errorEl, error.message);
            }
        });
    }

    if (window.__LD_PORTAL__) boot(window.__LD_PORTAL__);
    document.addEventListener('ld-portal-ready', (event) => boot(event.detail));
})();
