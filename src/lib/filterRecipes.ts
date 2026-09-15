import type { CategoryKey, Recipe } from './schema'
import { CATEGORY_KEYS } from './schema'

/** AND/OR across facet groups (categories + tags). Within a group stays OR. */
export type FacetMatchMode = 'and' | 'or'

export type AttributionFilter = 'any' | 'has_link' | 'none'
export type SortOption = 'title-asc' | 'title-desc' | 'rating-desc' | 'rating-asc'

export type CategoryFilters = Record<CategoryKey, string[]>

export type BrowseFilters = {
  query: string
  categories: CategoryFilters
  tags: string[]
  /** Match mode across category columns and tags (not search/rating/source). */
  facetMode: FacetMatchMode
  minRating: number
  attribution: AttributionFilter
  sort: SortOption
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
    minRating: 0,
    attribution: 'any',
    sort: 'title-asc',
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
 * Facet groups = each category key with selections + tags (if any).
 * Within a group: OR. Across groups: `mode` (AND or OR).
 * Search / rating / attribution are separate hard ANDs.
 */
function matchesFacetGroups(
  recipe: Recipe,
  filters: CategoryFilters,
  tags: string[],
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

  if (groupHits.length === 0) return true
  return mode === 'and' ? groupHits.every(Boolean) : groupHits.some(Boolean)
}

function matchesRating(recipe: Recipe, minRating: number): boolean {
  if (minRating <= 0) return true
  const rating = recipe.rating
  if (rating == null || rating === 0) return false
  return rating >= minRating
}

function matchesAttribution(
  recipe: Recipe,
  filter: AttributionFilter,
): boolean {
  if (filter === 'any') return true
  const url = recipe.attribution?.url?.trim()
  const name = recipe.attribution?.name?.trim()
  const hasLink = Boolean(url)
  const hasAny = Boolean(url || name)
  if (filter === 'has_link') return hasLink
  // none = no attribution at all
  return !hasAny
}

function compareRecipes(a: Recipe, b: Recipe, sort: SortOption): number {
  const titleCmp = a.title.localeCompare(b.title, undefined, {
    sensitivity: 'base',
  })
  const ratingA = a.rating ?? -1
  const ratingB = b.rating ?? -1

  switch (sort) {
    case 'title-desc':
      return -titleCmp
    case 'rating-desc':
      return ratingB - ratingA || titleCmp
    case 'rating-asc':
      return ratingA - ratingB || titleCmp
    case 'title-asc':
    default:
      return titleCmp
  }
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
          filters.facetMode,
        ) &&
        matchesRating(recipe, filters.minRating) &&
        matchesAttribution(recipe, filters.attribution),
    )
    .sort((a, b) => {
      if (tokens.length > 0) {
        const aTitle = titleMatchesQuery(a, tokens) ? 0 : 1
        const bTitle = titleMatchesQuery(b, tokens) ? 0 : 1
        if (aTitle !== bTitle) return aTitle - bTitle
      }
      return compareRecipes(a, b, filters.sort)
    })
}

export function countActiveFilters(filters: BrowseFilters): number {
  let n = 0
  if (filters.query.trim()) n += 1
  for (const key of CATEGORY_KEYS) {
    n += filters.categories[key].length
  }
  n += filters.tags.length
  if (filters.minRating > 0) n += 1
  if (filters.attribution !== 'any') n += 1
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
