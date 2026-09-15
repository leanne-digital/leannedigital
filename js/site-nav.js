(function () {
    var toggle = document.querySelector('.site-nav__toggle');
    var nav = document.getElementById('primary-nav');
    var menuTriggers = document.querySelectorAll('.site-nav__trigger');
    var menuItems = document.querySelectorAll('.site-nav__item--has-menu');
    var desktopNav = window.matchMedia('(min-width: 961px)');

    if (toggle && nav) {
        toggle.addEventListener('click', function () {
            var open = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        });
    }

    menuTriggers.forEach(function (trigger) {
        trigger.addEventListener('click', function () {
            if (desktopNav.matches) return;

            var item = trigger.closest('.site-nav__item--has-menu');
            if (!item) return;
            var open = item.classList.toggle('is-open');
            trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    });

    menuItems.forEach(function (item) {
        var closeTimer;

        item.addEventListener('mouseenter', function () {
            if (!desktopNav.matches) return;
            clearTimeout(closeTimer);
            item.classList.add('is-hover-open');
            var trigger = item.querySelector('.site-nav__trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'true');
        });

        item.addEventListener('mouseleave', function () {
            if (!desktopNav.matches) return;
            closeTimer = setTimeout(function () {
                item.classList.remove('is-hover-open');
                var trigger = item.querySelector('.site-nav__trigger');
                if (trigger) trigger.setAttribute('aria-expanded', 'false');
            }, 180);
        });
    });

    document.addEventListener('click', function (event) {
        if (!event.target.closest('.site-nav__item--has-menu')) {
            document.querySelectorAll('.site-nav__item--has-menu.is-open, .site-nav__item--has-menu.is-hover-open').forEach(function (item) {
                item.classList.remove('is-open');
                item.classList.remove('is-hover-open');
                var trigger = item.querySelector('.site-nav__trigger');
                if (trigger) trigger.setAttribute('aria-expanded', 'false');
            });
        }
    });
})();

// Shared by every page; also enhances fields inserted after page load.
(function () {
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
        btn.title = 'Show password';
        btn.className = 'ld-password__toggle';
        btn.setAttribute('aria-label', 'Show password');
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = EYE_SHOW;
        btn.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.setAttribute('aria-pressed', show ? 'true' : 'false');
            btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
            btn.title = show ? 'Hide password' : 'Show password';
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

    watchPasswordFields();
})();
