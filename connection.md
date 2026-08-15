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
Remote MCP auth: `Authorization: Bearer` using `REMOTE_MCP_API_KEY` (not the portal key, not a Lilipadd site key).  
Do not put keys, passwords, or `data/portal-*.json` in frontend JS or public GPT instructions.

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

- Auth: `/api/auth/login|logout|me|forgot|reset`
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

Standards-based **Streamable HTTP** (MCP SDK), mounted on the existing portal Node server. Same tools as local stdio via `server/mcp-tools.mjs` → `server/services/agency.mjs`. Local stdio is unchanged.

### Endpoint

| Environment | URL |
| --- | --- |
| Local | `http://127.0.0.1:4174/mcp` |
| Production (recommended) | `https://mcp.leannedigital.com/mcp` |

`leannedigital.com` stays the static marketing site. Put MCP on a dedicated subdomain (or reverse-proxy only `/mcp`) so the Node process is not the public website.

### Authentication

```
Authorization: Bearer <REMOTE_MCP_API_KEY>
```

`X-MCP-API-Key` is accepted as an alias. `PORTAL_API_KEY`, Lilipadd public site keys, and session cookies are **not** valid here. Missing/invalid tokens return **401**. If `REMOTE_MCP_API_KEY` is unset, the endpoint returns **503**.

This is a dedicated credential so a ChatGPT connector leak does not unlock the staff HTTP API. OAuth can replace `authenticateRemoteMcp()` later without rewriting tools.

### Environment variables

```
REMOTE_MCP_API_KEY=<long random token>
# optional
REMOTE_MCP_READ_ONLY=1
REMOTE_MCP_RATE_LIMIT_PER_MIN=60
PORTAL_API_PORT=4174
PORTAL_BIND=127.0.0.1
```

Never commit real secrets. Never put `REMOTE_MCP_API_KEY` in HTML or `platform.js`.

### Local testing

```bash
# .env must include REMOTE_MCP_API_KEY
npm run portal
npm test
```

```bash
curl -sS http://127.0.0.1:4174/mcp \
  -H "Authorization: Bearer $REMOTE_MCP_API_KEY" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

Then `tools/list` and `tools/call` with the same Bearer header.

### Production testing

After TLS + reverse proxy:

```bash
curl -sS https://mcp.leannedigital.com/mcp \
  -H "Authorization: Bearer $REMOTE_MCP_API_KEY" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_clients","arguments":{}}}'
```

### Deploy

This repo has no automatic production deploy for the Node portal. Recommended model:

1. Run `npm run portal` (or a process manager) on the app host, bound to `127.0.0.1:4174`.
2. Point `mcp.leannedigital.com` at that host.
3. Reverse-proxy `https://mcp.leannedigital.com/mcp` → `http://127.0.0.1:4174/mcp` with TLS.
4. Set `REMOTE_MCP_API_KEY` in the process environment only.
5. Do not expose `data/`, `.env`, or the staff UI on that public hostname unless you intend to.

Do not deploy automatically from this task.

### ChatGPT (Developer Mode)

1. Enable Developer Mode / custom MCP connectors.
2. Add a remote MCP server URL: `https://mcp.leannedigital.com/mcp` (or your tunnel URL while testing).
3. Authentication: Bearer token = `REMOTE_MCP_API_KEY`.
4. ChatGPT cannot use `npm run portal:mcp` (stdio).

Until the hostname has public HTTPS, ChatGPT cannot reach it. Workspace OAuth (CIMD) is not implemented yet; Bearer is the current auth. If ChatGPT requires OAuth for your plan, that still needs to be added in front of the same tool layer.

Claude and other MCP clients use the same Streamable HTTP endpoint.

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
| `data/calendly-bookings.json` | Bookings (gitignored) |

---

## Still required before ChatGPT can use this in production

1. Public HTTPS URL (DNS + TLS reverse proxy to the Node portal `/mcp`).
2. `REMOTE_MCP_API_KEY` set on the server (not in the browser).
3. ChatGPT custom MCP / Developer Mode connector pointed at that URL.
4. OAuth only if your ChatGPT plan refuses static Bearer tokens — the tool layer does not need a rewrite.
5. Do not copy client/project/revenue models into Lilipadd.

Analytics read is already on Lilipadd (`GET /api/public/v1/analytics`). This repo only consumes it.
