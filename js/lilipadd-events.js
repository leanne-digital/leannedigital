/** Conversion helpers for Lilipadd snippet (requires snippet.js on the page). */
document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || !form.classList || !form.classList.contains('contact-form')) return;
    if (typeof window.lp === 'function') {
        window.lp('conversion', 'contact_form_submit', { path: location.pathname });
    }
});
