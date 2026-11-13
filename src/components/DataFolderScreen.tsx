import { useState } from 'react'
import { chooseDataFolder } from '../lib/desktopLibrary'

export function DataFolderScreen({ message }: { message: string | null }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onChoose = () => {
    setPending(true)
    setError(null)
    void chooseDataFolder().catch((reason: unknown) => {
      setPending(false)
      setError(reason instanceof Error ? reason.message : 'Could not open that folder.')
    })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="font-display text-4xl tracking-tight text-ink dark:text-stone-50">Recipes</h1>
      <p className="mt-4 text-ink-muted dark:text-stone-400">
        Choose the data folder that contains{' '}
        <span className="font-mono text-sm">recipes</span>,{' '}
        <span className="font-mono text-sm">categories.json</span>, and{' '}
        <span className="font-mono text-sm">tags.json</span>. Edits stay in that folder.
      </p>
      {message && (
        <p className="mt-4 text-sm text-amber-900 dark:text-amber-200" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-red-800 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onChoose}
        disabled={pending}
        className="mt-8 inline-flex min-h-11 w-fit items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? 'Opening…' : 'Choose data folder'}
      </button>
      <p className="mt-6 text-sm text-ink-muted dark:text-stone-500">
        You can choose a different folder later from the File menu.
      </p>
    </main>
  )
}
