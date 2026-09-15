import type { CategoryKey, Recipe } from './schema'
import { CATEGORY_KEYS } from './schema'

export type TagMatchMode = 'and' | 'or'
export type AttributionFilter = 'any' | 'has_link' | 'none'
export type SortOption = 'title-asc' | 'title-desc' | 'rating-desc' | 'rating-asc'

export type CategoryFilters = Record<CategoryKey, string[]>

export type BrowseFilters = {
  query: string
  categories: CategoryFilters
  tags: string[]
  tagMode: TagMatchMode
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
    tagMode: 'or',
    minRating: 0,
    attribution: 'any',
    sort: 'title-asc',
  }
}

function norm(s: string): string {
  return s.trim().toLowerCase()
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

function matchesQuery(recipe: Recipe, query: string): boolean {
  const q = norm(query)
  if (!q) return true

  const haystack: string[] = [
    recipe.title,
    ...(recipe.tags ?? []),
    recipe.attribution?.name ?? '',
    ...recipe.ingredients.map((i) => i.name),
  ]

  for (const key of CATEGORY_KEYS) {
    haystack.push(...(recipe.categories?.[key] ?? []))
  }

  return haystack.some((part) => norm(part).includes(q))
}

function matchesCategoryFacets(
  recipe: Recipe,
  filters: CategoryFilters,
): boolean {
  for (const key of CATEGORY_KEYS) {
    const selected = filters[key]
    if (selected.length === 0) continue
    // OR within category
    const any = selected.some((value) =>
      recipeHasCategoryValue(recipe, key, value),
    )
    if (!any) return false
  }
  return true
}

function matchesTags(
  recipe: Recipe,
  tags: string[],
  mode: TagMatchMode,
): boolean {
  if (tags.length === 0) return true
  const recipeTags = (recipe.tags ?? []).map(norm)
  if (mode === 'and') {
    return tags.every((t) => recipeTags.includes(norm(t)))
  }
  return tags.some((t) => recipeTags.includes(norm(t)))
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
  return recipes
    .filter(
      (recipe) =>
        matchesQuery(recipe, filters.query) &&
        matchesCategoryFacets(recipe, filters.categories) &&
        matchesTags(recipe, filters.tags, filters.tagMode) &&
        matchesRating(recipe, filters.minRating) &&
        matchesAttribution(recipe, filters.attribution),
    )
    .sort((a, b) => compareRecipes(a, b, filters.sort))
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
