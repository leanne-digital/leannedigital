# MCP CRUD and Google-only access

Remote MCP requires OAuth. Only gary@leannedigital.com and leanne@leannedigital.com may authorize it or use an issued token, including for read access. The allowlist is checked against the token subject's account on every MCP request. API keys cannot bypass this rule. Local stdio MCP is a separate host-local administrative interface; existing portal HTTP authentication is unchanged.

Password login endpoints are disabled for MCP. The connection page automatically submits the Google sign-in form; the Google button remains as a fallback if JavaScript is unavailable. Only Google-verified, allowlisted email addresses may link or create an OAuth identity.

## Deploy

Merge GitHub main into the server checkout, then set REMOTE_MCP_READ_ONLY=0 in /opt/sites/leannedigital/.env. Preserve the existing Google client settings and OAUTH_SECRET. Restart leannedigital-portal.service. Regenerate/deploy the website to publish data-backed proposal links.

Recreate the ChatGPT developer plugin registration if it was registered with only read scopes. Select OAuth with dynamic client registration and request these default scopes:

    mcp:read mcp:write mcp:credentials:write offline_access

Both allowed accounts can consent to all these permissions. Existing read tokens stay read-only; adding write capabilities does not silently elevate them. Refresh the plugin's tool list after reconnecting.

## Editable records

- Clients: existing create_client, get_client/list_clients, update_client, delete_client.
- Services/packages and LD hosting: list_client_services/list_client_hosting and create/update/delete_client_services or _hosting. Hosting records include lastBilled and nextBillDate. External provider passwords belong in credentials.
- Projects: existing create/read/update plus delete_project. Deletion also removes project history and prevents automatic reseeding of that client/service pair.
- Proposals: list/create/update/delete_client_proposals. These manage proposal titles, status and links to proposal pages; they do not author the linked document. Draft links are excluded from the public client hub.
- Reports: list_client_reports, get_client_report, save_client_report (create/update), delete_client_report. Structured reports support partial recap updates. Public page changes require website deployment; legacy reports are listed, but lack structured editable content until converted.
- Credentials: list_client_credentials, save_client_credential (create/update), delete_client_credential. Writes require mcp:credentials:write independently of mcp:write. No passwords or usernames are returned. Deletions require confirm=true.
- Analytics, recorded bookings and calculated totals remain read-only; lead status remains editable.

HTTP equivalents are staff-protected /api/clients/:client/services, /hosting, /proposals and /credentials. POST creates, PATCH /:record updates, DELETE /:record deletes with {"confirm":true}. Credentials use an exact slot such as other1. Reports support PATCH and DELETE /api/clients/:client/reports/:slug. Projects support DELETE /api/projects/:id.

## Missing credentials

An absent private client profile now reports available:false with an import explanation, rather than implying all slots are occupied. New saves can create the private profile. Existing passwords are not automatically transferred from a developer computer to production. Import the original SQL on the server from a private location using scripts/import-client-credentials.mjs; never put the SQL or credential JSON in Git or the public web directory. Existing profiles are preserved by that importer.

## Verification

Run scripts/test-google-oauth.mjs, scripts/test-mcp-oauth.mjs, scripts/test-client-crud.mjs, scripts/test-credential-mcp.mjs and scripts/test-client-hub.mjs. CRUD tests mutate only a temporary repository copy and temporary credential fixtures. Google tests verify policy and redirect construction, not a live Google account exchange.
