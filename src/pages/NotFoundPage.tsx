import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl text-ink dark:text-stone-50">
        Not found
      </h1>
      <p className="mt-3 text-ink-muted dark:text-stone-400">
        That page doesn&apos;t exist.
      </p>
      <Link
        className="mt-6 inline-block text-accent underline-offset-2 hover:underline dark:text-orange-300"
        to="/"
      >
        ← Back home
      </Link>
    </main>
  )
}
