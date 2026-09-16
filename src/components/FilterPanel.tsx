import { useMemo } from 'react'
import type { CategoryKey } from '../lib/schema'
import { CATEGORY_KEYS } from '../lib/schema'
import { categories, recipes, tags } from '../lib/catalog'
import {
  CATEGORY_LABELS,
  RATING_FACET_OPTIONS,
  computeAvailableFacetValues,
  filterFacetOptions,
  type BrowseFilters,
  type FacetMatchMode,
} from '../lib/filterRecipes'

type Props = {
  filters: BrowseFilters
  onChange: (next: BrowseFilters) => void
  onClear: () => void
  /** True when any panel filter (not search) is active. */
  hasActiveFilters: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
}

function toggleNumber(list: number[], value: number): number[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value].sort((a, b) => a - b)
}

function FacetColumn({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { id: string; name: string }[]
  selected: string[]
  onToggle: (name: string) => void
}) {
  if (options.length === 0) return null

  return (
    <div className="min-w-0">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-stone-400">
        {label}
      </h3>
      <ul className="max-h-48 space-y-0 overflow-y-auto pr-1 sm:max-h-56">
        {options.map((opt) => {
          const checked = selected.includes(opt.name)
          return (
            <li key={opt.id}>
              <label className="flex cursor-pointer items-center gap-1.5 py-px text-sm leading-tight text-ink-muted hover:text-ink dark:text-stone-400 dark:hover:text-stone-100">
                <input
                  type="checkbox"
                  className="size-3.5 shrink-0 rounded border-stone-300 text-accent focus:ring-accent dark:border-stone-600 dark:bg-stone-800"
                  checked={checked}
                  onChange={() => onToggle(opt.name)}
                />
                <span>{opt.name}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function FilterPanel({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
  open,
  onOpenChange,
}: Props) {
  const available = useMemo(
    () => computeAvailableFacetValues(recipes, filters),
    [filters],
  )

  const setCategory = (key: CategoryKey, value: string) => {
    onChange({
      ...filters,
      categories: {
        ...filters.categories,
        [key]: toggleValue(filters.categories[key], value),
      },
    })
  }

  const selectedRatingNames = filters.minRatings.map(
    (value) =>
      RATING_FACET_OPTIONS.find((o) => o.value === value)?.name ?? `${value}+`,
  )

  return (
    <div className="rounded-lg border border-stone-200/80 bg-white/50 dark:border-stone-700 dark:bg-stone-900/30">
      {open ? (
        <div className="flex w-full items-stretch border-b border-stone-200 dark:border-stone-700">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-expanded
            className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-stone-100/60 dark:text-stone-100 dark:hover:bg-stone-800/50"
          >
            <span
              className="inline-block rotate-90 text-ink-muted dark:text-stone-400"
              aria-hidden
            >
              ▸
            </span>
            Filters
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 shrink-0 px-3 py-2.5 text-xs text-accent underline-offset-2 hover:bg-stone-100/60 hover:underline dark:text-orange-300 dark:hover:bg-stone-800/50"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex w-full items-stretch">
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            aria-expanded={false}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-stone-100/60 dark:text-stone-100 dark:hover:bg-stone-800/50"
          >
            <span className="inline-block text-ink-muted dark:text-stone-400" aria-hidden>
              ▸
            </span>
            Filters
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 shrink-0 px-3 py-2.5 text-xs text-accent underline-offset-2 hover:bg-stone-100/60 hover:underline dark:text-orange-300 dark:hover:bg-stone-800/50"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted dark:text-stone-400">
            <span>Match facet groups</span>
            <div className="inline-flex rounded-md border border-stone-300 dark:border-stone-600">
              {(['and', 'or'] as FacetMatchMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  title={
                    mode === 'and'
                      ? 'Recipe must match every selected column (Diet, Method, Tags, …)'
                      : 'Recipe must match at least one selected column'
                  }
                  onClick={() => onChange({ ...filters, facetMode: mode })}
                  className={`px-1.5 py-0.5 uppercase ${
                    filters.facetMode === mode
                      ? 'bg-accent text-white dark:bg-orange-700'
                      : 'bg-white text-ink-muted dark:bg-stone-900 dark:text-stone-400'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <span className="text-ink-muted/80 dark:text-stone-500">
              (within a column stays any-of)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8">
            {CATEGORY_KEYS.map((key) => (
              <FacetColumn
                key={key}
                label={CATEGORY_LABELS[key]}
                options={filterFacetOptions(
                  categories[key],
                  available.categories[key],
                )}
                selected={filters.categories[key]}
                onToggle={(name) => setCategory(key, name)}
              />
            ))}

            <FacetColumn
              label="Min rating"
              options={filterFacetOptions(
                RATING_FACET_OPTIONS,
                available.ratings,
              )}
              selected={selectedRatingNames}
              onToggle={(name) => {
                const opt = RATING_FACET_OPTIONS.find((o) => o.name === name)
                if (!opt) return
                onChange({
                  ...filters,
                  minRatings: toggleNumber(filters.minRatings, opt.value),
                })
              }}
            />

            {tags.tags.length > 0 && (
              <FacetColumn
                label="Tags"
                options={filterFacetOptions(tags.tags, available.tags)}
                selected={filters.tags}
                onToggle={(name) =>
                  onChange({
                    ...filters,
                    tags: toggleValue(filters.tags, name),
                  })
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
