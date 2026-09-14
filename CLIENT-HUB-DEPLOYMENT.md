# Client hub deployment

`/clients/` is the staff client selector. Each `/clients/<slug>/` is a public hub with shareable `#reports` links and packages displayed above the section tabs (`#packages` remains a valid anchor). Proposals link to existing published proposals. Hosting appears only when the client record has `hosting.lddHosted` enabled. External hosting accounts belong in Credentials.

Contact details, branding, credentials, and billing forms are loaded only for signed-in staff. The private record endpoint enforces staff access on both reads and writes and sends `Cache-Control: private, no-store`. Client accounts cannot read it. No passwords are generated into HTML.

## Publish and enable the private records

1. Deploy the repository using the existing `deploy ld` workflow.
2. Restart the existing portal API process so it loads the new endpoint. Static publication alone does not update a running Node process.
3. Put the original `jiw_clients.sql` export in a private server directory, outside `public_html` and the Lilipadd release directories. Run the importer as the operating-system account that runs the portal API:

   ```sh
   cd /opt/sites/leannedigital
   node scripts/import-client-credentials.mjs /private/path/jiw_clients.sql
   ```

   The default store is `/opt/sites/.ld-private/client-credentials.json`, outside the source and published website. Its directory and file permissions are restricted to the owner. If using a different path, set the same `LD_CREDENTIALS_FILE` in both the importer environment and the portal API environment. The API account must own or have access to this file and its directory.

4. Sign in as staff, select Leanne Digital, and open Credentials. Confirm that the existing accounts appear. Check a report link in a signed-out browser: it should open directly, with no Credentials tab.

The importer preserves existing profiles on repeat runs, including edits made in the hub. It does not print credentials. Back up the private store separately from Git. Do not place SQL exports or the private store in the repository or published release.

## Verification

`node scripts/test-client-hub.mjs` checks SQL string fidelity, restricted reads/writes, partial edits, API authentication, private cache headers, public reports, and blocked private directories using temporary fixture data.

## ChatGPT MCP connection

The remote server URL is `https://leannedigital.com/mcp`. The reverse proxy must forward `/mcp`, `/oauth/`, `/.well-known/oauth-protected-resource/mcp`, and `/.well-known/oauth-authorization-server` to the same portal API. The discovery URLs must return JSON, not the LiteSpeed 404 page. Preserve any existing certificate-validation routes under `.well-known`.

After publishing code, restart the portal API. Verify both discovery URLs before creating or reconnecting the ChatGPT app. Configure the OAuth issuer as `https://leannedigital.com` and resource as `https://leannedigital.com/mcp` in the existing API environment.

- `get_hosting_accounts`: LD hosting accounts, renewal dates, count, overdue/due-soon count and monthly value.
- `list_client_credentials`: saved account names/slots and count, without usernames or passwords.
- `save_client_credential`: add/update a specific client's private account; returns only client, slot and save status.

OAuth keeps `mcp:read` for queries and uses a separate `mcp:credentials:write` permission for credential saves. General `mcp:write` remains unavailable to OAuth apps. Existing read-only connections stay read-only; reconnect and approve the credential-save permission to use the new tool. `REMOTE_MCP_READ_ONLY=1` disables writes regardless of granted scopes.

In ChatGPT, enable Developer mode, create a developer-mode app using this MCP URL and OAuth, and approve the intended scopes. Confirm the tool list contains the relevant tools. Deployment and OAuth connection are not completed by a Git push alone.

Run `node scripts/test-credential-mcp.mjs` for scoped credential-write and hosting-total checks. It uses temporary fixture records and never edits the real private store.
