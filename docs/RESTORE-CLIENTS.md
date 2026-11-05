# Restore archived clients

Open **Clients → Archived clients** in the workspace sidebar, find the client, and choose **Restore client**. Confirmation returns you to the active client list. This preserves saved services, visibility and portal accounts; it does not reactivate cancelled projects or send invitations.

The staff-only `POST /api/clients/:slug/restore` endpoint clears `archivedAt`, respects existing client access controls, and safely returns `restored: false` for an already-active client. Archive and restore use JSON requests. Both portal and overlay records store the current archive status so an old overlay cannot reapply it.

Validation:

- `node tests/restore-client.test.mjs`: isolated authenticated HTTP tests, CSRF, missing clients, repeat restores, preserved services and optional deployed private-client extension.
- `node tests/restore-client-browser.mjs`: desktop/mobile search, confirmation, request format and active list after restore. Requires Playwright and a generated workspace page. Set `WORKSPACE_PLAYWRIGHT` to a Playwright module path, `WORKSPACE_CHROME` to a browser executable, and `WORKSPACE_HTML` to the generated workspace HTML when these are not available at their defaults.

Deployment must include `js/archived-clients.js` and refresh the workspace-shell cache version in generated workspace pages. The production workspace generator has local changes outside GitHub main; this branch intentionally excludes those unrelated changes. The deployed generator and pages use `workspace-shell.js?v=restore-20261105` and `workspace-admin.js?v=archive-json-20261105`.
