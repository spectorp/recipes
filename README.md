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

Dev server: Vite will print the local URL. The app uses `base: '/recipes/'`,
so open the path Vite reports (often including `/recipes/`).

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

## Current status

**Phase 1 (scaffold)** — app shell, routing, Tailwind dark-mode setup, empty
data dirs, schema. No recipe catalog or deploy workflow yet.

LaTeX sources still live at the repo root for now; Phase 2 moves them to
`archive/latex/`.
