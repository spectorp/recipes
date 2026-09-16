# Agent guide — recipes site

This repo is a **read-only** recipe browser (Vite + React + TypeScript + Tailwind)
backed by **one JSON file per recipe**, hosted on public GitHub Pages
(`https://spectorp.github.io/recipes/`).

Editing/creating recipes happens in git (JSON files), not in the web UI.

Primary build plan: [`docs/recipe-site-implementation-plan.md`](docs/recipe-site-implementation-plan.md)
(keep its Progress / Plan changelog updated when behavior diverges).

---

## Diet tags

When setting `categories.diet`, infer from **ingredients** (not vibes):

- `vegan` — no meat/fish, dairy, eggs, or honey; also include `vegetarian` and `pescatarian`
- `vegetarian` — no meat/fish (eggs/dairy/honey OK); also include `pescatarian`
- `pescatarian` — no land meat (chicken, beef, pork, etc.) or land-meat stocks/bases; fish/seafood OK; include for vegetarian/vegan recipes too
- `dairy free` / `gluten free` / `nut free` — based on ingredients present
- `nut free` — no tree nuts or peanuts (coconut OK unless the recipe is clearly nut-focused); optional “or nuts” notes count as containing nuts
- Do not invent diet claims that conflict with listed ingredients
- Re-check after ingredient edits

---

## Hard rule: do not invent recipe content

When importing or updating recipes from a source (LaTeX, MasterCook, PDF, paste,
NYT printout, etc.):

- **Do not invent or inventively rewrite ingredients or instructions.**
- Preserve the author’s amounts, units, ingredient names, and step text as
  closely as the schema allows.
- Allowed interpretation:
  - Mapping freeform quantities into the strict schema (`amount` number or
    `null` + `unit` enum or `null`)
  - Putting parentheticals / dual units into `notes`
  - Choosing `categories` / `tags` / `attribution` metadata
  - Normalizing obvious typos in titles only when asked
- **Do not invent amounts.** If the source has no quantity (e.g. “to taste”,
  “for serving”, bare “salt”, “Whole-grain bread, for serving”), set
  `amount: null`. Never default missing amounts to `1`.
- `pinch` only when the source says pinch (or equivalent); then
  `amount: 1`, `unit: "pinch"` is fine. “Salt to taste” → `amount: null`,
  not a fake pinch.
- If the source is **incomplete** (e.g. ingredients but no steps):
  - Still import what exists
  - Put a clear note in `notes` that steps were missing
  - **Do not fabricate steps** to “fill in” the recipe
  - Ask the user for the missing content
- If you must lightly rephrase for grammar while converting MasterCook/PDF
  line breaks, keep meaning identical — never add techniques, times, or
  ingredients that were not in the source.

---

## Recipe data model

- Files: `data/recipes/<id>.json` — **filename must equal** `id`
- Schema: [`schema.json`](schema.json) (human/agent source of truth)
- Runtime validation: Zod in [`src/lib/schema.ts`](src/lib/schema.ts) via
  [`src/lib/catalog.ts`](src/lib/catalog.ts)
- Vocab: [`data/categories.json`](data/categories.json),
  [`data/tags.json`](data/tags.json) — recipes store **names**, not vocab ids
- Units enum only: `g`, `kg`, `ml`, `l`, `tsp`, `tbsp`, `cup`, `fl_oz`, `oz`,
  `lb`, `pinch`, or `null` (countables)
- `amount` — number, or `null` when the source gives no quantity; UI omits
  the quantity and does not scale null amounts
- Optional fields (`servings`, times, `rating`, `attribution`, `notes`, empty
  category arrays) may be omitted; UI must degrade gracefully
- Photos: out of scope for current site

After adding/changing recipes, run `npm run build` (catalog loads at build time
via Vite `import.meta.glob`).

---

## App architecture (short)

| Path | Role |
| --- | --- |
| `src/pages/HomePage.tsx` | Browse: search, facets (AND/OR across groups), sort |
| `src/lib/BrowseState.tsx` | Persists browse filters + Filters panel open across recipe navigation |
| `src/pages/RecipePage.tsx` | Detail: scale servings, checkboxes, print |
| `src/lib/catalog.ts` | Eager-load + Zod-validate all recipe JSON |
| `src/lib/filterRecipes.ts` | Client-side filter/sort |
| `vite.config.ts` | `base: '/recipes/'`; copies `404.html` for SPA deep links |
| `archive/latex/` | Historical TeX cookbook (not live data) |

Local: `npm install && npm run dev` → open the `/recipes/` path Vite prints.

---

## Import workflow tips

1. Put source files under a local folder (e.g. `incoming-recipes/`, gitignored).
2. Extract text from PDFs if needed (`pypdf` in a throwaway venv is fine;
   don’t commit `.venv-pdf`).
3. Convert to schema-valid JSON; update vocab files when introducing new
   category/tag values.
4. Validate with build / Zod; fix schema issues without changing culinary
   content.
5. Delete or leave `incoming-recipes/` locally — do not commit large PDFs.

LaTeX migration used `scripts/migrate-tex.mjs`. **Do not re-run it blindly** —
it overwrites hand edits.

---

## Product constraints (don’t regress)

- Read-only web UI (no create/edit/tag management in the app)
- Public GitHub Pages (default `*.github.io` URL)
- Anonymous branding (“Recipes”, not a personal name)
- Print: black-on-white, scaled amounts, stacked layout (grid orphans titles)
- Theme: light / dark / system in `localStorage`

---

## When updating the plan doc

If implementation diverges from
`docs/recipe-site-implementation-plan.md`, update that file’s **Plan
changelog** and Progress table in the same change.
