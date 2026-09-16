# Recipe Site — Implementation Plan

A **read-only** recipe browser hosted on **GitHub Pages**. Recipes live as
individual JSON files in the repo; the site is a static SPA (Vite + React +
TypeScript + Tailwind). Creating, editing, and tagging happen by editing JSON
(and vocab files) in git and pushing — not via the web UI.

This document is the build spec for an AI coding agent. It supersedes
`docs/recipe-app-implementation-plan-old.md` for product direction. The old
plan remains useful as background for schema details and filter UX; where the
two conflict, **this document wins**.

**Decisions already locked:**

| Topic | Choice |
| --- | --- |
| Hosting | Public GitHub Pages (default) |
| Stack | Vite + React + TypeScript + Tailwind |
| Data | One JSON file per recipe; build-time index |
| Vocab | Canonical `categories.json` + `tags.json` |
| Schema | Strict (from old plan); **photos out of scope for v1** |
| Web mutations | None (no create / edit / tag management UI) |
| Migration | Convert all LaTeX recipes → JSON for v1 |
| LaTeX | Archive under `archive/latex/` |
| Deep links | Yes — stable per-recipe URLs |
| Responsive | Mobile, tablet, desktop |
| Privacy | Public site and public repo content |

### Progress

| Phase | Status |
| --- | --- |
| 1 Scaffold | Done |
| 2 Archive LaTeX | Done |
| 3 Data pipeline | Done |
| 4 Migrate recipes | Done |
| 5 Browse UI | Done |
| 6 Detail + deep links | Done |
| 7 Servings scaling | Done |
| 8 Print stylesheet | Done |
| 9 Theme | Done |
| 10–11 | Not started |

### Plan changelog (deviations & clarifications)

Keep this section updated when implementation diverges from the original text.

- **Tailwind v4 via `@tailwindcss/vite`** — no `tailwind.config.*` file; theme tokens live in `src/index.css` (`@theme`). (Phase 1)
- **Theme plumbing early** — `src/lib/theme.ts` + FOUC script in `index.html` land in Phase 1; full UI toggle remains Phase 9.
- **Theme toggle UI** — compact sun/moon icons on browse and detail pages; default preference is **system** (not shown as a control; click the active forced mode again to return to system). Preference in `localStorage` (`recipes-theme`). Hidden when printing. (Phase 9)
- **`archive/latex/compile_recipes.sh`** — `cd`s to its own directory so it works when invoked from elsewhere; small README in that folder. (Phase 2)
- **Auxiliary LaTeX build products** (`.aux`, `.log`, `.toc`) — not retained in the archive; only `.tex`, `.pdf`, `.out`, `.synctex.gz`, plot image, and compile script.
- **Catalog loading via `import.meta.glob`** — no separate `scripts/build-data.mjs` / generated `src/generated/` file. Vite eagerly imports `data/recipes/*.json` plus `categories.json` / `tags.json` into the JS bundle; Zod validates in `src/lib/catalog.ts`. (Phase 3)
- **LaTeX migration via `scripts/migrate-tex.mjs`** — automated parse of `archive/latex/perry_recipes.tex` into 69 recipe JSON files. Best-effort ingredient structuring (parentheticals/dual units often land in `name`/`notes`). Skipped **Sous Vide notes** (not a recipe). Hand-fixed Mapo Tofu + several mis-tagged `method` values after first pass. Re-running the script will overwrite manual fixes unless those edits are ported into the script. (Phase 4)
- **Anonymous site branding** — UI title/copy is “Recipes” (no personal name). Archive TeX filenames (`perry_recipes.*`) unchanged. Attribution “Lorraine Spector” → “Lorraine”.
- **Hosting URL** — stick with default GitHub Pages (`https://spectorp.github.io/recipes/`); no custom domain for now.
- **Browse filters** — client-side only; filter/search state and Filters panel open/closed live in a React context so they **persist** when opening a recipe and navigating back (not URL query params yet). **Search** sits beside the page title; sort/rating/source/facets live in a **collapsed-by-default** Filters panel. Search is **token AND** (whitespace-split; each token must match somewhere in title/id/tags/ingredients/categories); with a query, **title/id hits rank above** other-field hits, then the chosen sort. Facet checkboxes are **contextual**: only values that can still match given the other filters (plus currently selected). Facet **AND/OR** toggle applies **across** category columns + tags (within a column stays any-of); search / min rating / source stay hard ANDs. Default `facetMode: 'and'`. Fine at ~2k recipes (one catalog pass per facet group). (Phase 5+)
- **Detail header** — category/tag chips sit to the right of servings/times on the recipe page to save vertical space. Attribution (when present) sits in the same meta row as servings/times.
- **SPA deep-link fallback** — Vite plugin copies `dist/index.html` → `dist/404.html` so GitHub Pages refreshes on `/recipe/:id` still load the app. (Phase 6)
- **Detail layout** — on large screens, ingredients (sticky) sit beside instructions; stacked on smaller screens for cooking usability.
- **Servings scaling** — detail page shows fixed servings text (when known) next to times; that figure is always the written `1×` yield. Presets `0.5× / 1× / 1.5× / 2× / 3×` scale ingredient amounts only (no stepper). Scaled amounts do not write JSON. (Phase 7+)
- **Cooking checkboxes** — ingredients and instruction steps are checkable (local UI state only; clears on recipe change). Checked items gray out (no strikethrough).
- **Print** — detail-page Print button → `window.print()`; `@media print` forces light theme, hides nav/scaler/checkboxes/chips, keeps currently scaled amounts; **stacks** ingredients then steps (CSS grid does not fragment well and orphaned long titles on page 1). (Phase 8)

---

## 1. Tech Stack

- **Build / app:** Vite + React + TypeScript
- **Styling:** Tailwind CSS (incl. `dark:` class strategy)
- **Routing:** React Router (browser history), with GH Pages `base` set to
  the repo name (`/recipes/`)
- **Validation:** Zod at runtime (load); `schema.json` (JSON Schema) as the
  human/agent-facing source of truth — keep them in sync manually
- **State:** React Context or Zustand — no Redux
- **Search / filters:** Client-side over the in-memory recipe list
- **Print:** `window.print()` + `@media print` stylesheet
- **Deploy:** GitHub Actions → `actions/deploy-pages` (or equivalent) from
  `dist/` on push to `main`/`master`

No Tauri, no server, no database, no write APIs.

---

## 2. Data Model

### 2.1 Recipe files

One file per recipe: `data/recipes/<id>.json`.

```json
{
  "id": "pasta-carbonara",
  "title": "Pasta Carbonara",
  "categories": {
    "method": ["stovetop"],
    "diet": [],
    "meal": ["dinner"],
    "season": [],
    "cuisine": ["italian"],
    "main_ingredient": ["pasta", "eggs"]
  },
  "tags": ["quick", "date night"],
  "servings": 4,
  "prep_time_minutes": 10,
  "cook_time_minutes": 20,
  "ingredients": [
    {
      "id": "i1",
      "name": "spaghetti",
      "amount": 400,
      "unit": "g",
      "notes": ""
    },
    {
      "id": "i2",
      "name": "large eggs",
      "amount": 4,
      "unit": null,
      "notes": "room temperature"
    }
  ],
  "steps": [
    { "id": "s1", "text": "Bring a large pot of salted water to a boil." },
    { "id": "s2", "text": "..." }
  ],
  "rating": 4,
  "attribution": {
    "name": "Joe's Kitchen",
    "url": "https://example.com/carbonara-recipe"
  },
  "notes": "",
  "created_at": "2026-07-13T00:00:00Z",
  "updated_at": "2026-07-13T00:00:00Z"
}
```

**Field rules (same spirit as the old plan):**

- `id` — URL-safe slug from the title; numeric suffix on collision
  (`pasta-carbonara-2`). Filename must match `id` (`pasta-carbonara.json`).
- `unit` — enum only: `g`, `kg`, `ml`, `l`, `tsp`, `tbsp`, `cup`, `fl_oz`,
  `oz`, `lb`, `pinch`, or `null`. Countable items use `unit: null` and put
  the noun in `name` (e.g. `"garlic cloves"`).
- Amounts/units displayed as authored — **no unit conversion**.
- `categories` — fixed keys: `method`, `diet`, `meal`, `season`, `cuisine`,
  `main_ingredient`. Each is a string array (may be empty). Values must
  exist in `data/categories.json` (case-insensitive match; store canonical
  casing from the vocab file).
- `tags` — free-form; values should exist in `data/tags.json` the same way.
- `rating` — integer 0–5; omit or `null` = unrated.
- `attribution` — optional `{ name?, url? }`; either sub-field may be absent.
- **`photos` — not used in v1.** Do not require it in the schema. Optional
  empty array is fine if you want forward-compat, but the UI ignores it.

**Required fields:** `id`, `title`, `ingredients`, `steps`.

**Missing/optional field UI:** never show `"undefined"` / empty broken
sections. Omit missing times, servings, notes, attribution, rating as
needed. Empty category/tag arrays simply mean no chips for those.

### 2.2 `schema.json`

Place at repo root (or `data/schema.json` — pick one and document it in
README). Draft-07 JSON Schema matching Section 2.1. Required:
`id`, `title`, `ingredients`, `steps`. Ingredient items require
`id`, `name`, `amount`; `unit` enum as above. No required `photos`.

App validates with Zod on load; malformed files are skipped with a visible
dev/console warning (and ideally a small non-blocking UI notice in browse).

### 2.3 Categories & tags (canonical vocab)

**`data/categories.json`** — allowed values per fixed category key. Seed
from the old plan (method, diet, meal, season; cuisine / main_ingredient
can start sparse and grow during migration).

**`data/tags.json`** — flat free-form list.

Recipes store **names** (not vocab ids) for readability in diffs. Matching
for filters/dedup is **case-insensitive**; display casing comes from the
vocab file.

**Management:** edit these JSON files in git only. No rename/merge UI in the
site. When renaming a vocab value, update the vocab file **and** all recipe
files that use the old string (agent/human responsibility).

### 2.4 Loading recipes on a static host

GitHub Pages cannot list directories. **Implemented approach (Phase 3):**

1. Keep one file per recipe under `data/recipes/`.
2. `src/lib/catalog.ts` uses Vite `import.meta.glob('../../data/recipes/*.json', { eager: true })` so every recipe JSON is bundled at build/dev time.
3. Each file is validated with Zod (`src/lib/schema.ts`, kept in sync with `schema.json`). Filename must match `id`; duplicates and invalid files are skipped and collected in `catalogLoadErrors` (console + browse banner).
4. `data/categories.json` and `data/tags.json` are static imports, also Zod-validated.

No separate prebuild script or committed generated index for v1.

---

## 3. Repo Layout (target)

```
/
  archive/
    latex/                 # perry_recipes.tex, compile script, PDF, assets
  data/
    recipes/               # <id>.json — one per recipe
    categories.json
    tags.json
  schema.json              # recipe JSON Schema
  docs/
    recipe-site-implementation-plan.md   # this file
    recipe-app-implementation-plan-old.md
  src/                     # React app
  public/
  index.html
  package.json
  vite.config.ts
  .github/workflows/deploy.yml   # Phase 10
  README.md
```

LaTeX/PDF/compile artifacts are under `archive/latex/` (Phase 2 done). Tailwind
v4 is configured in CSS + the Vite plugin (no separate `tailwind.config` file).

---

## 4. Core Features (read-only web)

### 4.1 Browse / search

- Responsive recipe list/grid (cards: title, rating if present, key category
  chips, time/servings when present)
- Free-text search across title, ingredient names, tags, category values,
  attribution name
- **Faceted category filters** — one group per category. Within a category,
  multi-select is **OR**; across categories, **AND**
- **Tag filter** with **AND/OR toggle** (transient UI state is fine)
- Additional filters: minimum rating; attribution name / “has source link”
  vs none
- Sort by rating (and a sensible default, e.g. title A–Z)
- All client-side against the loaded list

### 4.2 Recipe detail + deep links

- Route: `/recipe/:id` (with Vite `base: '/recipes/'` → full path
  `/recipes/recipe/:id` on Pages)
- Full ingredients and steps; category/tag chips; times; servings; notes;
  attribution; static star display for rating
- Graceful handling of optional fields
- Shareable deep link; browser back returns to browse with filters
  restored if practical (URL query params for search/filters is nice-to-have
  for v1; in-memory restore via router state is acceptable)

**SPA hosting note:** ✅ Vite copies `index.html` → `404.html` on build so
GitHub Pages deep-link refreshes load the SPA.

### 4.3 Servings scaling (display-only)

**Done (Phase 7).** Written servings (when present) show as static text next to
times and always mean the `1×` yield. Decimal presets (`0.5×`, `1×`, `1.5×`,
`2×`, `3×`) scale ingredient amounts for display only. Ingredients and steps
also have checkboxes for cooking progress (session-only).

### 4.4 Print / export PDF

**Done (Phase 8).** Print button on the recipe detail view uses
`window.print()`. Print CSS hides interactive chrome (back link, scaler
controls, checkboxes, chips, Print button), forces black-on-white, and
prints the on-screen scaled ingredient amounts. Save as PDF via the OS print
dialog. No multi-recipe export.

### 4.5 Theme

**Done (Phase 9).** Light / Dark / System toggle on browse and detail pages.
Tailwind `class` strategy on `<html>`; preference stored in `localStorage`
(`recipes-theme`). FOUC-prevention script in `index.html`. Toggle is
`no-print`.

### 4.6 Explicitly out of scope (v1)

- Create / edit / delete recipes in the UI
- Category/tag management UI (add/rename/merge)
- Photos / image carousel
- Accounts, auth, private Pages
- Unit conversion
- Multi-recipe PDF export
- Offline PWA (optional later)

---

## 5. GitHub Pages Deploy

1. `vite.config.ts`: `base: '/recipes/'` (repo name is `spectorp/recipes`)
2. Workflow on push to default branch:
   - `npm ci` / `npm install`
   - `npm run build`
   - Upload `dist/` as Pages artifact and deploy
3. Repo Settings → Pages → Source: GitHub Actions
4. Site URL: `https://spectorp.github.io/recipes/`

Document local preview: `npm run dev` and `npm run build && npm run preview`
(with base path awareness).

---

## 6. LaTeX Migration

### 6.1 Archive

**Done (Phase 2).** Contents of `archive/latex/`:

- `perry_recipes.tex`
- `compile_recipes.sh` (cds to its own directory)
- `perry_recipes.pdf` (plus `.out` / `.synctex.gz`)
- `sous_vide_plot.jpg`
- `README.md`

Do not delete history; git move was used. Root README notes the archive is
historical source, not the live cookbook.

### 6.2 Convert ~70 recipes

**Done (Phase 4).** 69 recipes in `data/recipes/*.json`. Skipped: *Sous Vide
notes* (reference page, not a cookable recipe).

Conversion used `scripts/migrate-tex.mjs` (reproducible, but **re-running
overwrites** hand edits). Rules applied:

- Title → `id` slug; filename matches `id`
- Freeform ingredients → `{ id, name, amount, unit, notes }` (best-effort;
  some dual-unit lines still need manual cleanup)
- Steps from enumerate / prose instructions
- Attribution when a source line was present
- Categories/tags seeded from TeX section + light heuristics
- `created_at` / `updated_at` set to migration timestamp
- Vocab updated in `data/categories.json` / `data/tags.json`

All 69 files pass Zod (`recipeSchema`). `npm run build` succeeds.

### 6.3 Quality bar

- Site builds and lists all migrated recipes
- Spot-check a few complex ones (stews, Instant Pot, fractional cups)
- No required field missing; no invalid units

---

## 7. UI / UX Notes

- **One clear browse composition** on the home route: search + filters +
  results. Avoid dashboard clutter.
- Filter sidebar (desktop) collapses to a drawer/sheet on mobile
- Touch-friendly controls; readable type scale on small screens
- Detail view: ingredients then steps; sticky title/actions optional
- Empty states: no matches; zero recipes (shouldn’t happen post-migration)
- Accessible basics: labels on inputs, focus states, sufficient contrast in
  light and dark

Visual direction: clean cookbook/reader feel; not a SaaS dashboard. Prefer
a small intentional type + color system over default “AI purple” tropes.

---

## 8. Non-Functional

- **Graceful load errors:** bad JSON skipped; rest of catalog still works
- **No atomic writes / file watching** — N/A for static site; editing is git
- **Performance:** ~70 recipes is trivial in-memory; no search library needed
- **SEO:** minimal for v1 (optional later: prerender); title per route is enough

---

## 9. Build Phases

1. **Scaffold** — ✅ Vite React-TS app, Tailwind (dark mode), React Router,
   `base: '/recipes/'`, README stub, empty `data/` layout, `schema.json`
2. **Archive LaTeX** — ✅ move TeX/PDF/assets/script under `archive/latex/`
3. **Data pipeline** — ✅ `import.meta.glob` + Zod validation; load categories/tags
4. **Migrate recipes** — ✅ convert TeX subsections → JSON + seed vocab
5. **Browse UI** — ✅ grid/list, search, facets (AND/OR across groups), rating/attribution
   filters, sort; responsive shell
6. **Detail + deep links** — ✅ `/recipe/:id` full view, optional-field handling,
   SPA `404.html` fallback for refresh
7. **Servings scaling** — ✅ display-only
8. **Print stylesheet** — ✅ light print layout, scaled amounts
9. **Theme** — ✅ light/dark/system + `localStorage` UI
10. **Deploy** — GitHub Actions → Pages; verify live URL and deep links
11. **Polish** — empty states, mobile pass, README (edit recipes via JSON,
    vocab files, local dev, deploy)

---

## 10. README Should Cover (end state)

- How to run locally and where the live site is
- How to add/edit a recipe (new JSON file, schema, vocab updates, push)
- That the web UI is read-only
- Where archived LaTeX lives
- Unit enum and category keys

---

## 11. Open / deferred (not blocking v1)

- Photos (schema field + UI) later
- Filter state in the URL query string (nice for sharing filtered views)
- Prerender / better SEO
- Private hosting if requirements change
- Multi-recipe print

No further product decisions are required to continue with Phase 10.
