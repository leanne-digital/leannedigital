> Production update: staff editor deployed and HTTPS-verified. See [deployment record](website-editor-deployment-2026-11-04.md). Earlier not-deployed statements below are historical.

# Connecting ChatGPT and the website editor

The protocol implementation is tested, including authorization, token exchange, refresh rotation and MCP calls. **A connection from the actual ChatGPT UI has not yet been verified.** Production remains unchanged. These steps become usable remotely after the reviewed HTTPS deployment; loopback URLs cannot be reached by ordinary hosted ChatGPT connections.

## Gary and Leanne: existing agency MCP

Keep the existing Leanne Digital connection at `https://leannedigital.com/mcp` and its existing staff Google OAuth. No agency scopes or allowed users are broadened. An agency administrator adds explicit site grants with editor-admin.mjs. `WEBSITE_EDITOR_STAFF_SITE=leanne-digital` selects the grant when a staff member has multiple sites; otherwise exactly one grant is required. Refresh the existing connection's tool discovery after deployment; reconnect only if the client retains stale discovery. Ask “What can I change on our website?” and confirm `editor_capabilities` names `leanne-digital` and the intended role/environment. Read-only OAuth cannot obtain write tools even with a publisher site grant.

Actual HTTP `/mcp` tests verify both Gary and Leanne using signed tokens from an isolated instance of the existing OAuth provider, with existing scopes and explicit grants. This is not a claim of a completed production ChatGPT reconnect.

## Future clients: editor-only connection

1. Agency imports the client's approved public pages into its own site ID/source root; configures palette, enabled feature groups and role. The public adapter currently supports one public site per process. Use a separate process/origin for each future client, with its own public-site configuration and private directory. Do not route a second client's domain through the agency public site.
2. Agency grants that person access to only that site and issues a private credential with `editor-admin.mjs --data ... --site client-site --subject client@example.com --role editor --token-file <private-file>`. Supply it privately to the intended person. `publisher` additionally allows publishing and scheduling; `viewer` cannot edit. `--features` reads an agency-authored JSON array of enabled groups. `--revoke-tokens` invalidates provisioned and OAuth credentials for that person/site; no client can grant themselves rights.
3. In the current ChatGPT Plugins UI, choose **+ → Add custom MCP server** (legacy workspaces may show Apps → Create), then create an OAuth connection to **`https://<client-editor-origin>/mcp/editor`**, and follow the connection prompt. Do not use the agency `/mcp` endpoint for clients. Workspace administrators may control app creation.
4. The consent page shows the requesting application, return address and requested permissions. Enter the agency-issued editor credential there (never into chat). Approve that site's connection. The credential is checked locally; the assistant receives separate short-lived, site-bound OAuth tokens. Requested permissions are capped by the site grant.
5. Ask “What can I change on my website?” Verify site/role, then inspect a page, prepare an edit, preview, save draft, preview again, and explicitly approve publication. A client token must fail against `/mcp`, `/api/clients` and another site's preview.

Discovery: `/.well-known/oauth-protected-resource/mcp/editor` and `/.well-known/oauth-authorization-server/editor/oauth`. Authorization/token/registration/revocation live under `/editor/oauth/`. DCR supports public clients with PKCE S256; authorization codes are single-use and resource-bound. Access tokens expire after 15 minutes. `offline_access` enables rotating refresh tokens, expiring after 30 days; detected reuse revokes the family. Revoked/downgraded grants are rechecked on every operation.

ChatGPT's documented HTTPS callback forms are allowlisted. For another assistant, add its **exact** callback URLs via `WEBSITE_EDITOR_OAUTH_REDIRECT_URIS` as a JSON array; do not permit arbitrary redirects. Metadata advertises authorization-response issuer identification. No client-credentials grant or shared agency API key is offered.

## Private preview now

The browser session at `http://127.0.0.1:4192/website-editor/` is signed in privately on this machine. A fresh browser can sign in at `/editor/login` using the local credential file `runtime/editor-next/preview-token.txt`. Do not paste that credential into chat. The preview server binds loopback and disables form submissions/tracking in rendered previews. It uses only copied content and its own database.

For a real hosted ChatGPT test before production, use the documented Secure MCP Tunnel or an agency-approved private HTTPS staging origin. No public tunnel was opened and no connection was claimed completed during this task. Follow the OpenAI product's actual displayed connection fields; workspace controls vary.

References: [OpenAI OAuth connection requirements](https://developers.openai.com/plugins/build/auth), [ChatGPT developer mode and private-network connection options](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt), [MCP authorization specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/basic/authorization.mdx).
