# Leanne Digital — static site rebuild

Static site scaffold for collaborative work with Git.

## Local preview

```bash
python -m http.server 8081
```

Open http://localhost:8081/

## Simply Static comparison copy

The WordPress export lives in `_import/` (zip + extracted site). Keep it there so we can compare the rebuild against the original:

```bash
python -m http.server 8082 --directory _import/simply-static
```

Open http://localhost:8082/ beside the rebuild.

## Generate coming-soon pages

After editing `scripts/site-config.mjs`, regenerate inner pages:

```bash
node scripts/generate-pages.mjs
```

Homepage (`index.html`) is hand-maintained. About, contact, and blog are hand-built or generated separately.

## Blog posts

Import content from the live site (one-time or when posts change):

```bash
node scripts/import-blog.mjs
node scripts/generate-blog.mjs
```

Posts live at root slugs (e.g. `/what-even-is-seo/`). Images are stored in `assets/images/blog/` — no WordPress upload paths.

## Portfolio

Import projects and regenerate pages:

```bash
node scripts/import-portfolio.mjs
node scripts/generate-portfolio.mjs
```

Project pages live at `/projects/{slug}/`. Images go in `assets/images/portfolio/`.

## Service pages

Import service page content and regenerate:

```bash
node scripts/import-services.mjs
node scripts/generate-services.mjs
```

Pages live at paths like `/website-design/`, `/seo/`, etc. Images go in `assets/images/services/`.

## Git workflow (Gary + Leanne)

1. Clone: `git clone https://github.com/leanne-digital/leannedigital.git`
2. Work on feature branches (`feature/hero`, `feature/trust-bar`, etc.)
3. Open pull requests into `main`
4. Pull `main` often to avoid merge conflicts

## Lilipadd integration

Analytics and SEO metadata are managed in the [Lilipadd](https://github.com/xar86413/lilipadd) hub (`C:\Cursor Projects\Lilipadd`). The static site embeds one tracking snippet.

**First-time setup** (from `Lilipadd`, with DB running):

```bash
npm run migrate
npm run seed
npm run seed:leannedigital   # writes .env here with LILIPADD_SITE_KEY
```

Staff analytics **read** (optional) also needs a private Lilipadd server key on this backend only:

```
LILIPADD_API_URL=https://api.lilipadd.com
LILIPADD_API_KEY=<tenant server key, stats:read>
LILIPADD_SITE_KEY=<public lp_ site key>
```

Do not put `LILIPADD_API_KEY` in HTML or `platform.js`. See [connection.md](connection.md).

**Apply snippet to all pages:**

```bash
copy .env.example .env       # only if seed:leannedigital was not run
npm run integrate            # patches hand-built pages + regenerates HTML
```

For production, run `npm run integrate:prod` before deploy (uses `api.lilipadd.com`).

Connecting an LLM to **clients, projects, and revenue** is this repo: local stdio (`npm run portal:mcp`) or remote Streamable HTTP (`/mcp`). See [connection.md](connection.md). Lilipadd remains generic site infrastructure (analytics collection, SEO publishing). Do not put `REMOTE_MCP_API_KEY` in HTML.

## Structure

```
index.html                 # Homepage (full hero)
about/index.html           # Coming soon pages
...
css/
js/site-nav.js
scripts/site-config.mjs
scripts/generate-pages.mjs
assets/images/
```


### Client records and portal access

`create_client` (MCP) and `POST /api/clients` create only the client record and service projects. They never provision portal users, generate temporary passwords, or send invitations, even if legacy account flags/passwords are supplied. Saving a client and starting the server also do not provision missing client accounts.

Portal access requires two separate explicit requests:
1. Use `create_client_portal_account`, `POST /api/clients/{id}/account`, or the admin **Create portal account (no email)** button. This creates a login without sending email.
2. Use `invite_client`, `POST /api/clients/{id}/invite`, or **Send login link** to explicitly send an invitation. An existing account with a real email is required.

Existing invitation revocation: there is no dedicated revoke API, MCP tool, or admin control. Invitations are hashed password-reset tokens in the private `data/portal-resets.json` store. An operator can invalidate a link by removing its matching token row (or all rows for that user, which also revokes password-reset links). Sending a new invitation does **not** revoke previous tokens. Tokens expire, and using one consumes only that token. Revoking a token does not disable an existing account or session. No live invitations were revoked during this change.

Validation: `node scripts/test-client-crud.mjs` runs in a temporary copy with email transport blocked; it checks record-only creation/update, explicit account creation, rejection of invitations without an account, and invalidation of a removed token. No invitation emails are sent by this test.
