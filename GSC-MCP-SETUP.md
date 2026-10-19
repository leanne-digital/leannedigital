# Search Console in Leanne Digital Admin

Six read-only tools are registered on both existing MCP transports: `gsc_connection_status`, `gsc_list_sites`, `gsc_search_analytics`, `gsc_compare_periods`, `gsc_inspect_url`, and `gsc_list_sitemaps`.

The existing remote staff authorization and `mcp:read` gate apply. This is a shared agency Google connection: both authorized staff accounts can read every property granted to it. It is not a client-portal integration. The existing Google identity login is unchanged and does not itself grant GSC access. No indexing requests, sitemap changes or property changes are implemented.

## Connect Google once

1. In the agency Google Cloud project, enable **Google Search Console API**. Configure the Google OAuth consent screen for the read-only scope `https://www.googleapis.com/auth/webmasters.readonly`. Add your Google account as a test user if the app is in testing. External testing refresh tokens for this scope can expire after seven days; use a suitable production/internal consent configuration for ongoing operation.
2. Create an OAuth client of type **Desktop app**, used only for the local enrollment script. Download its JSON to a private folder outside the checkout and public web root. Do not replace the existing MCP Google sign-in client.
3. On a trusted workstation with Node 20+ and a browser, run:

   ```bash
   node scripts/connect-gsc.mjs /private/google-desktop-client.json /private/gsc.env
   ```

   Use actual private paths on your computer. The output must not exist yet. On Windows, restrict that folder's NTFS permissions to your user; POSIX mode 0600 does not set Windows ACLs. The script prints a Google consent URL, listens only on loopback, uses random state and PKCE, expires after five minutes, and never prints tokens. Open the URL on that same computer and choose the account holding the client GSC properties. No password is shared with the app.
4. Securely install the resulting three environment values in the private portal service environment, outside Git and the public web root:

   ```text
   GSC_CLIENT_ID
   GSC_CLIENT_SECRET
   GSC_REFRESH_TOKEN
   ```

   Use a service EnvironmentFile with restricted filesystem permissions. Do not paste values into chat. A server restart is required after credential changes. Revoke the grant in your Google account to disconnect, then remove the three variables and restart.

## Release and verify

This repo's newer README and MCP-CRUD-DEPLOYMENT.md explicitly identify it as the MCP backend despite the older static-site archive notice. Review/merge the feature branch and deploy only the backend through the established server process. Do not regenerate or deploy the archived static site. No production deployment is performed by this change.

Run `npm run test:gsc`, then the existing `npm test` and `node scripts/test-google-oauth.mjs`. Restart `leannedigital-portal.service` after approved backend deployment/configuration. Refresh the ChatGPT connector's tool list. Call `gsc_connection_status`, then `gsc_list_sites`; the latter verifies real authorization. Select the exact returned property and request performance without dimensions for totals, followed by a page/query breakdown. Finally inspect one known URL and list sitemaps. Automated tests use mocked Google responses; real Google consent and property access require this live check.

## Reporting rules

Defaults are 28 days ending three days ago in Pacific time and `dataState=final`. `all` includes provisional data. CTR is a 0–1 fraction, not a percentage; average position is impression weighted. Google returns top rows and withholds anonymized queries. Never sum query rows to obtain site totals. `possiblyTruncated` means the requested row cap was reached, not proof that more rows exist; use `startRow` to page. Comparisons leave missing rows and their deltas null because absence is not necessarily zero. Keep the same search surface, dimensions and filters across periods. Avoid expensive page+query grouping when a single-page filter and query dimension will suffice.

Official references:
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
- https://developers.google.com/identity/protocols/oauth2/native-app
