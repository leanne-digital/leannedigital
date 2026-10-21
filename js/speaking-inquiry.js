(function () {
    // The shared contact handler only sends name, email, service and message.
    // Fold the event details into the message before contact-form.js reads it.
    const form = document.getElementById('speaking-inquiry-form');
    if (!form) return;

    const fields = [
        ['organization', 'Organization'],
        ['event_date', 'Event date'],
        ['event_location', 'Location'],
    ];

    function compose() {
        const data = new FormData(form);
        const lines = [`Speaking inquiry: ${String(data.get('service') || '').trim() || '(event type not selected)'}`];
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
