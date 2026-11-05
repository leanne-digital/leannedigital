> Production update: staff editor deployed and HTTPS-verified. See [deployment record](website-editor-deployment-2026-11-04.md). Earlier not-deployed statements below are historical.

> Git continuation: see [current preparation status](website-editor-git-preparation.md). Historical SSH/19-file bundle guidance below is not the current deployment artifact.

# Production preparation, November 4, 2026

Status: implemented and verified privately; **not approved or deployed**. Client OAuth has passed a complete protocol test, but **a real ChatGPT client connection has not yet been verified**. Do not describe ChatGPT client connectivity as complete. SSH started refusing connections after the live API/MCP files and hosting configuration were inspected; final Linux/server integration checks remain blocked.

## Exact proposed hosting changes

Observed: LiteSpeed serves `/home/leannedigital.com/public_html`; the existing `leannedigital-mcp` proxy targets `127.0.0.1:4174`. The Node service runs `/opt/sites/leannedigital/server/api.mjs` under Node 22.23.4. Existing contexts proxy `/mcp`, OAuth/discovery, APIs, client pages/reports, private paths and Google Platforms. Preserve them.

Change only the final `context /` from static to proxy using the existing handler. Keep its security headers. Keep the ACME context and all more-specific existing contexts. The editor adapter handles its published routes, redirects, sitemap and referenced media/CSS first; the existing portal handler retains APIs, access controls, reports and public-file fallback. `PRIVATE_CLIENT_PUBLIC_ROOT` is already configured to the live document root. Do not replace the vhost, `.htaccess`, forms, tracking configuration or document root.

```diff
 context / {
-  type static
-  location $DOC_ROOT/
-  allowBrowse 1
+  type proxy
+  handler leannedigital-mcp
   extraHeaders <<<END_LD_HEADERS
```

The inspected vhost SHA-256 was `cc4a167c904d4d46db1a52c8cff0b985ecb3bd63fbea2cc188c966baaaefaed8`. Re-fetch and inspect changes before applying; do not assume this hash is still current. Run LiteSpeed configuration validation and an isolated proxy smoke test before switching routing. Editor pages respond `Cache-Control: no-store`; purge old upstream page caches at activation and verify anonymous rendered responses.

## Release files

Run `node scripts/editor-release-plan.mjs` from this worktree. The generated `runtime/editor-next/release/manifest.json` enumerates 19 files with hashes. Existing API/MCP files are patched from the live files fetched during this task, not from either dirty workspace. It preserves deployed work-log changes. New editor modules, dashboard assets, CLI, scheduler and guard are separate files. The Google Platforms schema gets only the Zod 4 record-key compatibility change. Package updates are deliberate and listed in package.json/lock.

Before deployment, fetch the remaining production dependencies and run the merged tests on a private copy. The local attempt to combine live API/MCP files with cached agency dependencies correctly failed because cached `server/services/agency.mjs` lacks the production `createClientPortalAccount` export. **Do not deploy that validation tree or replace the production agency service.** Obtain the actual live service files; no stub or unrelated refactor should be used to hide this mismatch.

Install with `npm ci` (no legacy-peer-deps). Sharp is now a runtime dependency. The updated tree reports zero npm audit findings. Node 22.23.4 tests pass locally; Linux native package installation and migration of an offline production OAuth database copy remain to be verified. Better Auth migration adds resource/assertion tables; back up its SQLite database and preserve consent/user/token data. Do not migrate production just to test.

## Private state and configuration

Proposed portal environment drop-in, plus the same values for the scheduler:

```ini
WEBSITE_EDITOR_DATA_DIR=/home/leannedigital.com/private/website-editor
WEBSITE_EDITOR_ORIGIN=https://leannedigital.com
WEBSITE_EDITOR_PUBLIC_SITE=leanne-digital
WEBSITE_EDITOR_STAFF_SITE=leanne-digital
```

No new external service or API key is required. The private directory contains SQLite state, credentials, schedules, source snapshot and immutable releases; it must never be web-accessible. Bootstrap from a **fresh frozen copy of current public pages and their CSS/images/fonts**, not stale repository HTML. Keep the original files intact for routing rollback. The preview currently imports live HTML but uses locally cached public CSS/media; server byte comparison is still pending.

Grant publisher rights to Gary and Leanne only after reviewing the exact activation plan:

```sh
node scripts/editor-admin.mjs --data /home/leannedigital.com/private/website-editor --source /home/leannedigital.com/private/website-editor/source --site leanne-digital --subject gary@leannedigital.com --role publisher
node scripts/editor-admin.mjs --data /home/leannedigital.com/private/website-editor --site leanne-digital --subject leanne@leannedigital.com --role publisher
```

Prepare/review an initial unchanged release before activating the public adapter. Reviewed digests bind the publication environment; staging reviews cannot authorize production publication. Do not copy demonstration posts or preview data to production.

## Durable scheduling service

Install a systemd oneshot calling `/usr/bin/node /opt/sites/leannedigital/scripts/editor-scheduler.mjs`, with the editor environment above, working directory `/opt/sites/leannedigital`, and a timer every 30 seconds (`OnBootSec=30s`, `OnUnitActiveSec=30s`). The database stores the due instant, actor, exact reviewed post, hash and destination. Writes serialize via `BEGIN IMMEDIATE`. A job and active release switch commit together. Restarts process overdue jobs; duplicate workers cannot publish the same job twice. Changed posts, revoked publishing permission, disabled blog features, route conflicts or changed environment mark the job `needs-review` instead of publishing unreviewed content. The dashboard exposes that status. Monitor timer failures and `needs-review` jobs.

Scheduling only overlays the approved post onto the active release; unrelated drafts remain private. Scheduled URLs and referenced assets update the blog listing and XML sitemap in that release. Cancelling leaves the draft intact. Taking a post to draft/deleted requires reviewed publication and cancels its schedule; republishing uses the same reviewed workflow.

## Build protection

Immutable snapshots and the database release pointer are authoritative. Legacy static copies do not replace them. Before activation, add `import './editor-build-guard.mjs';` to these existing scripts **without replacing their other contents**: generate-pages, generate-blog, generate-portfolio, generate-services, apply-public-seo, bake-seo, write-seo-files, apply-lilipadd, apply-lilipadd-slots, integrate-prod. Create `/opt/sites/leannedigital/.editor-managed-publication.json` with the site ID. The guard blocks these generators when the marker or public-site environment is present. Client/report generators remain independent. Future template or global-layout changes require an explicit snapshot migration. Guard imports are implemented in this isolated worktree, but exact live-script patches/hashes must be finalized when SSH returns.

## Rollback

Content rollback is tested end to end: restore an old revision into a new draft, preview, save, re-preview, publish. Previous release files remain intact; no destructive history rewrite occurs. Exact current-revision checks prevent overwriting another editor's work.

Infrastructure rollback: stop the editor scheduler; revert the small vhost root-context patch to static; validate and reload LiteSpeed; remove the public-site activation drop-in; restore backed-up API/MCP/package files and the original node_modules installation; restart the portal. Retain the editor database/releases for diagnosis. OAuth-database rollback must be coordinated with the service stopped and must not discard subsequent user activity. Verify homepage, contact endpoint (without sending mail), staff OAuth, client report, CSS, sitemap and private-route denial. This server-level rollback remains unexecuted until the isolated Linux preflight is possible.

No production approval is requested while the server preflight and actual ChatGPT connection verification are unfinished.
