# Recipes

Read-only recipe browser (Vite + React + TypeScript + Tailwind), hosted on
GitHub Pages at **https://spectorp.github.io/recipes/**.

The web UI does **not** create or edit recipes. All content changes happen in
git (JSON files), then deploy on push to `master`.

See [docs/recipe-site-implementation-plan.md](docs/recipe-site-implementation-plan.md)
for the full build plan.

## Local development

```bash
npm install
npm run dev
```

Open the `/recipes/` path Vite prints (often `http://localhost:5173/recipes/`).
The app’s `base` is `/recipes/` to match GitHub Pages.

```bash
npm run build
npm run preview
```

## Deploy

Pushes to `master` run [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
(build → publish `dist/`). Repo **Settings → Pages → Source: GitHub Actions**.

Live site: https://spectorp.github.io/recipes/

## Data layout

| Path | Purpose |
| --- | --- |
| `data/recipes/<id>.json` | One recipe per file; **filename must equal** `id` |
| `data/categories.json` | Canonical category vocab (names used in recipes) |
| `data/tags.json` | Canonical free-tag vocab |
| `schema.json` | JSON Schema for a recipe file |

## Adding or editing a recipe

1. Copy an existing file under `data/recipes/` or create `data/recipes/<id>.json`.
2. Set `"id"` to match the filename (without `.json`).
3. Fill `title`, `ingredients`, and `steps` (required). Optional: `servings`,
   times, `rating`, `attribution`, `notes`, `categories`, `tags`.
4. Use **vocab names** (not ids) for category values and tags. If you introduce
   a new value (e.g. a new cuisine), add it to `data/categories.json` or
   `data/tags.json` first.
5. Infer `categories.diet` from ingredients (see [AGENTS.md](AGENTS.md)).
6. Run `npm run build` to validate via Zod.
7. Commit and push to `master` — Actions deploys the site.

Do not invent ingredients or steps when importing from a source; map amounts
into the unit enum and put dual units / asides in `notes`.

### Ingredient units

Allowed `unit` values only:

`g`, `kg`, `ml`, `l`, `tsp`, `tbsp`, `cup`, `fl_oz`, `oz`, `lb`, `pinch`,
or `null` (countable items like “2 eggs”).

### Category keys

Recipes may set any of these under `categories` (arrays of string **names**):

| Key | Examples |
| --- | --- |
| `method` | stovetop, baking, sheet pan, wok, … |
| `diet` | vegetarian, vegan, pescatarian, gluten free, dairy free, nut free |
| `meal` | dinner, breakfast, side dish, … |
| `season` | summer, fall, … |
| `cuisine` | italian, french, chinese, … |
| `main_ingredient` | fish, chicken, tofu, … |

## How the site loads recipes

At build/dev time, Vite bundles every `data/recipes/*.json` file (via
`import.meta.glob` in `src/lib/catalog.ts`). Each file is validated with Zod
(`src/lib/schema.ts`, matching `schema.json`). Bad files are skipped; the
browse page shows a warning if any were skipped.

## Archive

The previous LaTeX cookbook lives under
[`archive/latex/`](archive/latex/) (source, PDF, compile script). Historical
reference only — not what the site serves.

## Status

Phases 1–11 are complete (app, data, browse/detail UI, print, theme, Pages
deploy, polish).
