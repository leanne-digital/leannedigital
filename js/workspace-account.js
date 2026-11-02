
// Shared public-site account navigation. Session state stays on the server.
(function () {
    const header = document.querySelector('.topbar');
    if (!header || header.querySelector('.site-account')) return;
    const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '/css/account-nav.css?v=account-20261102'; document.head.append(stylesheet);
    const icons = {
        person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
        workspace: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        home: '<path d="M3 11l9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
        logout: '<path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h12"/>'
    };
    const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
    const wrap = document.createElement('div'); wrap.className = 'site-account';
    const trigger = document.createElement('a'); trigger.className = 'site-account__trigger'; trigger.setAttribute('aria-controls', 'site-account-menu'); trigger.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div'); menu.id = 'site-account-menu'; menu.className = 'site-account__menu'; menu.hidden = true;
    wrap.append(trigger, menu); header.append(wrap);
    let user = null, timer;
    function open(value) { menu.hidden = !value; trigger.setAttribute('aria-expanded', String(value)); }
    function row(label, href, glyph) { const a = document.createElement('a'); a.href = href; a.innerHTML = icon(glyph); a.append(document.createTextNode(label)); menu.append(a); return a; }
    function paint(current) {
        user = current; menu.replaceChildren(); trigger.innerHTML = icon('person');
        const workspace = user?.role === 'staff' ? '/clients/' : user?.clientSlug ? `/clients/${encodeURIComponent(user.clientSlug)}/` : '/client-portal/';
        trigger.href = user ? workspace : '/login/?next=%2Fclients%2F';
        trigger.setAttribute('aria-label', user ? 'Your account — open client workspace' : 'Login');
        trigger.title = user ? 'Your account' : 'Login';
        if (user?.avatarUrl) {
            const url = new URL(user.avatarUrl, location.origin);
            if ((url.origin === location.origin || url.origin === 'https://gravatar.com')) { const image = document.createElement('img'); image.src = url.href; image.alt = ''; image.addEventListener('error',()=>{trigger.innerHTML=icon('person');}); trigger.replaceChildren(image); }
        }
        if (!user) { row('Login', trigger.href, 'person'); return; }
        row('Bio', '/profile/', 'person'); row('Client workspace', workspace, 'workspace'); const mainSite=row('Go to main site', '/', 'home');
        mainSite.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();location.assign('/?workspaceVisit='+Date.now());});
        const logout = document.createElement('button'); logout.type = 'button'; logout.innerHTML = icon('logout'); logout.append(document.createTextNode('Logout')); menu.append(logout);
        logout.addEventListener('click', async () => {
            logout.disabled = true;
            try {
                const response = await fetch('/api/auth/logout', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
                if (!response.ok) throw Error('Logout failed');
                location.assign('/login/');
            } catch { logout.lastChild.textContent = 'Retry logout'; logout.disabled = false; }
        });
    }
    paint(null);
    wrap.addEventListener('mouseenter', () => { clearTimeout(timer); open(true); });
    wrap.addEventListener('mouseleave', () => { timer=setTimeout(()=>open(false),150); });
    wrap.addEventListener('focusin', () => open(true));
    wrap.addEventListener('focusout', event => { if (!wrap.contains(event.relatedTarget)) open(false); });
    trigger.addEventListener('click', event => {
        if (event.pointerType === 'touch' && !wrap.dataset.tapped) { event.preventDefault(); wrap.dataset.tapped='1';open(true); }
    });
    document.addEventListener('pointerdown', event => { if(!wrap.contains(event.target)){open(false);delete wrap.dataset.tapped;} });
    wrap.addEventListener('keydown', event => {
        if(event.key==='Escape'){trigger.focus();open(false);delete wrap.dataset.tapped;}
        if(event.key==='ArrowDown' && event.target===trigger){event.preventDefault();open(true);menu.querySelector('a,button')?.focus();}
    });
    document.addEventListener('ld-portal-ready',event=>paint(event.detail.user));
    fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>paint(data?.user || null)).catch(()=>{});
})();
