# Client hub deployment

`/clients/` is the staff client selector. Each `/clients/<slug>/` is a public hub with shareable `#reports` and `#packages` links. Proposals link to existing published proposals. Hosting appears only when the client record has `hosting.lddHosted` enabled. External hosting accounts belong in Credentials.

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
