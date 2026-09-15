import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl tracking-tight text-ink dark:text-stone-50">
        Perry&apos;s recipes
      </h1>
      <p className="mt-3 text-ink-muted dark:text-stone-400">
        Browse recipes from this repo. The catalog will appear here once recipes
        are migrated to JSON.
      </p>
      <p className="mt-8 text-sm text-ink-muted dark:text-stone-500">
        Scaffold only — try a{' '}
        <Link
          className="text-accent underline-offset-2 hover:underline dark:text-orange-300"
          to="/recipe/example"
        >
          deep link stub
        </Link>
        .
      </p>
    </main>
  )
}
