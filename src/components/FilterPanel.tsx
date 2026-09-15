import { useState } from 'react'
import type { CategoryKey } from '../lib/schema'
import { CATEGORY_KEYS } from '../lib/schema'
import { categories, tags } from '../lib/catalog'
import {
  CATEGORY_LABELS,
  type AttributionFilter,
  type BrowseFilters,
  type FacetMatchMode,
  type SortOption,
} from '../lib/filterRecipes'

type Props = {
  filters: BrowseFilters
  onChange: (next: BrowseFilters) => void
  onClear: () => void
  /** Active filters inside this panel (excludes search). */
  activeCount: number
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
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
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-stone-400">
          {label}
        </h3>
        {selected.length > 0 && (
          <span className="text-xs text-accent dark:text-orange-300">
            {selected.length}
          </span>
        )}
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
        {options.map((opt) => {
          const checked = selected.includes(opt.name)
          return (
            <li key={opt.id}>
              <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-muted hover:text-ink dark:text-stone-400 dark:hover:text-stone-100">
                <input
                  type="checkbox"
                  className="size-3.5 shrink-0 rounded border-stone-300 text-accent focus:ring-accent dark:border-stone-600 dark:bg-stone-800"
                  checked={checked}
                  onChange={() => onToggle(opt.name)}
                />
                <span className="leading-snug">{opt.name}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function FilterPanel({ filters, onChange, onClear, activeCount }: Props) {
  const [open, setOpen] = useState(false)

  const setCategory = (key: CategoryKey, value: string) => {
    onChange({
      ...filters,
      categories: {
        ...filters.categories,
        [key]: toggleValue(filters.categories[key], value),
      },
    })
  }

  const fieldClass =
    'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100'

  return (
    <div className="rounded-lg border border-stone-200/80 bg-white/50 dark:border-stone-700 dark:bg-stone-900/30">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent dark:text-stone-100 dark:hover:text-orange-300"
        >
          <span
            className={`inline-block text-ink-muted transition-transform dark:text-stone-400 ${open ? 'rotate-90' : ''}`}
            aria-hidden
          >
            ▸
          </span>
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent dark:bg-orange-400/20 dark:text-orange-300">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-accent underline-offset-2 hover:underline dark:text-orange-300"
          >
            Clear filters
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-stone-200 px-4 pb-4 pt-3 dark:border-stone-700">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted dark:text-stone-400">
                Sort
              </span>
              <select
                value={filters.sort}
                onChange={(e) =>
                  onChange({ ...filters, sort: e.target.value as SortOption })
                }
                className={fieldClass}
              >
                <option value="title-asc">Title A–Z</option>
                <option value="title-desc">Title Z–A</option>
                <option value="rating-desc">Rating high → low</option>
                <option value="rating-asc">Rating low → high</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted dark:text-stone-400">
                Min rating
              </span>
              <select
                value={filters.minRating}
                onChange={(e) =>
                  onChange({ ...filters, minRating: Number(e.target.value) })
                }
                className={fieldClass}
              >
                <option value={0}>Any</option>
                <option value={1}>1+</option>
                <option value={2}>2+</option>
                <option value={3}>3+</option>
                <option value={4}>4+</option>
                <option value={5}>5</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted dark:text-stone-400">
                Source
              </span>
              <select
                value={filters.attribution}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    attribution: e.target.value as AttributionFilter,
                  })
                }
                className={fieldClass}
              >
                <option value="any">Any</option>
                <option value="has_link">Has source link</option>
                <option value="none">No attribution</option>
              </select>
            </label>
          </div>

          <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-700">
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

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {CATEGORY_KEYS.map((key) => (
                <FacetColumn
                  key={key}
                  label={CATEGORY_LABELS[key]}
                  options={categories[key]}
                  selected={filters.categories[key]}
                  onToggle={(name) => setCategory(key, name)}
                />
              ))}

              {tags.tags.length > 0 && (
                <FacetColumn
                  label="Tags"
                  options={tags.tags}
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
        </div>
      )}
    </div>
  )
}
