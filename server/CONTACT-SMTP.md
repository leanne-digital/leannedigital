# Contact form SMTP

`POST /api/contact` sends to `leanne@leannedigital.com`, Bcc
`gary@leannedigital.com`, with the validated visitor email as Reply-To.
The API returns 503 on SMTP failure; the browser requires HTTP success and
`ok: true` before clearing the form or displaying success. Submissions are
also retained in the private, Git-ignored contact inbox for staff follow-up.

Production credentials are loaded by systemd from
`/home/leannedigital.com/private/.env`, outside the website and repository.
The file must be readable only by the service account (currently root).
Never copy its password into source code or the public directory.

The `leannedigital-portal.service` drop-in `contact-smtp.conf` contains:

```ini
[Service]
EnvironmentFile=/home/leannedigital.com/private/.env
```

The private environment supplies `SMTP_HOST=leannedigital.com`,
`SMTP_PORT=587`, `SMTP_USER=noreply@leannedigital.com`,
`MAIL_FROM=noreply@leannedigital.com`, and the existing `SMTP_PASS`.
The mail transport requires STARTTLS on port 587 and validates TLS certificates.
SMTP acceptance is required for both recipients; it is not proof of inbox placement.

OpenLiteSpeed must proxy `/api/contact` to the existing
`leannedigital-mcp` backend at `127.0.0.1:4174`.
Deploy `server/contact.mjs`, `server/mail.mjs`, and `js/contact-form.js` to
the application checkout, and the JavaScript file to the public document root.
Reload systemd configuration and restart the portal after environment changes.

Run regression checks with `node --test tests/contact-mail.test.mjs`.

The contact page loads `js/contact-form.js` and uses
`data-contact-backend="smtp"` instead of Lilipadd form markers.
`scripts/lilipadd-slots.mjs` preserves this handler during site generation.
Deploy these page and generator changes with the backend files.
