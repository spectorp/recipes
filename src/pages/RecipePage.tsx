import { useEffect, useId, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Chip, StarRating, recipeTimeLabel } from '../components/recipeMeta'
import { ThemeToggle } from '../components/ThemeToggle'
import { getRecipeById } from '../lib/catalog'
import { formatIngredientParts, recipeChipList } from '../lib/format'

const PRESET_MULTIPLIERS = [0.5, 1, 1.5, 2, 3] as const

const TEXT_SIZE_OPTIONS = [
  { id: 'lg', className: 'text-lg', ariaLabel: 'Small text size' },
  { id: 'xl', className: 'text-xl', ariaLabel: 'Medium text size' },
  { id: '2xl', className: 'text-2xl', ariaLabel: 'Large text size' },
] as const

type TextSizeId = (typeof TEXT_SIZE_OPTIONS)[number]['id']

const TEXT_SIZE_STORAGE_KEY = 'recipes-text-size'

function getStoredTextSize(): TextSizeId {
  try {
    const value = localStorage.getItem(TEXT_SIZE_STORAGE_KEY)
    if (TEXT_SIZE_OPTIONS.some((o) => o.id === value)) {
      return value as TextSizeId
    }
  } catch {
    /* ignore */
  }
  // Legacy sm/md (and unknown) map to the new smallest size.
  return 'lg'
}

function setStoredTextSize(id: TextSizeId): void {
  try {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  )
}

function PrinterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </svg>
  )
}

function useMenuDismiss(
  open: boolean,
  setOpen: (open: boolean) => void,
) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, setOpen])

  return rootRef
}

function ScaleControl({
  value,
  onChange,
}: {
  value: number
  onChange: (next: number) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useMenuDismiss(open, setOpen)
  const menuId = useId()

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:border-accent/50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
      >
        Scale
      </button>
      {open && (
        <ul
          id={menuId}
          role="listbox"
          aria-label="Recipe scale"
          className="absolute right-0 z-20 mt-1 min-w-28 rounded-md border border-stone-300 bg-white py-1 shadow-md dark:border-stone-600 dark:bg-stone-900"
        >
          {PRESET_MULTIPLIERS.map((mult) => {
            const active = Math.abs(value - mult) < 0.001
            return (
              <li key={mult} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(mult)
                    setOpen(false)
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-sm ${
                    active
                      ? 'bg-accent/10 font-medium text-accent dark:bg-orange-400/15 dark:text-orange-300'
                      : 'text-ink hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {`${mult}×`}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function TextSizeControl({
  value,
  onChange,
}: {
  value: TextSizeId
  onChange: (next: TextSizeId) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useMenuDismiss(open, setOpen)
  const menuId = useId()

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:border-accent/50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
      >
        Text Size
      </button>
      {open && (
        <ul
          id={menuId}
          role="listbox"
          aria-label="Recipe text size"
          className="absolute right-0 z-20 mt-1 min-w-44 rounded-md border border-stone-300 bg-white py-1 shadow-md dark:border-stone-600 dark:bg-stone-900"
        >
          {TEXT_SIZE_OPTIONS.map((opt) => {
            const active = value === opt.id
            return (
              <li key={opt.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  aria-label={opt.ariaLabel}
                  onClick={() => {
                    onChange(opt.id)
                    setOpen(false)
                  }}
                  className={`block w-full px-3 py-2 text-left leading-snug ${opt.className} ${
                    active
                      ? 'bg-accent/10 font-medium text-accent dark:bg-orange-400/15 dark:text-orange-300'
                      : 'text-ink hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  Text Size
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function RecipePage() {
  const { id } = useParams<{ id: string }>()
  const recipe = id ? getRecipeById(id) : undefined
  const [scale, setScale] = useState(1)
  const [textSize, setTextSize] = useState<TextSizeId>(() => getStoredTextSize())
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(
    () => new Set(),
  )
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(
    () => new Set(),
  )

  useEffect(() => {
    setScale(1)
    setCheckedIngredients(new Set())
    setCheckedSteps(new Set())
  }, [recipe?.id])

  useEffect(() => {
    const previous = document.title
    document.title = recipe ? `${recipe.title} · Recipes` : 'Recipe not found · Recipes'
    return () => {
      document.title = previous
    }
  }, [recipe])

  const selectTextSize = (next: TextSizeId) => {
    setTextSize(next)
    setStoredTextSize(next)
  }

  const bodyTextClass =
    TEXT_SIZE_OPTIONS.find((o) => o.id === textSize)?.className ?? 'text-lg'

  if (!recipe) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          to="/"
          aria-label="All recipes"
          title="All recipes"
          className="inline-flex size-9 items-center justify-center rounded-md border border-stone-300 bg-white text-ink hover:border-stone-400 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-500"
        >
          <HomeIcon />
        </Link>
        <h1 className="font-display mt-4 text-3xl tracking-tight text-ink dark:text-stone-50">
          Recipe not found
        </h1>
        <p className="mt-2 text-ink-muted dark:text-stone-400">
          No recipe matches{' '}
          <span className="font-mono text-sm">{id ?? '(missing)'}</span>.
        </p>
      </main>
    )
  }

  const chips = recipeChipList(recipe)
  const time = recipeTimeLabel(recipe)
  const prep = recipe.prep_time_minutes
  const cook = recipe.cook_time_minutes
  const notes = recipe.notes?.trim()
  const attribution = recipe.attribution
  const hasAttribution = Boolean(
    attribution?.name?.trim() || attribution?.url?.trim(),
  )

  const toggleId = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  return (
    <main className="recipe-page mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:max-w-5xl">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          aria-label="All recipes"
          title="All recipes"
          className="inline-flex size-9 items-center justify-center rounded-md border border-stone-300 bg-white text-ink hover:border-stone-400 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-500"
        >
          <HomeIcon />
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <ScaleControl value={scale} onChange={setScale} />
          <TextSizeControl value={textSize} onChange={selectTextSize} />
          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Print"
            title="Print"
            className="inline-flex size-9 items-center justify-center rounded-md border border-stone-300 bg-white text-ink hover:border-accent/50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
          >
            <PrinterIcon />
          </button>
        </div>
      </div>

      <header className="mt-4 border-b border-stone-200 pb-6 dark:border-stone-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-4xl tracking-tight text-ink dark:text-stone-50">
            {recipe.title}
          </h1>
          <StarRating rating={recipe.rating} className="text-lg" />
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 space-y-3">
            <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted dark:text-stone-400">
              {recipe.servings != null && (
                <div>
                  <dt className="sr-only">Servings</dt>
                  <dd>
                    {recipe.servings} serving
                    {recipe.servings === 1 ? '' : 's'}
                  </dd>
                </div>
              )}
              {prep != null && (
                <div>
                  <dt className="sr-only">Prep time</dt>
                  <dd>{prep} min prep</dd>
                </div>
              )}
              {cook != null && (
                <div>
                  <dt className="sr-only">Cook time</dt>
                  <dd>{cook} min cook</dd>
                </div>
              )}
              {time && prep != null && cook != null && (
                <div>
                  <dt className="sr-only">Total time</dt>
                  <dd>{time}</dd>
                </div>
              )}
              {hasAttribution && (
                <div>
                  <dt className="sr-only">Source</dt>
                  <dd>
                    {attribution?.name?.trim() && attribution?.url?.trim() ? (
                      <>
                        From{' '}
                        <a
                          href={attribution.url}
                          className="text-accent underline-offset-2 hover:underline dark:text-orange-300"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {attribution.name}
                        </a>
                      </>
                    ) : attribution?.url?.trim() ? (
                      <>
                        Source:{' '}
                        <a
                          href={attribution.url}
                          className="text-accent underline-offset-2 hover:underline dark:text-orange-300"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {attribution.url}
                        </a>
                      </>
                    ) : (
                      <>From {attribution?.name}</>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {scale !== 1 && (
              <p className="print-only hidden text-sm text-ink">
                Scaled {scale}×
              </p>
            )}
          </div>

          {chips.length > 0 && (
            <div className="no-print flex max-w-full flex-wrap justify-end gap-1.5 sm:max-w-md">
              {chips.map((chip, i) => (
                <Chip key={`${chip}-${i}`}>{chip}</Chip>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="recipe-body mt-8 grid gap-10 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <section className="lg:sticky lg:top-6">
          <h2 className="font-display text-2xl text-ink dark:text-stone-50">
            Ingredients
          </h2>
          <ul className={`mt-4 space-y-2 ${bodyTextClass}`}>
            {recipe.ingredients.map((ingredient) => {
              const checked = checkedIngredients.has(ingredient.id)
              const scaled = Math.abs(scale - 1) > 0.001
              const { quantity, name, notes } = formatIngredientParts({
                ...ingredient,
                amount: ingredient.amount * scale,
              })
              return (
                <li key={ingredient.id}>
                  <label className="flex cursor-pointer items-start gap-2.5 text-ink dark:text-stone-200">
                    <input
                      type="checkbox"
                      className="no-print mt-1 size-4 shrink-0 rounded border-stone-300 text-accent focus:ring-accent dark:border-stone-600 dark:bg-stone-800"
                      checked={checked}
                      onChange={() =>
                        setCheckedIngredients((prev) =>
                          toggleId(prev, ingredient.id),
                        )
                      }
                    />
                    <span
                      className={`recipe-check-text ${
                        checked
                          ? 'text-ink-muted opacity-60 dark:text-stone-500'
                          : ''
                      }`}
                    >
                      {scaled ? (
                        <span className="font-bold text-accent dark:text-orange-300">
                          {quantity}
                        </span>
                      ) : (
                        quantity
                      )}{' '}
                      {name}
                      {notes}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink dark:text-stone-50">
            Instructions
          </h2>
          <ol className={`mt-4 list-none space-y-4 ${bodyTextClass}`}>
            {recipe.steps.map((step, index) => {
              const checked = checkedSteps.has(step.id)
              return (
                <li key={step.id}>
                  <label className="flex cursor-pointer items-start gap-2.5 text-ink leading-relaxed dark:text-stone-200">
                    <input
                      type="checkbox"
                      className="no-print mt-1 size-4 shrink-0 rounded border-stone-300 text-accent focus:ring-accent dark:border-stone-600 dark:bg-stone-800"
                      checked={checked}
                      onChange={() =>
                        setCheckedSteps((prev) => toggleId(prev, step.id))
                      }
                    />
                    <span>
                      <span className="mr-1.5 font-medium text-ink-muted dark:text-stone-400">
                        {index + 1}.
                      </span>
                      <span
                        className={`recipe-check-text ${
                          checked
                            ? 'text-ink-muted opacity-60 dark:text-stone-500'
                            : ''
                        }`}
                      >
                        {step.text}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      {notes && (
        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink dark:text-stone-50">
            Notes
          </h2>
          <p className="mt-4 whitespace-pre-wrap text-ink leading-relaxed dark:text-stone-200">
            {notes}
          </p>
        </section>
      )}
    </main>
  )
}
