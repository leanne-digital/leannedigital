# Connecting LLMs to Leanne Digital

Leanne Digital owns clients, projects, billing, leads, Calendly, and portfolio. Lilipadd does not.

Lilipadd is only for:

- Generic site analytics/conversions
- SEO/AEO publishing

Remote MCP for ChatGPT/Claude lives **in this repo** (authenticated HTTPS). Do not move agency models into Lilipadd.

If you want an external/cloud LLM connected through Lilipadd instead, prompt that in the Lilipadd project. Do not move agency data there.

---

## Run locally

```bash
npm run portal          # HTTP API + static site + remote MCP, http://127.0.0.1:4174
npm run portal:mcp      # Local MCP over stdio (Cursor / Claude Desktop)
npm test                # Remote MCP + HTTP regression checks
```

OpenAPI: `http://127.0.0.1:4174/api/openapi.json`  
Staff UI: `/admin/` after `/login/`

HTTP auth: session cookie `ld_portal`, or `X-API-Key` / `Authorization: Bearer` using `PORTAL_API_KEY`.  
Remote MCP auth: ChatGPT uses OAuth (see below). Manual tests may still use `Authorization: Bearer` with `REMOTE_MCP_API_KEY`.  
Do not put keys, passwords, or `data/portal-*.json` in frontend JS or public GPT instructions.

The client portal is a closed system. Staff add a client with a real email; the API creates a login and emails a set-password link (`/login/reset/?token=`). Clients then land on `/client-portal/` to change their password, complete onboarding (providers, not domain/hosting passwords), add extra apps like Mailchimp, and upload an avatar. Reports stay at `/clients/{slug}/`.

---

## Two kinds of “project”

| | Client/service project | Portfolio piece |
| --- | --- | --- |
| Meaning | Work you do for a client (SEO, hosting, maintenance, ads) | Public case study on `/portfolio/` |
| API | `/api/projects` | `/api/portfolio` |
| MCP | `list_projects`, `create_project`, … | `list_portfolio_projects`, … |
| Data | `data/client-projects.json` | `data/portfolio-projects.json` |

---

## Shared service layer

HTTP API and MCP both call `server/services/agency.mjs`. Do not add business logic inside `server/mcp.mjs` or duplicate it in route handlers.

```
HTTP API        ->  server/services/agency.mjs  ->  JSON files / Lilipadd adapter
Local stdio MCP ->  server/mcp-tools.mjs        ->  agency.mjs
Remote HTTP MCP ->  server/mcp-tools.mjs        ->  agency.mjs
```

Do not add business logic inside `server/mcp.mjs` or `server/mcp-http.mjs`.

---

Analytics is the exception: `get_site_statistics` / `get_site_conversions` **read** Lilipadd. This repo does not collect traffic.

Lilipadd credentials (backend `.env` only):

```
LILIPADD_API_URL=https://api.lilipadd.com
LILIPADD_API_KEY=<private tenant server key with stats:read>
LILIPADD_SITE_KEY=<public lp_ site key>
```

The adapter calls `GET {LILIPADD_API_URL}/api/public/v1/analytics?key={LILIPADD_SITE_KEY}&month=&view=` with `Authorization: Bearer {LILIPADD_API_KEY}`. Never put `LILIPADD_API_KEY` in the query string, HTML, or `platform.js`.

---

## HTTP API (staff unless noted)

**Existing (unchanged behaviour)**

- Auth: `/api/auth/login|logout|me|forgot|reset|password`
- `GET /api/portal/me` — signed-in user + their client profile (clients only)
- `PATCH /api/portal/profile` — client onboarding, contact, stack, and extra apps
- `GET|POST /api/portal/avatar` — account photo
- `POST /api/clients/{id}/invite` — staff resend set-password email
- `GET /api/dashboard` — retainer stats from client `services[]`
- `GET|POST /api/clients`, `GET|PATCH|DELETE /api/clients/{id}`
- `GET|POST /api/portfolio`, `PATCH|DELETE /api/portfolio/{slug}`
- `GET /api/inbox`, `PATCH /api/leads`
- `GET /api/calendly`, `POST /api/webhooks/calendly`
- `GET /api/admin/dashboard`

**Client/service projects**

- `GET /api/projects?client=&serviceType=&status=`
- `POST /api/projects`
- `GET /api/projects/{id}`
- `PATCH /api/projects/{id}`
- `POST /api/projects/{id}/pause|resume|complete`
- `GET|POST /api/projects/{id}/updates`

**Revenue (from active client projects)**

- `GET /api/revenue?month=2026-08`
- `GET /api/revenue/by-service?month=`
- `GET /api/revenue/clients/{id}?month=`

**SEO clients**

- `GET /api/clients/seo`
- `GET /api/clients?serviceType=seo`

**Analytics (Lilipadd read)**

- `GET /api/analytics/statistics?month=YYYY-MM`
- `GET /api/analytics/conversions?month=YYYY-MM`

These proxy to Lilipadd. Missing/invalid Lilipadd credentials return `{ available: false, reason }` instead of throwing.

---

## Local MCP

Cursor / Claude Desktop use stdio. This is **not** reachable from the public internet.

```bash
npm run portal:mcp
```

```json
{
  "mcpServers": {
    "leanne-digital": {
      "command": "node",
      "args": ["server/mcp.mjs"],
      "cwd": "C:/Cursor Projects/Leanne Digital"
    }
  }
}
```

Local stdio is treated as staff. Keep it on a trusted machine.

### Tools

Read tools (`[read]`, `readOnlyHint`) do not change data. Write tools (`[write]`) do. Destructive tools require `confirm=true`.

| Tool | Kind | Maps to |
| --- | --- | --- |
| `list_clients` / `get_client` / `list_seo_clients` | read | Clients |
| `create_client` / `update_client` | write | Clients |
| `delete_client` | write, destructive | Clients |
| `list_projects` / `get_project` / `list_project_updates` | read | Client/service projects |
| `create_project` / `update_project` / `pause_project` / `resume_project` / `complete_project` / `add_project_update` | write | Client/service projects |
| `get_monthly_revenue` / `get_client_revenue` / `get_revenue_by_service` / `portal_dashboard` | read | Revenue |
| `get_site_statistics` / `get_site_conversions` | read | Lilipadd analytics adapter |
| `list_portfolio_projects` | read | Public portfolio |
| `create_portfolio_project` / `update_portfolio_project` | write | Public portfolio |
| `delete_portfolio_project` | write, destructive | Public portfolio |
| `list_form_submissions` | read | Leads |
| `set_lead_status` | write | Leads |
| `list_calendly_bookings` | read | Calendly webhook store |

---

## Remote MCP

Standards-based **Streamable HTTP** (MCP SDK 1.30), mounted on the existing portal Node server. Same tools as local stdio via `server/mcp-tools.mjs` → `server/services/agency.mjs`. Local stdio is unchanged and does not use OAuth.

The MCP endpoint is an OAuth 2.1 **resource server**. Authorization (login, consent, tokens, DCR) is a Better Auth **OAuth 2.1 Provider**, not the MCP SDK's frozen authorization-server helpers.

```
ChatGPT
  → POST https://leannedigital.com/mcp  (no token)
  ← 401 WWW-Authenticate resource_metadata=...
  → GET /.well-known/oauth-protected-resource/mcp
  → GET /.well-known/oauth-authorization-server
  → POST /oauth/oauth2/register          (dynamic client registration)
  → GET  /oauth/oauth2/authorize         (Authorization Code + S256 PKCE)
  → staff signs in at /oauth/login and Allow at /oauth/consent
  ← redirect with code
  → POST /oauth/oauth2/token
  ← access_token + refresh_token
  → POST https://leannedigital.com/mcp   Authorization: Bearer <access_token>
```

### Endpoint

| Environment | URL |
| --- | --- |
| Local | `http://127.0.0.1:4174/mcp` |
| Production | `https://leannedigital.com/mcp` |

Do **not** proxy the whole Node portal publicly. Reverse-proxy only `/mcp` plus the OAuth discovery and `/oauth` routes listed below. Leave `/admin`, `/clients`, and `/api/*` (except OAuth) off the public vhost.

### Authentication

`/mcp` accepts either:

1. `Authorization: Bearer <REMOTE_MCP_API_KEY>` for manual/server-to-server tests (`X-MCP-API-Key` is still an alias)
2. `Authorization: Bearer <OAuth access token>` issued by Better Auth after staff consent

`PORTAL_API_KEY`, Lilipadd keys, portal session cookies, and the static MCP key are **not** OAuth tokens. The static key is never returned by the token endpoint and must not be given to ChatGPT.

Missing/invalid credentials return **401** with:

```
WWW-Authenticate: Bearer realm="mcp", error="invalid_token", ..., resource_metadata="https://leannedigital.com/.well-known/oauth-protected-resource/mcp"
```

Tokens missing `mcp:read` return **403** `insufficient_scope`. If neither `REMOTE_MCP_API_KEY` nor OAuth (`OAUTH_SECRET`) is configured, `/mcp` returns **503**.

`REMOTE_MCP_READ_ONLY=1` remains the final authority on whether write tools are registered. OAuth currently grants only `mcp:read` (plus `offline_access` for refresh). A future `mcp:write` scope can be added without rewriting tools.

Only the OAuth admin / portal **staff** identity can approve access. Client portal users are rejected on the login and consent screens.

### Discovery URLs (production)

| Document | URL |
| --- | --- |
| Protected resource metadata (RFC 9728) | `https://leannedigital.com/.well-known/oauth-protected-resource/mcp` |
| Authorization server metadata (RFC 8414) | `https://leannedigital.com/.well-known/oauth-authorization-server` |
| JWKS (asymmetric access-token signing) | `https://leannedigital.com/oauth/jwks` |

### OAuth endpoints

Better Auth is mounted at `/oauth` so it does not collide with the portal's `/api/auth/*`.

| Use | Path |
| --- | --- |
| Authorization | `https://leannedigital.com/oauth/oauth2/authorize` |
| Token | `https://leannedigital.com/oauth/oauth2/token` |
| Dynamic client registration | `https://leannedigital.com/oauth/oauth2/register` |
| Token revocation | `https://leannedigital.com/oauth/oauth2/revoke` |
| Token introspection | `https://leannedigital.com/oauth/oauth2/introspect` |
| Staff login | `https://leannedigital.com/oauth/login` |
| Consent | `https://leannedigital.com/oauth/consent` |

Discovery metadata advertises the live authorization/token/registration URLs. Public clients use PKCE (`S256`). Redirect URIs are exact-match. The authorization endpoint always returns an HTTP 302 (Better Auth's JSON `{redirect,url}` responses are converted) so ChatGPT and other browser clients keep the signed query across login and consent.

`validAudiences` is a single value (`OAUTH_RESOURCE`) so a client cannot request a token for another resource. Better Auth 1.6 binds `aud` at the token endpoint; 1.7+ binds it to the authorization grant as well.

### Scopes

| Scope | Meaning |
| --- | --- |
| `mcp:read` | Required to call the remote MCP (read tools only) |
| `offline_access` | Refresh token so ChatGPT can stay connected |
| `mcp:write` | **Not granted.** Reserved for a later change; `REMOTE_MCP_READ_ONLY=1` still wins |

Protected resource / audience: `https://leannedigital.com/mcp`

### Refresh tokens

Refresh tokens are issued when `offline_access` is granted. They last 30 days by default (`OAUTH_REFRESH_TOKEN_TTL`). Better Auth rotates the refresh token on each refresh. Access tokens are short-lived (15 minutes by default, `OAUTH_ACCESS_TOKEN_TTL`).

### Client ID Metadata Documents

Better Auth has a separate `@better-auth/cimd` plugin. It is **not** enabled here. ChatGPT's current custom-plugin OAuth flow uses Dynamic Client Registration, which is enabled for public clients with PKCE. CIMD can be added later without changing MCP tools.

### Environment variables

```
REMOTE_MCP_API_KEY=<long random token>
REMOTE_MCP_READ_ONLY=1
REMOTE_MCP_RATE_LIMIT_PER_MIN=60
PORTAL_API_PORT=4174
PORTAL_BIND=127.0.0.1

OAUTH_ISSUER=https://leannedigital.com
OAUTH_RESOURCE=https://leannedigital.com/mcp
OAUTH_DATA_DIR=/home/leannedigital.com/private/oauth
OAUTH_SECRET=<32+ random bytes>
OAUTH_ADMIN_EMAIL=gary@leannedigital.com
OAUTH_ADMIN_PASSWORD=<new password, not the portal bootstrap password>
```

Never commit real secrets. Never put `REMOTE_MCP_API_KEY`, `OAUTH_SECRET`, or `OAUTH_ADMIN_PASSWORD` in HTML or `platform.js`.

OAuth data (SQLite, JWKS private keys, sessions, registered clients, tokens) lives in `OAUTH_DATA_DIR`. Local default is gitignored `runtime/oauth`. Production must be a directory **outside** `/opt/sites/leannedigital`, for example:

```bash
sudo mkdir -p /home/leannedigital.com/private/oauth
sudo chown leannedigital.com:leannedigital.com /home/leannedigital.com/private/oauth
sudo chmod 700 /home/leannedigital.com/private/oauth
```

Do not create that production directory from this repo.

### OpenLiteSpeed paths to proxy to `127.0.0.1:4174`

Proxy these prefixes (plus trailing-slash variants as needed):

**MCP / OAuth**

- `/mcp`
- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`
- `/oauth`

**Client portal login** (same `leannedigital-mcp` proxy handler)

- `/api/auth`
- `/api/portal`
- `/api/clients`

Do not proxy `/admin` or `/clients` — those stay static HTML. Node still gates them with the session cookie once `/api/auth` is reachable.

### Local OAuth test procedure

```bash
# .env: REMOTE_MCP_API_KEY, OAUTH_SECRET (32+ chars), OAUTH_ADMIN_EMAIL, OAUTH_ADMIN_PASSWORD
npm run portal
npm test
```

`npm test` runs the existing remote-MCP checks and the OAuth Authorization Code + PKCE suite. OAuth tests keep `REMOTE_MCP_READ_ONLY=1`.

Manual static-key check:

```bash
curl -sS http://127.0.0.1:4174/mcp \
  -H "Authorization: Bearer $REMOTE_MCP_API_KEY" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

Unauthenticated discovery check:

```bash
curl -sSI http://127.0.0.1:4174/mcp
curl -sS http://127.0.0.1:4174/.well-known/oauth-protected-resource/mcp
curl -sS http://127.0.0.1:4174/.well-known/oauth-authorization-server
```

### Production testing

After TLS + the LiteSpeed paths above:

```bash
curl -sSI https://leannedigital.com/mcp
curl -sS https://leannedigital.com/.well-known/oauth-protected-resource/mcp
curl -sS https://leannedigital.com/.well-known/oauth-authorization-server
```

Static key (ops only, not ChatGPT):

```bash
curl -sS https://leannedigital.com/mcp \
  -H "Authorization: Bearer $REMOTE_MCP_API_KEY" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_seo_clients","arguments":{}}}'
```

### Deploy

This repo has no automatic production deploy. After code is on the host:

1. Create `OAUTH_DATA_DIR` outside the site tree with mode `700`.
2. Set the OAuth env vars on the systemd unit (not in Git). Use a new `OAUTH_ADMIN_PASSWORD`; do not reuse the earlier portal bootstrap password.
3. Keep `PORTAL_BIND=127.0.0.1`, `REMOTE_MCP_READ_ONLY=1`, and `REMOTE_MCP_API_KEY` for ops testing.
4. Restart the Node systemd service.
5. Add the OpenLiteSpeed proxy paths listed above. Do not expose the rest of the portal.
6. Confirm discovery URLs over HTTPS, then complete the ChatGPT plugin form.

Do not deploy automatically from this task.

### ChatGPT (custom plugin / Developer Mode)

1. Enable Developer Mode / custom MCP connectors.
2. New plugin:
   - **Name:** Leanne Digital
   - **Server URL:** `https://leannedigital.com/mcp`
   - **Authentication:** OAuth
3. ChatGPT should scan `/mcp`, follow `resource_metadata`, register as a public client, and open `/oauth/oauth2/authorize`.
4. Sign in with `OAUTH_ADMIN_EMAIL` / `OAUTH_ADMIN_PASSWORD` and click **Allow**.
5. ChatGPT stores access + refresh tokens and lists MCP tools.
6. ChatGPT cannot use `npm run portal:mcp` (stdio).

Claude and other MCP clients can use the same Streamable HTTP endpoint with either OAuth or the static Bearer key.

---

---

## Data files

| File | What |
| --- | --- |
| `data/portal-clients.json` + `data/clients.json` | Client CRM / retainers |
| `data/client-projects.json` | Agency projects (seeded once from retainers) |
| `data/client-project-updates.json` | Chronological project history |
| `data/portfolio-projects.json` | Public portfolio |
| `data/contact-inbox.jsonl` | Form submissions (gitignored) |
| `data/lead-status.json` | Lead pipeline (gitignored) |
| `runtime/oauth/` (gitignored) or `OAUTH_DATA_DIR` | Better Auth SQLite: users, sessions, OAuth clients, tokens, JWKS |

---

## Still required before ChatGPT can use this in production

1. Public HTTPS already exists at `https://leannedigital.com/mcp`. Add LiteSpeed proxy paths for `/.well-known/oauth-*` and `/oauth`.
2. Set `OAUTH_ISSUER`, `OAUTH_RESOURCE`, `OAUTH_SECRET`, `OAUTH_ADMIN_EMAIL`, `OAUTH_ADMIN_PASSWORD`, and `OAUTH_DATA_DIR` on the systemd service.
3. Create the OAuth data directory outside the site tree (`chmod 700`).
4. Restart Node, confirm discovery URLs, then use ChatGPT **Authentication: OAuth** with Server URL `https://leannedigital.com/mcp`.
5. Keep `REMOTE_MCP_API_KEY` for ops testing only. Do not paste it into ChatGPT.
6. Do not copy client/project/revenue models into Lilipadd.

Analytics read is already on Lilipadd (`GET /api/public/v1/analytics`). This repo only consumes it.
