import { Link, useParams } from 'react-router-dom'

export function RecipePage() {
  const { id } = useParams<{ id: string }>()

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        className="text-sm text-accent underline-offset-2 hover:underline dark:text-orange-300"
        to="/"
      >
        ← All recipes
      </Link>
      <h1 className="font-display mt-4 text-3xl tracking-tight text-ink dark:text-stone-50">
        Recipe
      </h1>
      <p className="mt-2 font-mono text-sm text-ink-muted dark:text-stone-400">
        id: {id ?? '(missing)'}
      </p>
      <p className="mt-6 text-ink-muted dark:text-stone-400">
        Detail view stub. Recipe JSON will load here in a later phase.
      </p>
    </main>
  )
}
