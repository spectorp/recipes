import { Link, useParams } from 'react-router-dom'
import { getRecipeById } from '../lib/catalog'

export function RecipePage() {
  const { id } = useParams<{ id: string }>()
  const recipe = id ? getRecipeById(id) : undefined

  if (!recipe) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link
          className="text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300"
          to="/"
        >
          ← All recipes
        </Link>
        <h1 className="font-display mt-4 text-3xl tracking-tight text-ink dark:text-stone-50">
          Recipe not found
        </h1>
        <p className="mt-2 font-mono text-sm text-ink-muted dark:text-stone-400">
          id: {id ?? '(missing)'}
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        className="text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300"
        to="/"
      >
        ← All recipes
      </Link>
      <h1 className="font-display mt-4 text-3xl tracking-tight text-ink dark:text-stone-50">
        {recipe.title}
      </h1>
      <p className="mt-2 font-mono text-sm text-ink-muted dark:text-stone-400">
        id: {recipe.id}
      </p>
      <p className="mt-6 text-ink-muted dark:text-stone-400">
        Loaded from JSON ({recipe.ingredients.length} ingredients,{' '}
        {recipe.steps.length} steps). Full detail UI comes in a later phase.
      </p>
    </main>
  )
}
