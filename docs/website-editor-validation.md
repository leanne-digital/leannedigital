> Git continuation: see [current preparation status](website-editor-git-preparation.md). Historical SSH/19-file bundle guidance below is not the current deployment artifact.

# Continuation validation — November 4, 2026

Current status: private implementation verified; production not deployed. The tests below do not imply an actual ChatGPT UI connection has completed.

- 13 automated tests pass on Node 24 and Node **22.23.4**, matching the production Node version. These include actual HTTP editor OAuth authorization/consent/PKCE/token exchange/refresh replay detection; actual MCP calls for editing/publishing/restoration; both staff identities on the existing MCP with explicit grants and read-only scope ceilings; cross-site isolation and hidden agency tools.
- Scheduling tests cover future/past times, Toronto DST gaps and repeated hours, rescheduling, cancellation, unrelated drafts staying private, changed-post rejection, store restart, duplicate-run prevention, unpublishing and republishing. Displayed past dates are rendered without triggering publication.
- An additional real timer test scheduled a private demonstration post for **2026-11-04 14:11:18 EST**, stopped the server, restarted under Node 22.23.4, and observed one completed publication (`cfefaff8a1344d7284cbc5aee7cd68d3`). The rendered article returned 200 and displayed **2026-10-01**. It was not published to the public website.
- The private preview imports 58 current public pages. Three existing sitemap URLs returned 404 during read-only import and were skipped: `/projects/krane-electrical-mechanical/`, `/projects/mr-pool-guy/`, `/projects/power-vac-of-ottawa/`. No public content was modified to repair these unrelated issues.
- Desktop and 390px mobile checks: no horizontal overflow; heading changed to H3 while retaining 58px desktop/32px mobile typography; mobile menu toggles; all three article images load; original form action `/api/contact` and eight fields are retained. Preview CSP blocks submissions and tracking. Production release HTML retains scripts/forms in automated tests.
- npm audit reports **zero findings** after compatible dependency updates. `npm ci` no longer requires legacy-peer-deps. This is dependency evidence, not a guarantee that all application security issues have been eliminated.

## Remaining gates

SSH began refusing connections after live routing/API/MCP inspection. The merged validation tree could not finish because the locally cached agency service lacks a production export required by the fetched live MCP. Do not deploy cached agency files or mask this failure. Fetch the actual production dependencies, run Linux/native-package and offline OAuth-database migration tests, inspect final routing/build-guard diffs, and verify server-level rollback when access returns. An actual ChatGPT connection requires an approved HTTPS staging origin or configured Secure MCP Tunnel and successful tool call; it remains unverified. Production approval has not been requested.

Private preview: `http://127.0.0.1:4192/website-editor/`, signed-in browser tab retained. State and credential stay under `runtime/editor-next/`; no credentials appear in documentation. Preview assets currently use the copied working snapshot; compare them to server bytes before activation.

## Historical prototype validation (superseded where noted above)

# Validation — November 4, 2026

## Automated

`node --test tests/website-editor.test.mjs tests/website-editor-portal.test.mjs` passes
eleven tests (one parent, nine scenario groups and one existing-portal integration test). The test starts an actual HTTP Streamable MCP server with isolated
SQLite storage and issued site-bound credentials. It calls discovery and editing tools
over HTTP; it does not shortcut mutation tests through direct database writes.

Verified:

- Authenticated discovery, read-only menu, hidden agency tools, invalid credentials,
  cross-site reads/previews and unauthorized direct HTTP mutation rejection.
- Relative paragraph targeting, neighbouring context and ambiguous candidate results.
- Three real encoded image uploads, safe decoding and retry idempotency; SVG rejection.
- Heading text and H1→H3, safe rich text, preserved target IDs, form structure retained.
- Testimonials moved to second from bottom, isolated button normal/hover/focus styles,
  image alt/crop/fit, background image/overlay, all three alignment choices.
- Preparation does not mutate drafts; failed operation batches remain atomic.
- Stale revision rejection, input-bound idempotency conflict, safe-link/arbitrary-CSS
  rejection, shared low-contrast diagnostic.
- Approved section insertion and draft page creation; section duplication/removal,
  unique copied IDs, restoration and conflict-aware undo.
- Three-asset blog draft with featured image, body-image move below a heading,
  private preview, publication, listing, sitemap, URL rename and 301 redirect.
- Publish requires a saved draft and fresh review by the publisher; repeated publish
  requests with the same key do not create another release.
- Opt-in public release adapter: normal unauthenticated page URLs, no-store headers,
  redirects, sitemap and referenced published media only; private previews remain private.
- Existing portal integration retains the original homepage and OpenAPI routes; an
  editor token cannot access `/api/clients`.
- Explicit shared header/footer content edits report all affected pages.
- Source homepage bytes are unchanged after the complete test.

Syntax checks pass for the API/MCP integration and editor modules. The Impeccable
mechanical check returned no findings for the dashboard CSS/JS/HTTP template.

## Browser

Authenticated private preview tested in Chromium desktop and 390px mobile viewport.
Dashboard loads capability examples, real page inventory and revision history. UTF-8
quotes and punctuation render correctly after a response-charset fix. No horizontal
overflow observed on dashboard or edited homepage.

Homepage H1→H3 retained font family Nunito, 58px size, 61.48px line height, weight 800
on desktop and 32px on mobile. Changed button computed colours were white on
rgb(180,35,54). Main form still has `/api/contact` and eight fields; public release HTML
retains existing scripts/forms. Private-preview CSP prevents actual form submissions
and analytics traffic. Mobile menu button toggles aria-expanded and the open menu.
Responsive source-set paths were normalized; no failed completed image loads observed.

The three-image blog draft was also reviewed at desktop and mobile widths; all three
images loaded and no horizontal overflow was observed. The final article template
was rechecked at desktop width after adopting existing blog classes.

Browser coverage is the homepage, blog draft and capability menu, not a claim of exhaustive
visual verification of all 57 imported pages. New post ordering/publication/rendered
HTML are verified by HTTP tests; human content approval remains required.

## Deployment and dependency limits

No production deployment, client-record mutation, real form submission, scheduled job,
or production publication occurred. The running preview is loopback-only at port 4186.
The review draft and staging release are recorded in `runtime/editor-review.json`.
Access token is stored in `runtime/editor-preview-token.txt`, excluded from Git.

`npm audit` reports 15 dependency findings: 2 critical, 6 high, 5 moderate, 2 low,
including existing Better Auth/MCP/mail/Zod/Sharp dependencies. Details are retained
privately in `runtime/editor-audit.json`. Cheerio is not named in those findings.
No blanket dependency upgrade or force fix was applied to the existing authentication
stack. Resolve and regression-test those dependencies before exposing client editing
publicly. This remains a private implementation preview, not production readiness certification.
