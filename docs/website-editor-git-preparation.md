> Production update: staff editor deployed and HTTPS-verified. See [deployment record](website-editor-deployment-2026-11-04.md). Earlier not-deployed statements below are historical.

# Git preparation status

Branch: codex/editor-production-prep, based on origin/main at 26de064. This clean checkout contains only editor additions and narrow integration/dependency changes. The dirty agency and prototype worktrees are untouched. No production deployment is included.

The previous missing createClientPortalAccount error is resolved by using current upstream agency code. Staff OAuth now derives the editor subject from the verified database account, not an optional token email claim, and passes staff status only for the existing allowlist. Explicit editor grants remain required.

All 13 editor tests pass under Node 22.23.4 against the combined Git tree. Full repository run: 33 pass, 4 fail in unchanged client-work-visibility/maintenance browser mocks (missing querySelector/createElement). Those UI files/tests are unchanged from upstream; do not treat the full suite as green. The dedicated Linux workflow runs editor and relevant agency API tests; it has read-only repository access, no secrets, and no deployment commands. npm audit reports zero vulnerabilities after refreshing the lockfile.

Git is the source/review route. It cannot itself change LiteSpeed routing, install the scheduler or supply a private HTTPS ChatGPT endpoint. The production plan still requires current host configuration/asset checks, offline production OAuth migration validation, isolated proxy/rollback verification and an actual ChatGPT connection. The separately installed Google connector is absent from upstream: do not delete it or overwrite its live integration on release. Apply the small API/MCP integration changes to current production files and review drift; do not replace the complete server directory from Git.

The old 19-file release manifest and SSH instructions in historical docs are superseded by this branch for source review. They are not a deployable bundle. Private loopback preview remains http://127.0.0.1:4192/website-editor/ on Gary's computer. No approval is requested until remaining production gates are verified.

Linux GitHub Actions run 41953477054 passed on Ubuntu with Node 22.23.4: npm ci (including native Sharp), zero-vulnerability audit, all 13 editor tests, and selected agency API regression tests. This verifies a clean Linux runtime, not the production server routing or an existing production OAuth database migration. Draft review: https://github.com/leanne-digital/leannedigital/pull/3 . An additional staff identity test confirms that a signed token email claim cannot borrow another account's editor grant.
