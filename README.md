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
