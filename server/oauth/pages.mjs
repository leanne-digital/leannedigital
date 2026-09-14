function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function layout({ title, body }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: Georgia, "Times New Roman", serif; margin: 0; background: #f6f1ea; color: #241c16; }
    main { max-width: 32rem; margin: 4rem auto; padding: 2rem; background: #fff; border: 1px solid #e4d9cc; }
    h1 { font-size: 1.45rem; margin: 0 0 0.5rem; }
    p, li { line-height: 1.5; }
    label { display: block; margin: 0.85rem 0 0.3rem; font-size: 0.95rem; }
    input[type=email], input[type=password] { width: 100%; box-sizing: border-box; padding: 0.6rem 0.7rem; border: 1px solid #cbbba8; font: inherit; }
    .actions { display: flex; gap: 0.75rem; margin-top: 1.4rem; }
    button { font: inherit; padding: 0.55rem 1rem; cursor: pointer; border: 1px solid #241c16; }
    button.allow { background: #241c16; color: #fff; }
    button.cancel { background: #fff; }
    .error { color: #8a1f11; background: #f8e8e4; padding: 0.6rem 0.75rem; margin-bottom: 1rem; }
    .muted { color: #6b5e52; font-size: 0.92rem; }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

export function loginPageHtml({ error = '', csrfToken, returnQuery = '', googleEnabled = false }) {
    return layout({
        title: 'Sign in to authorize Leanne Digital MCP',
        body: `
    <h1>Leanne Digital MCP</h1>
    <p class="muted">Verify with Google to connect. Access is restricted to Gary and Leanne's Leanne Digital accounts.</p>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
    ${googleEnabled ? `<form method="post" action="/oauth/login">
      <input type="hidden" name="csrf" value="${escapeHtml(csrfToken)}">
      <input type="hidden" name="return_query" value="${escapeHtml(returnQuery)}">
      <button type="submit" name="provider" value="google">Sign in with Google</button>
    </form>
    <script>const form=document.querySelector('form');form.requestSubmit(form.querySelector('button'));</script>` : '<p class="error">Google sign-in is not configured. Contact the site administrator.</p>'}`,
    });
}

export function consentPageHtml({ error = '', csrfToken, clientName, scopes, oauthQuery = '' }) {
    const scopeList = (scopes || [])
        .map((scope) => {
            if (scope === 'mcp:read') return 'Read Leanne Digital agency data (clients, projects, revenue, leads, and related records)';
            if (scope === 'offline_access') return 'Stay connected until access is revoked (refresh token)';
            if (scope === 'mcp:credentials:write') return 'Add, update or delete client login credentials in the private admin record. Saved passwords are never returned.';
            if (scope === 'mcp:write') return 'Create, update and delete agency client records, services, projects, proposals and reports';
            return escapeHtml(scope);
        })
        .map((text) => `<li>${text}</li>`)
        .join('');

    return layout({
        title: 'Authorize Leanne Digital MCP',
        body: `
    <h1>Authorize Leanne Digital MCP</h1>
    <p><strong>${escapeHtml(clientName || 'Leanne Digital MCP')}</strong> is requesting the following access to Leanne Digital agency data.</p>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
    <ul>${scopeList}</ul>
    <p class="muted">This is agency-wide staff data. Client portal users cannot approve this request.</p>
    <form method="post" action="/oauth/consent">
      <input type="hidden" name="csrf" value="${escapeHtml(csrfToken)}">
      <input type="hidden" name="oauth_query" value="${escapeHtml(oauthQuery)}">
      <div class="actions">
        <button class="allow" type="submit" name="decision" value="allow">Allow</button>
        <button class="cancel" type="submit" name="decision" value="cancel">Cancel</button>
      </div>
    </form>`,
    });
}

export function oauthErrorPageHtml(message) {
    return layout({
        title: 'Authorization error',
        body: `<h1>Authorization could not continue</h1><p class="error">${escapeHtml(message)}</p>`,
    });
}
