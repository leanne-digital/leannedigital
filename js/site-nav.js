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
