import { useState } from 'react'
import {
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  type ThemePreference,
} from '../lib/theme'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<ThemePreference>(() => getStoredTheme())

  const select = (next: ThemePreference) => {
    setStoredTheme(next)
    applyTheme(next)
    setTheme(next)
  }

  return (
    <div
      className={`inline-flex rounded-md border border-stone-300 dark:border-stone-600 ${className}`}
      role="group"
      aria-label="Color theme"
    >
      {OPTIONS.map(({ value, label }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => select(value)}
            aria-pressed={active}
            className={`px-2.5 py-1 text-xs font-medium ${
              active
                ? 'bg-accent text-white dark:bg-orange-700'
                : 'bg-white text-ink-muted hover:text-ink dark:bg-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
