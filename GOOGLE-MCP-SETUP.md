# Google verification for MCP

Google verifies the staff identity; Leanne Digital issues the MCP access token after consent. Only the configured OAUTH_ADMIN_EMAIL or existing portal staff accounts can sign in. A Google-verified email is required. Google sign-in does not grant access to Gmail or Drive.

Create a Google Cloud OAuth client of type Web application with this exact authorized redirect URI:

    https://leannedigital.com/oauth/callback/google

Set these in the private environment of the portal API service, outside Git and the public web root:

    OAUTH_GOOGLE_CLIENT_ID=<Google OAuth client ID>
    OAUTH_GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
    OAUTH_ISSUER=https://leannedigital.com
    OAUTH_RESOURCE=https://leannedigital.com/mcp
    OAUTH_ADMIN_EMAIL=gary@leannedigital.com

Keep the existing OAUTH_SECRET stable. Restart the portal API after updating code and environment. If Google's consent application is in testing, add approved staff as test users. Never paste the client secret into chat or commit it.

The front proxy must route /oauth/*, /mcp and /.well-known/oauth-* to the portal API. Verify /.well-known/oauth-authorization-server and /.well-known/oauth-protected-resource/mcp return JSON before connecting the MCP client to https://leannedigital.com/mcp.

Complete a real Google sign-in, approve consent, then check a hosting total. An unapproved Google account must be refused. Credential updates additionally require mcp:credentials:write; Google sign-in alone does not grant that scope. Existing staff password sign-in remains available.

Local automated coverage: node scripts/test-google-oauth.mjs and node scripts/test-mcp-oauth.mjs. The Google test uses fake configuration to verify the authorization redirect, CSRF protection, state, PKCE, and staff policy; it does not exchange a real Google authorization code.
