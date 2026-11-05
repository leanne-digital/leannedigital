# Current continuation status

See [production plan](website-editor-production-plan.md), [connection instructions](website-editor-connections.md), and [current validation](website-editor-validation.md). Scheduling and editor-specific OAuth are now implemented and privately tested; actual ChatGPT connection and Linux production preflight remain pending. The architecture notes below include historical prototype limitations; the continuation documents supersede those statements.

# Conversational website editor — implementation and operation

Implemented in `codex/conversational-website-editor`, isolated worktree
`C:/Projects/Leanne Digital Editor`. The worktree includes the current working source
snapshot of the original project so existing uncommitted agency features remain
available. Do not merge that whole working snapshot blindly: the editor file manifest
below identifies this feature's changes. No production files or database were edited.

## Architecture

`server/editor/schema.mjs` is the registry of callable tools, permission groups,
validated operation schemas, rich-text runs, templates, colour slots, fonts, states,
and breakpoint controls. MCP tools and capability discovery use that same registry.
`document.mjs` adapts existing trusted HTML into stable `data-editor-id` targets and
ordered trees. Template HTML remains developer-owned. Clients submit typed values,
never HTML, selectors, filesystem paths, shell commands, SQL, CSS or JavaScript.

The internal snapshot stores each trusted page document, stable IDs, typed style
overrides, SEO, post blocks, assets and redirects. HTML is retained internally to
preserve existing forms, sections, classes and scripts during incremental migration.
Text mutations escape values; rich text supports only text/bold/italic/safe links.
IDs survive edits, heading changes, hides and moves. Duplicate sections receive new
editor IDs and HTML anchor IDs, with internal anchor/ARIA references remapped.
Header/footer and navigation link content are discoverable; identified repeated header/footer
text/links support explicit `scope: shared` content edits with every affected page in the diff; forms and mechanics are
excluded. Adding/moving/hiding/removing main sections containing forms/scripts/iframes
is rejected. New pages use an existing shell and approved section template.

`store.mjs` owns SQLite migration version 1, permissions, changesets, history,
revision/idempotency checks, asset ingestion and release generation. SQLite uses WAL
and `BEGIN IMMEDIATE`; a failed multi-operation preparation has no partial draft
mutation. Idempotency keys are scoped to site and actor and bound to input hashes.
Multiple connections/processes serialize writes. History retains complete snapshots
and structured before/after details; undo prepares a new draft and requires the
current expected revision. It never rewrites history or silently overwrites later work.

`http.mjs` supplies authenticated preview/dashboard/media routes and a separate
`/mcp/editor` MCP endpoint. `tools.mjs` exposes **only** editor tools on that endpoint.
The existing staff MCP may also register editor tools when the authenticated staff
email has exactly one explicit site grant; its existing read-only scope is respected.
The existing staff OAuth authorization boundary is not broadened to admit clients.

## Private storage and migration

Set `WEBSITE_EDITOR_DATA_DIR` outside any public document root. Local default:
`runtime/website-editor/`. It contains:

- `editor.sqlite` plus WAL files: sites, grants, hashed expiring tokens, revisions,
  changesets, idempotency results and publication audit records.
- `assets/<site>/<sha256>.webp`: validated, orientation-normalized, metadata-stripped images.
- `releases/<site>/<release-id>/`: immutable rendered pages, XML sitemap, redirects
  and internal snapshot. The active release is an atomic database pointer.

Bootstrap is an agency CLI operation, not a client tool. It is idempotent and does
not replace an existing site. It imports sitemap-listed public pages, excludes
internal/client/report routes, and inventories public `/assets/images/` images.
The current private demonstration uses `runtime/editor-demonstration` and imported 57 pages from the existing site. Template
assets remain in the configured per-site source root; new images live in private storage.

```powershell
npm ci
node scripts/editor-admin.mjs --source . --site leanne-digital --subject gary@leannedigital.com --role publisher --token-file runtime/editor-preview-token.txt
node scripts/editor-preview.mjs
```

Dependencies have been upgraded to a compatible Zod 4/Better Auth/MCP SDK set; no legacy-peer-dependency flag is needed. Sharp is a production dependency. Tests pass on Node 22.23.4 and Node 24. The current audit reports zero findings. A palette JSON file can be supplied using `--palette`; it may
override the named slots with exact six-digit hex values. Approved font slots use
the site's existing Lato/Nunito/Open Sans CSS. The demonstration adds a readable
red slot `brand-red: #b42336`; this is an editor default, not a claim that red was
already the agency's primary brand colour. Approve each client's palette at onboarding.

Grant and issue access without printing the token:

```powershell
node scripts/editor-admin.mjs --data runtime/website-editor --site leanne-digital --subject client@example.com --role editor --token-file runtime/client-editor-token.txt
```

Roles: viewer = read, editor = read/edit, publisher = read/edit/publish. Grants are
server-side and rechecked on every operation. Credentials are cryptographically random,
hashed at rest, site-bound, and expire after 30 days. `--revoke-tokens` with `--subject`
and `--site` invalidates that subject's tokens. Tokens do not authorize the existing
agency `/mcp` or client-record tools. A client cannot supply another site/actor in tool input.

## Connecting an assistant

Use an MCP client that supports Streamable HTTP and an Authorization header:

```toml
[mcp_servers.website_editor]
url = "http://127.0.0.1:4186/mcp/editor"
bearer_token_env_var = "WEBSITE_EDITOR_TOKEN"
```

Set the environment variable privately from the issued token file. Do not embed it
in the configuration, prompts, screenshots, URLs, or source control. For remote
clients the agency must deploy this endpoint behind HTTPS and provision separate
site grants/tokens. Editor-specific OAuth now supports DCR, PKCE, resource-bound codes/tokens and rotating refresh tokens. Agency-provisioned credentials authorize the site/role; an actual ChatGPT UI connection remains to be verified.
Do not connect clients to the agency-wide MCP as a workaround.

The existing portal integration is enabled only when `WEBSITE_EDITOR_DATA_DIR` is
configured. Portal sessions map by email to explicit editor grants. With multiple
grants, select `?site=<id>`; no implicit cross-site access is granted. The dashboard
is `/website-editor/`; the isolated server offers `/editor/login` for token sign-in
using an HttpOnly SameSite=Strict cookie. The preview server binds loopback only.

## Editing and publication contract

1. `editor_capabilities`, `editor_list_pages`, `editor_get_page`, `editor_find_content`,
   and `editor_inspect_target` resolve a precise target against the current revision.
2. `editor_prepare_changes` validates an atomic operation batch against that revision
   and stores an immutable proposed snapshot, without modifying the draft.
3. `editor_preview_changes` returns before/after trees, warnings, affected pages,
   private render URLs and a digest bound to the snapshot/base revision.
4. `editor_apply_draft` saves the prepared snapshot as a new revision. This invalidates
   the previous review acknowledgement.
5. The publishing actor re-previews that saved revision, then calls
   `editor_publish_changes` with `confirm: true`, matching revision and digest.
6. All release files are built and checked before the database release pointer moves.
   Publication and its idempotency receipt commit atomically. Build failures cannot
   switch the active release. An orphan completed directory can remain after rollback;
   it is never served without the active pointer.

The default publication target is **private staging**, served at
`/editor/<site>/live/`. It is deliberately not a write into the production public_html
tree. HTTP cache is private/no-store, so a release pointer switch takes effect on the
next request. Previous directories and snapshots remain available for recovery.
The public serving adapter is implemented but disabled: `WEBSITE_EDITOR_PUBLIC_SITE=<site-id>`
activates the selected site at normal page URLs. It serves the immutable active release,
301 redirects, XML sitemap and only uploaded media referenced by published pages.
Draft/unpublished routes stay unavailable; the editor UI and previews remain authenticated.
It uses no-store responses, and publication digests also bind the destination environment.
Production activation must route managed page, sitemap, CSS and `/editor-assets/` requests
through Node and purge pre-existing upstream caches. The public adapter is covered by
isolated HTTP tests; it has not been activated on the production server. Do not
run the old static generators over editor content: these generators do not consume
the editor snapshot. Agency template updates need an explicit migration, not reimport.

Published new posts are inserted into the existing blog listing and XML sitemap.
Draft/deleted pages are absent from the release and sitemap. Unpublished imported
post cards are removed from blog listing pages. New posts use the existing blog CSS,
ordered structured blocks, author/categories/tags/excerpt, feature/social assets and
SEO fields. Existing imported posts retain their markup and use target-based edits;
they are not automatically converted into the new structured-post model.

## Controls and limitations

- Main-content positions are one-based. Counting excludes hidden items and header/footer.
  `afterHeading` requires a unique heading; multiple matches return candidates.
- Named palette slots, approved fonts, sizes 12–96px, weights 400/600/700/800, line heights
  1–2.5, padding/gap/radius/borders, text alignment and section-container alignment.
- Breakpoints: all, desktop >=768px, mobile <=767px. States: normal, hover, focus-visible.
  Explicit shared styles affect all matching buttons/headings/paragraphs on the site.
- Semantic headings retain their original style identity. Preview CSS aliases incumbent
  heading selectors to `data-editor-heading-style`; a future production adapter must
  preserve this CSS behavior. Browser-verified H1→H3 retained 58px/61.48px/800 desktop
  typography and 32px mobile size on the homepage.
- Contrast is checked when both foreground/background tokens are known. Low contrast
  blocks publishing; inherited/gradient/image backgrounds produce a specific warning
  requiring rendered review. This is not a complete automated accessibility audit.
- Image upload: PNG/JPEG/WebP <=5MB and <=40MP, re-encoded WebP, content-hashed filenames.
  SVG/HTML/arbitrary remote URL fetches are rejected. Images are retained indefinitely;
  reference-aware garbage collection is intentionally not implemented.
- Inline images support alt/decorative/caption/fit/focal point; section backgrounds
  support image/focal point/overlay. Asset picker currently searches name and alt text.
- Draft pages, articles, section duplication, hiding, recoverable removal, metadata,
  safe internal/external/email/telephone links, and redirect-producing URL changes.
- A SQLite-backed scheduler now persists reviewed post jobs with Toronto/DST validation; see the production timer templates.
- Authentication uses provisioned tokens or explicitly granted existing portal sessions.
  The HTTP layer limits login attempts to 10/minute per connection peer and authenticated
  tool calls to 240/minute per site/actor. Public deployment still needs infrastructure
  abuse controls and, for clients requiring it, editor-specific OAuth onboarding.

## Extending the system

Add section templates in `document.mjs` and corresponding enums in `schema.mjs`.
Templates must use the site's CSS, contain no new executable input, and expose stable
editable children. Add typed controls to `contentFields` or `styleSchema`, implement
only the corresponding allowlisted rendering branch, and add validation/tests.
Add a tool once in the registry, implement dispatch, and both MCP discovery and the
capability menu inherit its permission rule. Keep client operations out of agency
client-record services. Template configuration and grants remain agency-only.

## Feature file manifest

New: `server/editor/{schema,document,store,tools,http}.mjs`,
`scripts/editor-{admin,preview,demo}.mjs`, `js/editor-dashboard.js`,
`css/editor-dashboard.css`, `tests/website-editor{,-portal}.test.mjs`, generated `docs/website-editor-tools.json`, and editor documentation.

Integration edits: `server/api.mjs`, `server/mcp-tools.mjs`,
`scripts/admin-navigation.mjs`, `.env.example`, `package.json`, `package-lock.json`.
Other working-tree modifications were present in the source snapshot before this feature.
