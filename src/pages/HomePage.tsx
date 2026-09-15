import { useMemo, useState } from 'react'
import { FilterPanel } from '../components/FilterPanel'
import { RecipeCard } from '../components/RecipeCard'
import { catalogLoadErrors, recipes } from '../lib/catalog'
import {
  countActiveFilters,
  defaultBrowseFilters,
  filterAndSortRecipes,
  type BrowseFilters,
} from '../lib/filterRecipes'

export function HomePage() {
  const [filters, setFilters] = useState<BrowseFilters>(defaultBrowseFilters)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const visible = useMemo(
    () => filterAndSortRecipes(recipes, filters),
    [filters],
  )
  const activeCount = countActiveFilters(filters)

  const clearFilters = () => setFilters(defaultBrowseFilters())

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl tracking-tight text-ink dark:text-stone-50">
          Recipes
        </h1>
        <p className="mt-2 text-ink-muted dark:text-stone-400">
          {visible.length === recipes.length
            ? `${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`
            : `${visible.length} of ${recipes.length} recipes`}
        </p>
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

      <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-ink dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-lg border border-stone-200/80 bg-white/50 p-4 dark:border-stone-700 dark:bg-stone-900/30">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onClear={clearFilters}
              activeCount={activeCount}
            />
          </div>
        </aside>

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
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-stone-900/40"
            aria-label="Close filters"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-surface shadow-xl dark:bg-surface-dark">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
              <span className="font-medium">Filters</span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-ink-muted hover:text-ink dark:text-stone-400 dark:hover:text-stone-100"
              >
                Done
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                onClear={clearFilters}
                activeCount={activeCount}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
