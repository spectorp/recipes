import { useEffect, useState } from 'react'
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  type ThemePreference,
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
      className="size-3.5"
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
      className="size-3.5"
      aria-hidden
    >
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
    </svg>
  )
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    getStoredTheme(),
  )
  const [appearance, setAppearance] = useState<'light' | 'dark'>(() =>
    resolveTheme(getStoredTheme()),
  )

  useEffect(() => {
    const sync = () => setAppearance(resolveTheme(getStoredTheme()))
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const select = (next: 'light' | 'dark') => {
    // Clicking the already-forced mode returns to system default.
    const nextPref: ThemePreference = preference === next ? 'system' : next
    setStoredTheme(nextPref)
    applyTheme(nextPref)
    setPreference(nextPref)
    setAppearance(resolveTheme(nextPref))
  }

  const buttonClass = (mode: 'light' | 'dark') => {
    const active = appearance === mode
    const forced = preference === mode
    if (active && forced) {
      return 'bg-accent text-white dark:bg-orange-700'
    }
    if (active) {
      return 'bg-stone-200 text-ink dark:bg-stone-700 dark:text-stone-100'
    }
    return 'text-ink-muted hover:bg-stone-100 hover:text-ink dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100'
  }

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        onClick={() => select('light')}
        aria-label="Light theme"
        aria-pressed={preference === 'light'}
        title={
          preference === 'light'
            ? 'Light (click again for system)'
            : 'Light theme'
        }
        className={`inline-flex size-9 items-center justify-center rounded-md transition-colors ${buttonClass('light')}`}
      >
        <SunIcon />
      </button>
      <button
        type="button"
        onClick={() => select('dark')}
        aria-label="Dark theme"
        aria-pressed={preference === 'dark'}
        title={
          preference === 'dark'
            ? 'Dark (click again for system)'
            : 'Dark theme'
        }
        className={`inline-flex size-9 items-center justify-center rounded-md transition-colors ${buttonClass('dark')}`}
      >
        <MoonIcon />
      </button>
    </div>
  )
}
