# Leanne Digital — static site rebuild

Static site scaffold for collaborative work with Git.

## Local preview

```bash
python -m http.server 8081
```

Open http://localhost:8081/

## Generate coming-soon pages

After editing `scripts/site-config.mjs`, regenerate inner pages:

```bash
node scripts/generate-pages.mjs
```

Homepage (`index.html`) is hand-maintained. All other site pages use a shared coming-soon layout.

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
