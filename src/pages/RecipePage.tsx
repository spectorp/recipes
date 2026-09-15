import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Chip, StarRating, recipeTimeLabel } from '../components/recipeMeta'
import { getRecipeById } from '../lib/catalog'
import { formatIngredientLine, recipeChipList } from '../lib/format'

export function RecipePage() {
  const { id } = useParams<{ id: string }>()
  const recipe = id ? getRecipeById(id) : undefined

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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        className="text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300"
        to="/"
      >
        ← All recipes
      </Link>

      <header className="mt-4 border-b border-stone-200 pb-6 dark:border-stone-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-4xl tracking-tight text-ink dark:text-stone-50">
            {recipe.title}
          </h1>
          <StarRating rating={recipe.rating} className="text-lg" />
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted dark:text-stone-400">
          {recipe.servings != null && (
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

        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {chips.map((chip, i) => (
              <Chip key={`${chip}-${i}`}>{chip}</Chip>
            ))}
          </div>
        )}
      </header>

      <section className="mt-8">
        <h2 className="font-display text-2xl text-ink dark:text-stone-50">
          Ingredients
        </h2>
        <ul className="mt-4 space-y-2">
          {recipe.ingredients.map((ingredient) => (
            <li
              key={ingredient.id}
              className="text-ink dark:text-stone-200"
            >
              {formatIngredientLine(ingredient)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink dark:text-stone-50">
          Instructions
        </h2>
        <ol className="mt-4 list-decimal space-y-4 pl-5">
          {recipe.steps.map((step) => (
            <li
              key={step.id}
              className="pl-1 text-ink leading-relaxed dark:text-stone-200"
            >
              {step.text}
            </li>
          ))}
        </ol>
      </section>

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
