import { useEffect, useState } from 'react'
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
} from '../lib/theme'

function SunIcon() {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
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
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
    </svg>
  )
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [appearance, setAppearance] = useState<'light' | 'dark'>(() =>
    resolveTheme(getStoredTheme()),
  )

  useEffect(() => {
    const sync = () => setAppearance(resolveTheme(getStoredTheme()))
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const next = appearance === 'dark' ? 'light' : 'dark'

  const toggle = () => {
    setStoredTheme(next)
    applyTheme(next)
    setAppearance(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === 'dark' ? 'Switch to dark theme' : 'Switch to light theme'}
      title={next === 'dark' ? 'Dark' : 'Light'}
      className={`inline-flex size-9 items-center justify-center rounded-md border border-stone-300 bg-white text-ink hover:border-stone-400 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-500 ${className}`}
    >
      {next === 'dark' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}
