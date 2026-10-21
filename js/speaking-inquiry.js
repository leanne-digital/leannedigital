(function () {
    // The shared contact handler accepts name, email, companyName, service and message.
    // Service is fixed to "Speaking Engagements"; fold the event details into the
    // message before contact-form.js reads it.
    const form = document.getElementById('speaking-inquiry-form');
    if (!form) return;

    const fields = [
        ['event_date', 'Event date'],
        ['event_location', 'Location'],
    ];

    function compose() {
        const data = new FormData(form);
        const lines = [`Event type: ${String(data.get('event_type') || '').trim() || '(not selected)'}`];
        fields.forEach(([name, label]) => {
            const value = String(data.get(name) || '').trim();
            if (value) lines.push(`${label}: ${value}`);
        });
        const details = String(data.get('details') || '').trim();
        lines.push('', details || '(no additional details)');
        form.querySelector('input[name="message"]').value = lines.join('\n');
    }

    // Capture phase on document runs before the form's own submit listeners.
    document.addEventListener('submit', (event) => {
        if (event.target === form) compose();
    }, true);
})();
