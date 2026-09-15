# Perry's recipes

Read-only recipe site (Vite + React + TypeScript + Tailwind), eventually hosted
on GitHub Pages at `https://spectorp.github.io/recipes/`.

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

## Current status

- **Phase 1** — app shell, routing, Tailwind dark-mode setup, schema, empty data dirs
- **Phase 2** — LaTeX archived under `archive/latex/`

Next: data pipeline (build-time load + validation), then migrate recipes from TeX.
