# Recipe Manager — Implementation Plan

A local-first, Tauri-based recipe management app. Single writer (you), read-only
for anyone else who clones the repo. Recipes stored as JSON files, photos stored
in a local folder on disk, git used for version history/distribution
(not hosting).

Photos are assumed to exist on the local machine at a configured path. This
may move to Google Drive or another sync solution in the future — the photo
resolution logic should be written so that swapping the storage location
later doesn't require touching the recipe schema (see Section 4).

This document is written to hand off to an AI coding agent (Cursor / Claude Code)
as a build spec. Where a decision genuinely needs the human's input, it's flagged
as an **Open Question** rather than assumed.

---

## 1. Tech Stack

- **Shell:** Tauri 2.x (Rust backend + webview frontend)
- **Frontend:** React + TypeScript + Tailwind CSS
  - Recommended over Svelte/Vue only because it's the most likely to have the
    fewest surprises for an AI coding agent working iteratively. Swap freely
    if you have a preference.
- **Data:** JSON files on disk, read/written via Tauri's fs APIs (not a database)
- **Photos:** Referenced by relative path, resolved against a user-configured
  local folder (see Section 4). Missing photos degrade gracefully rather
  than breaking the app.
- **State management:** React Context or Zustand — avoid Redux, overkill for
  this scope
- **Search:** Client-side, in-memory filtering over the loaded recipe list
  (no need for a search index/library at this scale — hundreds of recipes,
  not tens of thousands)
- **Export/Print:** native `window.print()` with a dedicated print
  stylesheet — no PDF-generation library needed (see Section 3.5)

---

## 2. Data Model

### 2.1 Recipe files

One JSON file per recipe, stored in `/data/recipes/<id>.json`.

```json
{
  "id": "carbonara-2024",
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
  "photos": ["carbonara-1.jpg", "carbonara-2.jpg"],
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

Notes on fields:
- `id` is a slug generated from the title at creation time (`pasta-carbonara`),
  with a numeric suffix appended on collision (`pasta-carbonara-2`).
- `unit` is `null` for countable ingredients (eggs, garlic cloves) — the
  counting noun lives in `name` instead (e.g. `"garlic cloves"`), not as a
  separate field.
- `photos` are filenames only, not full paths — resolved against the
  configured local photos folder + this recipe's subfolder at render time.
  Never store an absolute path in the JSON (it won't be valid on another
  machine).
- `categories` is an object with a fixed set of keys — `method`, `diet`,
  `meal`, `season`, `cuisine`, `main_ingredient` — each holding an array of
  values selected for that recipe (multiple values allowed per category,
  e.g. `diet` can be both `"vegetarian"` and `"gluten free"`). This is
  where vegetarian/vegan/gluten-free/dairy-free live now, as `diet` values
  rather than separate boolean fields. Any category array can be empty —
  a recipe doesn't need a season or cuisine tagged. See Section 2.2 for
  where the allowed values per category live and how they're managed.
- `tags` is a separate flat array of free-form custom tags for anything
  that doesn't fit the fixed categories (e.g. `"quick"`, `"date night"`,
  `"leftover-friendly"`) — this is where all tagging lived before adding
  categories, and it's kept for exactly this open-ended case. Stored as
  typed (preserves display casing like "BBQ"), but matching/filtering/
  dedup against `tags.json` is case-insensitive (see Section 2.2).
- Allowed `unit` values should be an enum, not free text: `g, kg, ml, l,
  tsp, tbsp, cup, fl_oz, oz, lb, pinch`. Amounts and units are stored as
  authored and displayed as-is — no unit conversion is performed.
- `rating` is an integer 0–5 (0 or omitted/`null` = unrated). Displayed and
  edited as a 5-star control; not required on create.
- `attribution` is an optional object with `name` (who/where the recipe is
  from, e.g. a person, cookbook, or website) and `url` (optional — only
  set if it's from the web). Either sub-field can be empty/missing on its
  own: a recipe can have a name with no URL (a family recipe, a cookbook),
  a URL with no name, or neither (your own original recipe).

**Missing/empty field handling (applies broadly, not just photos):** any
field not required by `schema.json` should have a sensible fallback in the
UI rather than showing "undefined," a blank gap, or breaking the view.
Concretely:
- Missing `rating` → show unfilled stars / "not rated," not an error
- Missing `attribution` (or missing `name`/`url` within it) → simply omit
  that part of the display, don't show "by undefined" or an empty link
- Missing `prep_time_minutes`/`cook_time_minutes`/`servings` → omit that
  stat from the card/detail view rather than showing "undefined min" or "0"
- Missing `notes` → hide the notes section entirely rather than showing an
  empty box
- Empty `categories.*`/`tags`/`photos`/`ingredients`/`steps` arrays →
  render whatever sections have content; an empty `categories.season`
  array just means no season chip shown for that recipe, not an error state
- This matters in particular because recipes may be hand-edited or
  AI-agent-edited outside the form, where it's easy to omit an optional
  field entirely — the app should never assume a field is present just
  because the form always fills it in.

### 2.1.1 `schema.json`

A standalone JSON Schema file at the repo root, describing the recipe shape
from Section 2.1. This serves two purposes: the app uses it (or an
equivalent Zod schema derived from it — see Section 5.3) to validate recipe
files on load/save, and it gives an AI agent editing files directly a
precise, machine-readable spec to follow instead of inferring the format
from example files.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Recipe",
  "type": "object",
  "required": ["id", "title", "ingredients", "steps"],
  "properties": {
    "id": { "type": "string" },
    "title": { "type": "string" },
    "categories": {
      "type": "object",
      "properties": {
        "method": { "type": "array", "items": { "type": "string" } },
        "diet": { "type": "array", "items": { "type": "string" } },
        "meal": { "type": "array", "items": { "type": "string" } },
        "season": { "type": "array", "items": { "type": "string" } },
        "cuisine": { "type": "array", "items": { "type": "string" } },
        "main_ingredient": { "type": "array", "items": { "type": "string" } }
      }
    },
    "tags": { "type": "array", "items": { "type": "string" } },
    "servings": { "type": "integer", "minimum": 1 },
    "prep_time_minutes": { "type": "integer", "minimum": 0 },
    "cook_time_minutes": { "type": "integer", "minimum": 0 },
    "ingredients": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "amount"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "amount": { "type": "number" },
          "unit": {
            "type": ["string", "null"],
            "enum": ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "fl_oz", "oz", "lb", "pinch", null]
          },
          "notes": { "type": "string" }
        }
      }
    },
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "text"],
        "properties": {
          "id": { "type": "string" },
          "text": { "type": "string" }
        }
      }
    },
    "photos": { "type": "array", "items": { "type": "string" } },
    "rating": {
      "type": ["integer", "null"],
      "minimum": 0,
      "maximum": 5
    },
    "attribution": {
      "type": ["object", "null"],
      "properties": {
        "name": { "type": "string" },
        "url": { "type": "string" }
      }
    },
    "notes": { "type": "string" },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  }
}
```

Keep this file and the TypeScript/Zod validation logic in sync manually —
if the schema changes (e.g. a new field is added), update both. For a
project this size, generating one from the other isn't worth the tooling
overhead; just treat `schema.json` as the source of truth an agent reads
before writing recipe files, and Zod as the runtime enforcement inside the
app.

### 2.2 Categories & tags files

Two separate files back the two tagging systems described in Section 2.1.

**`/data/categories.json`** — the canonical list of allowed values for each
fixed category. This is what powers the filter checkboxes and the
add/rename/merge management screen (Section 3.4).

```json
{
  "method": [
    { "id": "me1", "name": "sheet pan" },
    { "id": "me2", "name": "wok" },
    { "id": "me3", "name": "grill" },
    { "id": "me4", "name": "baking" },
    { "id": "me5", "name": "instant pot" }
  ],
  "diet": [
    { "id": "d1", "name": "vegetarian" },
    { "id": "d2", "name": "vegan" },
    { "id": "d3", "name": "gluten free" },
    { "id": "d4", "name": "dairy free" }
  ],
  "meal": [
    { "id": "ml1", "name": "dinner" },
    { "id": "ml2", "name": "breakfast" },
    { "id": "ml3", "name": "lunch" },
    { "id": "ml4", "name": "dessert" },
    { "id": "ml5", "name": "appetizer" },
    { "id": "ml6", "name": "side dish" },
    { "id": "ml7", "name": "drinks" }
  ],
  "season": [
    { "id": "s1", "name": "winter" },
    { "id": "s2", "name": "spring" },
    { "id": "s3", "name": "summer" },
    { "id": "s4", "name": "fall" }
  ],
  "cuisine": [],
  "main_ingredient": []
}
```

`cuisine` and `main_ingredient` start empty and grow as you tag recipes and
add new values (Italian, Mexican, Thai, ...; chicken, salmon, tofu, ...) —
unlike the other four categories, these two don't have an obvious fixed
list up front. All six categories support adding new values the same way
either way; the seed lists above are just a starting point matching what
you described, not a hard limit.

**The six category keys themselves (`method`, `diet`, `meal`, `season`,
`cuisine`, `main_ingredient`) are fixed in the app code** — adding a
seventh category (e.g. "occasion") is a schema/code change, not something
managed through the UI. Adding new *values within* an existing category
(e.g. adding "air fryer" to `method`) is a normal in-app action, same as
adding a tag was before.

**`/data/tags.json`** — unchanged from the earlier design: a flat,
free-form list for anything that doesn't fit the six categories.

```json
{
  "tags": [
    { "id": "t1", "name": "quick" },
    { "id": "t2", "name": "date night" },
    { "id": "t3", "name": "leftover-friendly" }
  ]
}
```

Recipes reference both category values and tags by name (not id) for
readability/diffability — the app resolves against `categories.json` /
`tags.json` for autocomplete, rename, and merge operations, and updates all
affected recipe files when a value is renamed or merged.

**Case-insensitivity applies to both files, the same way:**
- When adding a category value or tag, check case-insensitively against
  existing entries in that same category (or in `tags.json`) before
  creating a new one — typing "Vegetarian" reuses existing "vegetarian"
  rather than creating a duplicate. Note that case-insensitive matching is
  scoped per category — `diet` and `tags` are separate namespaces, so a
  value only needs to be unique within its own list, not globally.
- Canonical display casing is whichever was entered first (or set via
  rename); one entry per value, not one per casing variant.
- Filtering and search match regardless of casing.

### 2.3 Settings file

`/settings.local.json` — **not committed to git** (add to `.gitignore`).
Machine-specific config that would break on another computer if shared.

```json
{
  "photos_root": "/Users/you/Pictures/recipe-photos",
  "recipes_dir": "./data/recipes",
  "theme": "system"
}
```

### 2.4 Repo layout

```
/data
  /recipes
    pasta-carbonara.json
    ...
  categories.json
  tags.json
/sample-data          # example recipes for anyone cloning the tool fresh
  /recipes
    example-recipe.json
  categories.json
  tags.json
schema.json            # JSON Schema for a recipe file — read by humans,
                        # AI agents, and the app's own validation logic
/src                   # React frontend
/src-tauri             # Rust backend
settings.local.json    # gitignored
.gitignore
README.md
```

---

## 3. Core Features

### 3.1 Browse / Search

- Grid or list view of recipe cards (photo thumbnail, title, rating, key
  category chips, time)
- Free-text search across title, ingredient names, tags, and category values
- **Faceted category filters**, one collapsible group per category (Method,
  Diet, Meal, Season, Cuisine, Main Ingredient) — like NYT Cooking's
  sidebar. Within a category, selecting multiple values is **OR** (e.g.
  checking "vegetarian" and "vegan" under Diet shows recipes matching
  either). Across categories, it's **AND** (e.g. Method: "grill" + Meal:
  "dinner" shows only recipes matching both). This is the standard faceted
  filter pattern and doesn't need its own toggle.
- **Free tag filter**, separate from the category facets: click tags to
  filter (multi-select), with an **AND/OR toggle switch** in the UI — AND
  requires a recipe to have all selected tags, OR requires at least one.
  Toggle state can be transient (resets on app restart) rather than
  persisted, unless you'd prefer it remembered.
- Additional filters, combinable with the above:
  - **Rating** — minimum stars (e.g. "4+ stars"), or exact match
  - **Source/attribution** — filter or search by `attribution.name` (e.g.
    show only recipes from a specific site or person), and/or a simple
    toggle for "has a source link" vs "original/no attribution"
- Sort by rating, in addition to filtering by it
- All filtering happens client-side against the in-memory recipe list
  loaded at startup

### 3.2 Recipe detail view

- Full ingredient list and steps
- Photo carousel: if a recipe has multiple `photos`, display them as a
  carousel (prev/next arrows or swipe, plus dot indicators) rather than a
  static gallery grid. Single-photo recipes just show that one photo, no
  carousel controls needed. Resolved from the configured local photos
  folder; if a photo is missing, show a placeholder in its place within
  the carousel rather than skipping it silently or breaking the view.
- 5-star rating, shown on the card/detail view and editable inline (click a
  star to set/update `rating`, writes back to the recipe JSON immediately)
- **Servings scaling (live):** a stepper or quick multiplier buttons (e.g.
  1x / 2x / 0.5x, or a numeric input) next to servings. Changing it
  recalculates and displays each ingredient's `amount` scaled by the ratio
  of new servings to the recipe's base `servings` — this is display-only,
  it does not modify the underlying JSON `amount` values. Scaling applies
  uniformly to numeric amounts regardless of unit (no unit conversion
  involved, just multiplication) — e.g. 400g flour at 2x becomes 800g;
  round sensibly for display (e.g. to 1 decimal place) rather than showing
  long floating-point results.

### 3.3 Recipe create / edit

- Form-based editor: title, categories (one multi-select control per
  category — Method, Diet, Meal, Season, Cuisine, Main Ingredient — each
  autocompleting against `categories.json` for that category), tags
  (autocomplete against `tags.json`), servings, times, rating (star
  picker), attribution (name + optional URL), ingredients (repeatable
  rows), steps (repeatable rows), photos, notes
- On save: writes the recipe JSON atomically (see Section 5.2) and updates
  `updated_at`
- On create: generates a slug id, creates the file in `/data/recipes/`
- Delete: permanent — removes the JSON file directly, with a confirmation
  dialog before deleting (git history is the recovery path if needed, no
  in-app trash/undo)

### 3.4 Category & tag management

Same mechanics as before, applied to both `categories.json` (per category)
and `tags.json`:

- **Add value:** creates an entry in the relevant category array (or in
  `tags.json` for free tags), available for autocomplete immediately
- **Delete value:** removes it from `categories.json`/`tags.json` **and**
  strips it from every recipe that references it (with a confirmation
  showing how many recipes are affected)
- **Rename value:** updates the canonical file and rewrites the relevant
  array in every affected recipe file to the new name
- **Merge values** (e.g. "Italian" + "italian" → "italian"): same
  mechanism as rename, pointed at multiple source values

A single management screen with tabs or sections per category (plus one
for free tags) is simplest — six categories plus tags is a lot to manage
as one flat list, so grouping by category here mirrors how they're
presented in the filter UI.

### 3.5 Export / Print

A "Print" or "Export PDF" action on the recipe detail view, producing a
clean, printer-friendly single page — not a screenshot of the app UI.

**Recommended approach:** a dedicated print stylesheet (CSS `@media print`
rules) applied to the existing recipe detail view, triggered via the
browser/webview's native `window.print()`. This gets you both "Print" and
"Save as PDF" for free, since every OS print dialog offers a "Save as PDF"
destination — no extra PDF-generation library or dependency needed. Tauri's
webview supports this the same as a regular browser would.

**What the print layout should do differently from the on-screen view:**
- Hide anything interactive/non-printable: nav, filter sidebar, edit/delete
  buttons, the servings-scaling stepper controls themselves (though the
  *result* of scaling should print — see below), star-rating edit affordance
  (show the rating as static filled/unfilled stars, not a clickable control)
- Print title, one photo (not the full carousel — pick the first photo, or
  let the person choose which if you want that level of polish), servings,
  times, ingredients, and steps in a clean single- or two-column layout
- If the person has the servings scaler set to 2x when they print, print
  the scaled amounts, not the base recipe — it should reflect what's on
  screen, not silently reset to the original serving size
- Category chips and tags are optional on the printout — likely more
  useful to omit them and prioritize ingredients/steps fitting on fewer
  pages, but this is a reasonable place for your own taste to decide
- Attribution, if present, printed small at the bottom (nice for crediting
  a source when handing someone a physical copy)
- Respect light/dark mode setting on screen, but the print stylesheet
  should always render as light/black-on-white regardless of the app's
  current theme — dark backgrounds waste ink and look wrong on paper

**Multi-recipe export (e.g. "print this whole search result as a mini
cookbook"):** out of scope for v1 unless you want it — flagged as an Open
Question below rather than assumed.

### 3.6 Settings

- Light/dark mode toggle (see Section 5.5), persisted to
  `settings.local.json`
- Photos root folder picker (native file picker via Tauri, since this path
  differs per machine)
- Recipes directory picker (defaults to `./data/recipes` relative to the app,
  but should be overridable in case someone stores data elsewhere)

---

## 4. Photo Storage (Local)

Photos live in a plain local folder on disk, **not** committed to git.
No cloud sync integration for now — the app just reads image files from a
configured directory. This is intentionally kept as a thin, swappable layer:
if photo storage moves to Google Drive or another sync solution later, only
the path-resolution logic in this section needs to change — the recipe
schema (filenames in `photos`) stays the same.

**Structure inside the photos root:**
```
<photos_root>/
  pasta-carbonara/
    carbonara-1.jpg
    carbonara-2.jpg
  another-recipe/
    photo.jpg
```

Recipe JSON stores only the filename(s) in `photos`; the app resolves the
full path as `<photos_root>/<recipe_id>/<filename>` at render time.

**Why `photos_root` is a setting, not hardcoded:** this path will differ
across machines (and would need to change again if you move to a synced
folder later). It lives in the gitignored settings file, configured once
per machine via the folder picker in Settings.

**Missing photo handling (important — must not break the app):**
- If `photos_root` isn't configured yet, the app should still load and
  browse recipes normally; photo thumbnails/detail images just show a
  placeholder.
- If a specific referenced photo file isn't found at the resolved path
  (moved, renamed, not yet copied over, etc.), show a placeholder for that
  image only — never let a missing photo block loading the recipe or crash
  the view.
- This should be treated as a normal, expected state rather than an error
  condition, since "assume photos exist locally, but don't break if they
  don't" is a stated requirement.

---

## 5. Non-Functional Requirements

### 5.1 File watching

Since recipe JSON may be edited outside the app (by you directly, or by an
AI coding agent editing files on disk), the app should watch `/data/recipes`,
`/data/categories.json`, and `/data/tags.json` for external changes and
reload the in-memory data — or at minimum, prompt "data changed on disk,
reload?" rather than silently overwriting on next save.

### 5.2 Atomic writes

Never write directly to a recipe file in place. Write to a temp file in the
same directory, then rename over the original. This avoids leaving a
corrupted/truncated JSON file behind if the app crashes or is killed
mid-write.

### 5.3 Schema validation & graceful degradation

Validate recipe JSON against a schema (e.g. with Zod on the TypeScript side)
both when loading (to catch hand-edited or AI-edited files with mistakes)
and before writing. On load, a malformed recipe file should be skipped with
a visible warning in the UI, not crash the whole app.

Beyond validation, the UI layer itself must not assume optional fields are
present — see the missing-field handling list in Section 2.1. Validation
catches genuinely broken data (wrong types, missing required fields);
optional-but-absent fields (no rating, no attribution, no photos, empty
notes) are a normal, expected state the UI should render cleanly, not
something to warn about.

### 5.4 Cross-platform paths

Use Tauri's path APIs rather than hardcoded path separators, since this
should run on both Mac and Windows without changes.

### 5.5 Light / dark mode

Support both, plus a "system" option that follows the OS theme. Since the
frontend is Tailwind, use Tailwind's `dark:` variant driven by a class on
the root element rather than hand-rolled theme logic. Persist the user's
choice (`light` / `dark` / `system`) to `settings.local.json` so it's
remembered between launches. Applies app-wide — browse view, detail view,
forms, settings — not just a subset of screens.

---

## 6. Build Phases

1. **Scaffold** — Tauri + React project, basic window, load sample data,
   add `schema.json` at repo root, Tailwind dark-mode setup
2. **Data layer** — read/write recipe JSON, categories.json, tags.json
   (with case-insensitive matching, scoped per category), schema validation
   against `schema.json`/Zod, atomic writes, file watcher
3. **Browse/search UI** — recipe grid, faceted category filters (OR within
   category, AND across), free tag filter with AND/OR toggle, text search,
   rating/attribution filters, rating sort
4. **Recipe detail view** — full recipe display, photo carousel resolved
   against configured local photos folder, graceful handling of missing
   photos and other optional fields, inline star rating, live servings
   scaling, attribution display, category/tag chips
5. **Recipe create/edit form** — including ingredient/step repeaters, one
   multi-select per category (autocomplete against `categories.json`), tag
   autocomplete (case-insensitive dedup), rating picker, attribution fields
6. **Category & tag management** — add/delete/rename/merge per category and
   for free tags, with affected-recipe updates
7. **Export/Print** — print stylesheet for the detail view, reflecting
   current servings-scaled amounts, forced light theme on paper
8. **Settings** — light/dark/system theme toggle, photos root picker,
   recipes dir picker
9. **Polish** — empty states, error handling, delete confirmation dialog,
   packaging instructions for Mac/Windows builds

---

## 7. Open Questions

Decide these before or during build — flagging rather than assuming:

- **Untagged recipes and category filters:** if a recipe has no value set
  for a category (e.g. no `diet` tags at all), selecting a filter in that
  category naturally excludes it, same as the earlier vegetarian/vegan
  question — an untagged recipe won't show up under "vegetarian" until you
  tag it. This is just how faceted filtering works, but worth knowing so
  older/untagged recipes don't seem to be missing from filtered views for
  no obvious reason. Might be worth a visible "X recipes have no diet tag"
  hint somewhere, or a plan to batch-tag existing recipes.
- **`main_ingredient` vs. free-text ingredient search:** the app already
  does free-text search across ingredient names (Section 3.1) — that stays
  as-is and covers "does this recipe contain X." `main_ingredient` as a
  category is a separate, intentional tag for a recipe's *headline*
  ingredient(s) (e.g. tagging a stir-fry as `chicken` even though it also
  contains garlic, soy sauce, etc.) so browsing "show me chicken recipes"
  surfaces mains, not every recipe that happens to use a pinch of
  something. Worth confirming that distinction is what you want, since
  it means main_ingredient tagging is manual curation, not automatic.
- **Distribution to viewers:** confirmed earlier as `git clone` / `git pull`
  — worth a README section with exact steps once the app is buildable,
  including how they configure their own `photos_root` on first run. Since
  photos aren't committed to git for now, viewers won't have your photos
  unless you separately share that folder — worth deciding if that's
  acceptable for v1 or if photos need a distribution plan too.
- **Multi-recipe export:** printing/exporting one recipe at a time (Section
  3.5) is the assumed scope. If you'd also want to export a filtered
  search result or a whole tag as a single combined PDF (e.g. a "week of
  dinners" packet), that's a distinct feature worth scoping separately
  rather than assuming it falls out of the single-recipe print view for free.
