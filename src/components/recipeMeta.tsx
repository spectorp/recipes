import type { ReactNode } from 'react'
import type { Recipe } from '../lib/schema'

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export function recipeTimeLabel(recipe: Recipe): string | null {
  const prep = recipe.prep_time_minutes
  const cook = recipe.cook_time_minutes
  if (prep == null && cook == null) return null
  if (prep != null && cook != null) {
    return `${formatMinutes(prep + cook)} total`
  }
  if (prep != null) return `${formatMinutes(prep)} prep`
  return `${formatMinutes(cook!)} cook`
}

export function StarRating({
  rating,
  className = '',
}: {
  rating: number | null | undefined
  className?: string
}) {
  if (rating == null || rating === 0) return null
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300 ${className}`}
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} aria-hidden="true">
          {i < rating ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-stone-200/80 px-2 py-0.5 text-xs text-ink-muted dark:bg-stone-700 dark:text-stone-300">
      {children}
    </span>
  )
}
