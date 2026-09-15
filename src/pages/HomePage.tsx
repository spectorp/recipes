import { useMemo, useState } from 'react'
import { FilterPanel } from '../components/FilterPanel'
import { RecipeCard } from '../components/RecipeCard'
import { ThemeToggle } from '../components/ThemeToggle'
import { catalogLoadErrors, recipes } from '../lib/catalog'
import {
  countActiveFilters,
  defaultBrowseFilters,
  filterAndSortRecipes,
  type BrowseFilters,
} from '../lib/filterRecipes'

function countPanelFilters(filters: BrowseFilters): number {
  // Search lives in the header; badge only non-search filters.
  const withoutQuery = { ...filters, query: '' }
  return countActiveFilters(withoutQuery)
}

export function HomePage() {
  const [filters, setFilters] = useState<BrowseFilters>(defaultBrowseFilters)

  const visible = useMemo(
    () => filterAndSortRecipes(recipes, filters),
    [filters],
  )
  const activeCount = countActiveFilters(filters)
  const panelActiveCount = countPanelFilters(filters)

  const clearFilters = () => setFilters(defaultBrowseFilters())
  const clearPanelFilters = () =>
    setFilters({ ...defaultBrowseFilters(), query: filters.query })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
          <h1 className="font-display shrink-0 text-4xl tracking-tight text-ink dark:text-stone-50">
            Recipes
          </h1>
          <label className="relative min-w-0 flex-1 basis-48 sm:max-w-sm">
            <span className="sr-only">Search</span>
            <input
              type="search"
              placeholder="Search recipes…"
              value={filters.query}
              onChange={(e) =>
                setFilters({ ...filters, query: e.target.value })
              }
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
            />
          </label>
        </div>
        <ThemeToggle className="no-print shrink-0" />
      </header>

      {catalogLoadErrors.length > 0 && (
        <div
          className="mb-6 rounded-md border border-amber-700/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          <p className="font-medium">
            Skipped {catalogLoadErrors.length} invalid data file
            {catalogLoadErrors.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {catalogLoadErrors.map((err) => (
              <li key={`${err.source}:${err.message}`}>
                <span className="font-mono text-xs">{err.source}</span>
                {': '}
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6">
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onClear={clearPanelFilters}
          activeCount={panelActiveCount}
        />
      </div>

      <section>
        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 px-6 py-16 text-center dark:border-stone-600">
            <p className="text-ink-muted dark:text-stone-400">
              No recipes match these filters.
            </p>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((recipe) => (
              <li key={recipe.id}>
                <RecipeCard recipe={recipe} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-center text-sm text-ink-muted dark:text-stone-500">
        {visible.length === recipes.length
          ? `${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`
          : `${visible.length} of ${recipes.length} recipes`}
      </p>
    </div>
  )
}
