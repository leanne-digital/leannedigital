(function () {
    var toggle = document.querySelector('.site-nav__toggle');
    var nav = document.getElementById('primary-nav');
    var menuTriggers = document.querySelectorAll('.site-nav__trigger');

    if (toggle && nav) {
        toggle.addEventListener('click', function () {
            var open = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        });
    }

    menuTriggers.forEach(function (trigger) {
        trigger.addEventListener('click', function () {
            var item = trigger.closest('.site-nav__item--has-menu');
            if (!item) return;
            var open = item.classList.toggle('is-open');
            trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    });

    document.addEventListener('click', function (event) {
        if (!event.target.closest('.site-nav__item--has-menu')) {
            document.querySelectorAll('.site-nav__item--has-menu.is-open').forEach(function (item) {
                item.classList.remove('is-open');
                var trigger = item.querySelector('.site-nav__trigger');
                if (trigger) trigger.setAttribute('aria-expanded', 'false');
            });
        }
    });
})();
