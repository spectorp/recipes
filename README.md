# Recipes

Read-only recipe site (Vite + React + TypeScript + Tailwind), hosted on GitHub
Pages at **https://spectorp.github.io/recipes/**.

Recipes are stored as individual JSON files under `data/recipes/`. Editing
happens in git, not in the web UI.

See [docs/recipe-site-implementation-plan.md](docs/recipe-site-implementation-plan.md)
for the full build plan.

## Local development

```bash
npm install
npm run dev
```

Dev server: Vite prints a local URL. The app uses `base: '/recipes/'`, so open
that path (often `http://localhost:5173/recipes/`).

```bash
npm run build
npm run preview
```

## Deploy

Pushes to `master` run [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds the site and publishes `dist/` to GitHub Pages. In the repo:
**Settings → Pages → Source: GitHub Actions**.

## Data layout

| Path | Purpose |
| --- | --- |
| `data/recipes/*.json` | One recipe per file |
| `data/categories.json` | Canonical category vocab |
| `data/tags.json` | Canonical free-tag vocab |
| `schema.json` | JSON Schema for a recipe file |

## Archive

The previous LaTeX cookbook lives under
[`archive/latex/`](archive/latex/) (source, PDF, compile script). It is
historical reference only — not what the site serves.

## How the site loads recipes

At build/dev time, Vite bundles every `data/recipes/*.json` file (via
`import.meta.glob` in `src/lib/catalog.ts`). Each file is validated with Zod
(`src/lib/schema.ts`, matching `schema.json`). Bad files are skipped; the
browse page shows a warning if any were skipped.

## Current status

Phases 1–10 are done (app, data, browse/detail UI, print, theme, Pages deploy).
Phase 11 (polish) remains optional.
