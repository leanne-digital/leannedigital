# Website editor production deployment — November 4, 2026 (EST)

Deployed with Gary's explicit approval. UTC verification completed November 5. Staff editor tools are live at the existing https://leannedigital.com/mcp endpoint. Gary and Leanne each have an explicit publisher grant for leanne-digital. No other site grants were issued. Refresh the plugin's tools and start a new chat after deployment. Actual ChatGPT UI refresh remains a user-side verification; authenticated HTTPS MCP discovery and tool calls passed for both accounts.

## Deployment and preservation

Patched the current production API/MCP files, retaining its newer client/work-log permissions, deletion/person attribution, report tracking and separately installed Google integration. Did not replace the live agency tree with the Git checkout. Added server/editor modules, dashboard assets, administration/scheduler scripts and protected legacy public generators. Upgraded dependencies using the reviewed lockfile; npm ci and npm audit passed on the actual host (Node 22.23.4). Added the Zod 4 record-key compatibility fix to the separately deployed Google schema.

The build guard now runs when a generator actually executes, not when the portal imports its reusable functions. A production-mode portal regression test covers startup. Legacy public generation is intentionally blocked once editor ownership is activated; future agency template/portfolio generation needs an explicit editor-aware migration, not a blanket generate/deploy.

Private state: /home/leannedigital.com/private/website-editor, directory mode 0700; editor.env mode 0600. Imported 58 pages from the current public document root with current public CSS/media. Both source and immutable release are retained. Baseline release e4a8e8d97a27451eb3e300a5f2f43715, revision 2. All pages passed comparison of visible main text, forms and scripts (equivalent relative script URLs normalized). No homepage wording was changed. A test changeset prepares the same H1 text for preview only; it was not applied or published.

The final LiteSpeed root context now proxies to the existing leannedigital-mcp handler. More-specific API, OAuth, client/report, private-path and ACME contexts and security headers are preserved. Existing public-file fallback uses the existing PRIVATE_CLIENT_PUBLIC_ROOT. Systemd portal drop-in 96-website-editor.conf loads the editor environment. The persistent editor scheduler timer checks every 30 seconds and is enabled at boot.

## Verification

- All 13 editor tests passed against a private copy of current production code and new dependencies.
- Offline migration of a SQLite backup preserved row counts of every existing OAuth table. Production OAuth migration completed during service startup; existing staff OAuth verification succeeded.
- Authenticated HTTPS /mcp tools/list and editor_capabilities succeeded for Gary and Leanne; editor inspect/prepare/preview/publish tools and existing Google, append and delete work-log tools were present. Read-only OAuth omitted publishing tools.
- Live editor_list_pages, editor_get_page, editor_prepare_changes and editor_preview_changes succeeded for the homepage.
- HTTPS homepage/blog/sitemap and editor OAuth discovery passed. Unauthenticated editor/API requests and private server-file requests were denied.
- Browser desktop 1440px and mobile 390px checks passed with no horizontal overflow; H1 typography remains 58px/32px. Contact action remains /api/contact. No real contact form or Slack test message was sent.
- Root-routing rollback to the original static homepage was verified byte-for-byte, then editor routing was restored. Content restore, client isolation and scheduling/restart behavior were tested privately; no synthetic client content was published to production.
- The host rebooted during verification (not requested by the deployment scripts); a browser observed a temporary 503 during startup. Portal and scheduler resumed, and browser/live HTTPS checks passed afterward.

## Backup and rollback

Private deployment bundle: /root/ld-editor-deploy-20261105. Includes original app files/dependencies, pre-change vhost and service drop-ins, consistent preflight and immediate activation OAuth backups, merged staging tree, hashes and logs. No credentials or database contents are in Git.

For routing-only rollback restore vhost.before.conf to the original vhost path, validate, then reload LiteSpeed; stop the editor scheduler/publication first. This rollback was exercised. Keep editor state and releases. A complete application rollback must coordinate service downtime and OAuth database state to avoid discarding subsequent account/token activity; do not blindly restore an old database after users reconnect.

Future client connections use the separate editor-only OAuth audience and per-site grants. Its protocol tests pass, but a real future-client ChatGPT connection has not been demonstrated. Do not claim that onboarding is complete for clients. See website-editor-connections.md for steps.
