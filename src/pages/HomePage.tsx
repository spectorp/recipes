import { Link } from 'react-router-dom'
import { catalogLoadErrors, recipes } from '../lib/catalog'

export function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl tracking-tight text-ink dark:text-stone-50">
        Perry&apos;s recipes
      </h1>
      <p className="mt-3 text-ink-muted dark:text-stone-400">
        {recipes.length === 0
          ? 'No recipes loaded yet. JSON files will appear here after migration.'
          : `${recipes.length} recipe${recipes.length === 1 ? '' : 's'} loaded.`}
      </p>

      {catalogLoadErrors.length > 0 && (
        <div
          className="mt-6 rounded-md border border-amber-700/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100"
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

      {recipes.length > 0 && (
        <ul className="mt-8 divide-y divide-stone-200 dark:divide-stone-700">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <Link
                className="block py-3 text-lg text-ink hover:text-accent dark:text-stone-100 dark:hover:text-orange-300"
                to={`/recipe/${recipe.id}`}
              >
                {recipe.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {recipes.length === 0 && (
        <p className="mt-8 text-sm text-ink-muted dark:text-stone-500">
          Data pipeline is ready — add files under{' '}
          <code className="font-mono text-xs">data/recipes/</code>.
        </p>
      )}
    </main>
  )
}
