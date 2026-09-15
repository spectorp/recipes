import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Chip, StarRating, recipeTimeLabel } from '../components/recipeMeta'
import { getRecipeById } from '../lib/catalog'
import { formatIngredientLine, recipeChipList } from '../lib/format'

const PRESET_MULTIPLIERS = [0.5, 1, 1.5, 2, 3] as const

function ServingsScaler({
  baseServings,
  servings,
  onChange,
}: {
  baseServings: number
  servings: number
  onChange: (next: number) => void
}) {
  const setFromMultiplier = (mult: number) => {
    const next = Math.max(1, Math.round(baseServings * mult))
    onChange(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-ink-muted dark:text-stone-400">Servings</span>
      <div className="inline-flex items-center rounded-md border border-stone-300 dark:border-stone-600">
        <button
          type="button"
          aria-label="Decrease servings"
          className="px-3 py-1.5 text-lg leading-none text-ink hover:bg-stone-100 disabled:opacity-40 dark:text-stone-100 dark:hover:bg-stone-800"
          disabled={servings <= 1}
          onClick={() => onChange(Math.max(1, servings - 1))}
        >
          −
        </button>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          aria-label="Number of servings"
          className="w-14 border-x border-stone-300 bg-transparent py-1.5 text-center text-sm text-ink focus:outline-none dark:border-stone-600 dark:text-stone-100"
          value={servings}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n) && n >= 1) onChange(Math.floor(n))
          }}
        />
        <button
          type="button"
          aria-label="Increase servings"
          className="px-3 py-1.5 text-lg leading-none text-ink hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800"
          onClick={() => onChange(servings + 1)}
        >
          +
        </button>
      </div>
      <div className="inline-flex gap-1">
        {PRESET_MULTIPLIERS.map((mult) => {
          const active = servings === Math.max(1, Math.round(baseServings * mult))
          return (
            <button
              key={mult}
              type="button"
              onClick={() => setFromMultiplier(mult)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                active
                  ? 'bg-accent text-white dark:bg-orange-700'
                  : 'border border-stone-300 text-ink-muted hover:border-accent/50 dark:border-stone-600 dark:text-stone-400'
              }`}
            >
              {`${mult}×`}
            </button>
          )
        })}
      </div>
      {servings !== baseServings && (
        <button
          type="button"
          onClick={() => onChange(baseServings)}
          className="text-xs text-accent underline-offset-2 hover:underline dark:text-orange-300"
        >
          Reset
        </button>
      )}
    </div>
  )
}

export function RecipePage() {
  const { id } = useParams<{ id: string }>()
  const recipe = id ? getRecipeById(id) : undefined
  const baseServings = recipe?.servings
  const [servings, setServings] = useState<number | null>(null)
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(
    () => new Set(),
  )
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(
    () => new Set(),
  )

  useEffect(() => {
    setServings(baseServings ?? null)
    setCheckedIngredients(new Set())
    setCheckedSteps(new Set())
  }, [recipe?.id, baseServings])

  useEffect(() => {
    const previous = document.title
    document.title = recipe ? `${recipe.title} · Recipes` : 'Recipe not found · Recipes'
    return () => {
      document.title = previous
    }
  }, [recipe])

  if (!recipe) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          className="text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300"
          to="/"
        >
          ← All recipes
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

  const scale =
    baseServings != null && servings != null && baseServings > 0
      ? servings / baseServings
      : 1
  const showScaler = baseServings != null && servings != null

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
          className="text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300"
          to="/"
        >
          ← All recipes
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:border-accent/50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
        >
          Print
        </button>
      </div>

      <header className="mt-4 border-b border-stone-200 pb-6 dark:border-stone-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-4xl tracking-tight text-ink dark:text-stone-50">
            {recipe.title}
          </h1>
          <StarRating rating={recipe.rating} className="text-lg" />
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted dark:text-stone-400">
          {!showScaler && recipe.servings != null && (
            <div>
              <dt className="sr-only">Servings</dt>
              <dd>{recipe.servings} servings</dd>
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
        </dl>

        {showScaler && (
          <>
            <div className="no-print mt-4">
              <ServingsScaler
                baseServings={baseServings}
                servings={servings}
                onChange={setServings}
              />
            </div>
            <p className="print-only mt-4 hidden text-sm text-ink">
              {servings} servings
              {scale !== 1 ? ` (scaled from ${baseServings})` : ''}
            </p>
          </>
        )}

        {chips.length > 0 && (
          <div className="no-print mt-4 flex flex-wrap gap-1.5">
            {chips.map((chip, i) => (
              <Chip key={`${chip}-${i}`}>{chip}</Chip>
            ))}
          </div>
        )}
      </header>

      <div className="recipe-body mt-8 grid gap-10 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <section className="lg:sticky lg:top-6">
          <h2 className="font-display text-2xl text-ink dark:text-stone-50">
            Ingredients
          </h2>
          {scale !== 1 && (
            <p className="no-print mt-1 text-xs text-ink-muted dark:text-stone-500">
              Scaled for {servings} servings (recipe base {baseServings})
            </p>
          )}
          <ul className="mt-4 space-y-2">
            {recipe.ingredients.map((ingredient) => {
              const checked = checkedIngredients.has(ingredient.id)
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
                      {formatIngredientLine({
                        ...ingredient,
                        amount: ingredient.amount * scale,
                      })}
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
          <ol className="mt-4 list-none space-y-4">
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

      {hasAttribution && (
        <footer className="mt-12 border-t border-stone-200 pt-6 text-sm text-ink-muted dark:border-stone-700 dark:text-stone-400">
          {attribution?.name?.trim() && attribution?.url?.trim() ? (
            <p>
              From{' '}
              <a
                href={attribution.url}
                className="text-accent underline-offset-2 hover:underline dark:text-orange-300"
                target="_blank"
                rel="noreferrer"
              >
                {attribution.name}
              </a>
            </p>
          ) : attribution?.url?.trim() ? (
            <p>
              Source:{' '}
              <a
                href={attribution.url}
                className="text-accent underline-offset-2 hover:underline dark:text-orange-300"
                target="_blank"
                rel="noreferrer"
              >
                {attribution.url}
              </a>
            </p>
          ) : (
            <p>From {attribution?.name}</p>
          )}
        </footer>
      )}
    </main>
  )
}
