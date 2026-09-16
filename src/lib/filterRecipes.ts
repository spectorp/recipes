import type { CategoryKey, Recipe } from './schema'
import { CATEGORY_KEYS } from './schema'

/** AND/OR across facet groups (categories + tags + rating). Within a group stays OR. */
export type FacetMatchMode = 'and' | 'or'

export type CategoryFilters = Record<CategoryKey, string[]>

/** Min-rating thresholds shown as checkboxes (e.g. 3 means “3+”). */
export const RATING_FACET_OPTIONS: { id: string; name: string; value: number }[] =
  [
    { id: 'r1', name: '1+', value: 1 },
    { id: 'r2', name: '2+', value: 2 },
    { id: 'r3', name: '3+', value: 3 },
    { id: 'r4', name: '4+', value: 4 },
    { id: 'r5', name: '5', value: 5 },
  ]

export type BrowseFilters = {
  query: string
  categories: CategoryFilters
  tags: string[]
  /** Match mode across category columns, tags, and rating (not search). */
  facetMode: FacetMatchMode
  /** Selected min-rating thresholds (OR within column → effective min is the lowest). */
  minRatings: number[]
}

export function emptyCategoryFilters(): CategoryFilters {
  return {
    method: [],
    diet: [],
    meal: [],
    season: [],
    cuisine: [],
    main_ingredient: [],
  }
}

export function defaultBrowseFilters(): BrowseFilters {
  return {
    query: '',
    categories: emptyCategoryFilters(),
    tags: [],
    facetMode: 'and',
    minRatings: [],
  }
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function queryTokens(query: string): string[] {
  return norm(query).split(/\s+/).filter(Boolean)
}

function recipeHasCategoryValue(
  recipe: Recipe,
  key: CategoryKey,
  value: string,
): boolean {
  const values = recipe.categories?.[key] ?? []
  const target = norm(value)
  return values.some((v) => norm(v) === target)
}

/** Fields searched for query tokens (AND across tokens). */
function recipeSearchFields(recipe: Recipe): string[] {
  const fields: string[] = [
    recipe.title,
    recipe.id.replace(/-/g, ' '),
    ...(recipe.tags ?? []),
    recipe.attribution?.name ?? '',
    ...recipe.ingredients.map((i) => i.name),
  ]

  for (const key of CATEGORY_KEYS) {
    fields.push(...(recipe.categories?.[key] ?? []))
  }

  return fields
}

function fieldContainsAllTokens(field: string, tokens: string[]): boolean {
  const text = norm(field)
  return tokens.every((token) => text.includes(token))
}

/** Every token must appear in at least one search field. */
function matchesQuery(recipe: Recipe, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const fields = recipeSearchFields(recipe).map(norm)
  return tokens.every((token) => fields.some((field) => field.includes(token)))
}

/** Prefer recipes whose title (or id slug) covers every token. */
function titleMatchesQuery(recipe: Recipe, tokens: string[]): boolean {
  if (tokens.length === 0) return false
  return (
    fieldContainsAllTokens(recipe.title, tokens) ||
    fieldContainsAllTokens(recipe.id.replace(/-/g, ' '), tokens)
  )
}

/**
 * Facet groups = each category key with selections + tags + rating (if any).
 * Within a group: OR. Across groups: `mode` (AND or OR).
 * Search is a separate hard AND.
 */
function matchesFacetGroups(
  recipe: Recipe,
  filters: CategoryFilters,
  tags: string[],
  minRatings: number[],
  mode: FacetMatchMode,
): boolean {
  const groupHits: boolean[] = []

  for (const key of CATEGORY_KEYS) {
    const selected = filters[key]
    if (selected.length === 0) continue
    groupHits.push(
      selected.some((value) => recipeHasCategoryValue(recipe, key, value)),
    )
  }

  if (tags.length > 0) {
    const recipeTags = (recipe.tags ?? []).map(norm)
    groupHits.push(tags.some((t) => recipeTags.includes(norm(t))))
  }

  if (minRatings.length > 0) {
    const rating = recipe.rating
    groupHits.push(
      rating != null &&
        rating > 0 &&
        minRatings.some((min) => rating >= min),
    )
  }

  if (groupHits.length === 0) return true
  return mode === 'and' ? groupHits.every(Boolean) : groupHits.some(Boolean)
}

function compareByTitle(a: Recipe, b: Recipe): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
}

export function filterAndSortRecipes(
  recipes: Recipe[],
  filters: BrowseFilters,
): Recipe[] {
  const tokens = queryTokens(filters.query)

  return recipes
    .filter(
      (recipe) =>
        matchesQuery(recipe, tokens) &&
        matchesFacetGroups(
          recipe,
          filters.categories,
          filters.tags,
          filters.minRatings,
          filters.facetMode,
        ),
    )
    .sort((a, b) => {
      if (tokens.length > 0) {
        const aTitle = titleMatchesQuery(a, tokens) ? 0 : 1
        const bTitle = titleMatchesQuery(b, tokens) ? 0 : 1
        if (aTitle !== bTitle) return aTitle - bTitle
      }
      return compareByTitle(a, b)
    })
}

/**
 * Recipes matching search and all facet groups except one.
 * Used so each facet column only offers values that can still yield hits.
 */
function recipesMatchingExceptFacet(
  recipes: Recipe[],
  filters: BrowseFilters,
  except: CategoryKey | 'tags' | 'rating',
): Recipe[] {
  const tokens = queryTokens(filters.query)
  const categories =
    except === 'tags' || except === 'rating'
      ? filters.categories
      : { ...filters.categories, [except]: [] as string[] }
  const tags = except === 'tags' ? [] : filters.tags
  const minRatings = except === 'rating' ? [] : filters.minRatings

  return recipes.filter(
    (recipe) =>
      matchesQuery(recipe, tokens) &&
      matchesFacetGroups(
        recipe,
        categories,
        tags,
        minRatings,
        filters.facetMode,
      ),
  )
}

export type AvailableFacetValues = {
  categories: Record<CategoryKey, Set<string>>
  tags: Set<string>
  ratings: Set<string>
}

/** Normalized value names still reachable given the other active filters. */
export function computeAvailableFacetValues(
  recipes: Recipe[],
  filters: BrowseFilters,
): AvailableFacetValues {
  const categorySets = {} as Record<CategoryKey, Set<string>>

  for (const key of CATEGORY_KEYS) {
    const available = new Set<string>()
    for (const recipe of recipesMatchingExceptFacet(recipes, filters, key)) {
      for (const value of recipe.categories?.[key] ?? []) {
        available.add(norm(value))
      }
    }
    for (const value of filters.categories[key]) {
      available.add(norm(value))
    }
    categorySets[key] = available
  }

  const tagSet = new Set<string>()
  for (const recipe of recipesMatchingExceptFacet(recipes, filters, 'tags')) {
    for (const tag of recipe.tags ?? []) {
      tagSet.add(norm(tag))
    }
  }
  for (const tag of filters.tags) {
    tagSet.add(norm(tag))
  }

  const ratingSet = new Set<string>()
  const pool = recipesMatchingExceptFacet(recipes, filters, 'rating')
  for (const opt of RATING_FACET_OPTIONS) {
    const any = pool.some(
      (recipe) =>
        recipe.rating != null &&
        recipe.rating > 0 &&
        recipe.rating >= opt.value,
    )
    if (any) ratingSet.add(norm(opt.name))
  }
  for (const value of filters.minRatings) {
    const opt = RATING_FACET_OPTIONS.find((o) => o.value === value)
    if (opt) ratingSet.add(norm(opt.name))
  }

  return { categories: categorySets, tags: tagSet, ratings: ratingSet }
}

/** Keep vocab options that are available (or currently selected). */
export function filterFacetOptions<T extends { name: string }>(
  options: T[],
  available: Set<string>,
): T[] {
  return options.filter((opt) => available.has(norm(opt.name)))
}

export function countActiveFilters(filters: BrowseFilters): number {
  let n = 0
  if (filters.query.trim()) n += 1
  for (const key of CATEGORY_KEYS) {
    n += filters.categories[key].length
  }
  n += filters.tags.length
  n += filters.minRatings.length
  return n
}

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  method: 'Method',
  diet: 'Diet',
  meal: 'Meal',
  season: 'Season',
  cuisine: 'Cuisine',
  main_ingredient: 'Main ingredient',
}
