import type { CategoryKey } from '../lib/schema'
import { CATEGORY_KEYS } from '../lib/schema'
import { categories, tags } from '../lib/catalog'
import {
  CATEGORY_LABELS,
  type AttributionFilter,
  type BrowseFilters,
  type SortOption,
  type TagMatchMode,
} from '../lib/filterRecipes'

type Props = {
  filters: BrowseFilters
  onChange: (next: BrowseFilters) => void
  onClear: () => void
  activeCount: number
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
}

function FacetGroup({
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
    <details className="group border-b border-stone-200 py-3 dark:border-stone-700" open>
      <summary className="cursor-pointer list-none font-medium text-ink marker:content-none dark:text-stone-100">
        <span className="flex items-center justify-between gap-2">
          {label}
          {selected.length > 0 && (
            <span className="text-xs font-normal text-accent dark:text-orange-300">
              {selected.length}
            </span>
          )}
        </span>
      </summary>
      <ul className="mt-2 space-y-1.5">
        {options.map((opt) => {
          const checked = selected.includes(opt.name)
          return (
            <li key={opt.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted hover:text-ink dark:text-stone-400 dark:hover:text-stone-100">
                <input
                  type="checkbox"
                  className="size-4 rounded border-stone-300 text-accent focus:ring-accent dark:border-stone-600 dark:bg-stone-800"
                  checked={checked}
                  onChange={() => onToggle(opt.name)}
                />
                <span>{opt.name}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

export function FilterPanel({ filters, onChange, onClear, activeCount }: Props) {
  const setCategory = (key: CategoryKey, value: string) => {
    onChange({
      ...filters,
      categories: {
        ...filters.categories,
        [key]: toggleValue(filters.categories[key], value),
      },
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
        <h2 className="font-display text-lg text-ink dark:text-stone-50">Filters</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300"
          >
            Clear all
          </button>
        )}
      </div>

      <label className="block text-sm">
        <span className="sr-only">Search</span>
        <input
          type="search"
          placeholder="Search recipes…"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-ink placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
        />
      </label>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-ink-muted dark:text-stone-400">Sort</span>
        <select
          value={filters.sort}
          onChange={(e) =>
            onChange({ ...filters, sort: e.target.value as SortOption })
          }
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
        >
          <option value="title-asc">Title A–Z</option>
          <option value="title-desc">Title Z–A</option>
          <option value="rating-desc">Rating high → low</option>
          <option value="rating-asc">Rating low → high</option>
        </select>
      </label>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-ink-muted dark:text-stone-400">
          Minimum rating
        </span>
        <select
          value={filters.minRating}
          onChange={(e) =>
            onChange({ ...filters, minRating: Number(e.target.value) })
          }
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
        >
          <option value={0}>Any</option>
          <option value={1}>1+</option>
          <option value={2}>2+</option>
          <option value={3}>3+</option>
          <option value={4}>4+</option>
          <option value={5}>5</option>
        </select>
      </label>

      <label className="mt-3 block text-sm">
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
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
        >
          <option value="any">Any</option>
          <option value="has_link">Has source link</option>
          <option value="none">No attribution</option>
        </select>
      </label>

      <div className="mt-1 flex-1 overflow-y-auto">
        {CATEGORY_KEYS.map((key) => (
          <FacetGroup
            key={key}
            label={CATEGORY_LABELS[key]}
            options={categories[key]}
            selected={filters.categories[key]}
            onToggle={(name) => setCategory(key, name)}
          />
        ))}

        {tags.tags.length > 0 && (
          <details
            className="group border-b border-stone-200 py-3 dark:border-stone-700"
            open
          >
            <summary className="cursor-pointer list-none font-medium text-ink dark:text-stone-100">
              <span className="flex items-center justify-between gap-2">
                Tags
                {filters.tags.length > 0 && (
                  <span className="text-xs font-normal text-accent dark:text-orange-300">
                    {filters.tags.length}
                  </span>
                )}
              </span>
            </summary>
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted dark:text-stone-400">
              <span>Match</span>
              <div className="inline-flex rounded-md border border-stone-300 dark:border-stone-600">
                {(['or', 'and'] as TagMatchMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onChange({ ...filters, tagMode: mode })}
                    className={`px-2 py-1 uppercase ${
                      filters.tagMode === mode
                        ? 'bg-accent text-white dark:bg-orange-700'
                        : 'bg-white text-ink-muted dark:bg-stone-900 dark:text-stone-400'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-2 space-y-1.5">
              {tags.tags.map((tag) => {
                const checked = filters.tags.includes(tag.name)
                return (
                  <li key={tag.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted hover:text-ink dark:text-stone-400 dark:hover:text-stone-100">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-stone-300 text-accent focus:ring-accent dark:border-stone-600 dark:bg-stone-800"
                        checked={checked}
                        onChange={() =>
                          onChange({
                            ...filters,
                            tags: toggleValue(filters.tags, tag.name),
                          })
                        }
                      />
                      <span>{tag.name}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}
