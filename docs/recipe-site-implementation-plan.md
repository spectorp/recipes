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

GitHub Pages cannot list directories. Approach:

1. Keep one file per recipe under `data/recipes/`.
2. At **Vite build time**, glob `data/recipes/*.json`, validate, and emit a
   single module or JSON asset (e.g. `src/generated/recipes.ts` or
   `public/recipes-index.json` built into the bundle).
3. Also load `categories.json` and `tags.json` the same way (import or
   copy into the bundle).

Prefer **importing into the JS bundle** for v1 (simplest offline/cache
behavior, one deploy artifact). A Vite plugin or small `scripts/build-data.mjs`
run via `prebuild` is fine.

Optional later: commit a generated `data/recipes-index.json` for non-app
consumers; not required for v1 if the site builds its own index.

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
  tailwind.config.*
  .github/workflows/deploy.yml
  README.md
```

Move existing LaTeX/PDF/compile artifacts into `archive/latex/` early so the
repo root is app + data focused.

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

**SPA hosting note:** configure Pages / Actions so deep links don’t 404 on
refresh (e.g. `404.html` → `index.html` copy trick, or the Actions Pages
SPA fallback pattern documented for Vite).

### 4.3 Servings scaling (display-only)

- Stepper or multipliers next to servings
- Scale ingredient `amount` by `newServings / baseServings` for display only
- Round sensibly (e.g. 1 decimal); do not write JSON
- If `servings` is missing, hide the scaler (or disable with explanation)

### 4.4 Print / export PDF

- Print action on detail view → `window.print()`
- `@media print`: hide nav/filters/controls; show scaled amounts currently
  on screen; force light/black-on-white; include title, servings, times,
  ingredients, steps; attribution small at bottom; chips optional/omit
- No multi-recipe cookbook export in v1

### 4.5 Theme

- Light / dark / system; Tailwind `class` strategy on `<html>`
- Persist preference in `localStorage` (no `settings.local.json` — that was
  for the desktop app)

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

Move into `archive/latex/`:

- `perry_recipes.tex`
- `compile_recipes.sh`
- `perry_recipes.pdf` (and aux/out/synctex/log if kept)
- Related assets (e.g. `sous_vide_plot.jpg`)

Do not delete history; git move is enough. README should note the archive
is historical source, not the live cookbook.

### 6.2 Convert ~70 recipes

Source sections in TeX map roughly to `meal` / organization hints
(Breakfast, Soups, Pasta, …). Convert every `\subsection{...}` recipe into
`data/recipes/<id>.json`.

**Conversion rules:**

- Parse title → `id` slug; unique across the set
- Map freeform ingredient lines into `{ id, name, amount, unit, notes }`
  under the **strict** schema. Fractions (`1/4`) → numbers (`0.25`).
  Units normalized to the enum; countable → `unit: null`
- Steps → `{ id, text }` ordered list
- Attribution from lines like “Joy of Cooking” / “NY Times …” when present
- Seed `categories` / `tags` as best-effort during conversion (at least
  `meal` from the TeX section where obvious); leave arrays empty rather
  than inventing bad tags
- `servings` / times: set when the TeX states them; otherwise omit
- `rating`: omit unless you choose to set some
- `created_at` / `updated_at`: use migration date ISO timestamps if unknown
- Non-recipe content (e.g. “Sous Vide notes”) — either skip, or encode as a
  recipe-like note page only if it fits the schema cleanly; prefer skip or
  a dedicated `notes` recipe with empty ingredients only if useful

Update `categories.json` / `tags.json` as values are introduced.

Validate every file against `schema.json` / Zod before considering migration
done.

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

1. **Scaffold** — Vite React-TS app, Tailwind (dark mode), React Router,
   `base: '/recipes/'`, README stub, empty `data/` layout, `schema.json`
2. **Archive LaTeX** — move TeX/PDF/assets/script under `archive/latex/`
3. **Data pipeline** — build-time glob + Zod validation; load categories/tags
4. **Migrate recipes** — convert all TeX subsections → JSON + seed vocab
5. **Browse UI** — grid/list, search, facets, tags AND/OR, rating/attribution
   filters, sort; responsive shell
6. **Detail + deep links** — `/recipe/:id`, optional-field handling, SPA
   fallback for refresh
7. **Servings scaling** — display-only
8. **Print stylesheet** — light print layout, scaled amounts
9. **Theme** — light/dark/system + `localStorage`
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

No further product decisions are required to start Phase 1.
