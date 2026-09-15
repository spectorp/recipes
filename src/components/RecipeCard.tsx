import { Link } from 'react-router-dom'
import type { Recipe } from '../lib/schema'
import { Chip, StarRating, recipeTimeLabel } from './recipeMeta'

function cardChips(recipe: Recipe): string[] {
  const chips: string[] = []
  for (const key of ['meal', 'method', 'cuisine', 'main_ingredient'] as const) {
    for (const value of recipe.categories?.[key] ?? []) {
      chips.push(value)
    }
  }
  for (const tag of recipe.tags ?? []) {
    chips.push(tag)
  }
  return chips.slice(0, 4)
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const time = recipeTimeLabel(recipe)
  const chips = cardChips(recipe)

  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="group block rounded-lg border border-stone-200/80 bg-white/60 p-4 transition hover:border-accent/40 hover:bg-white dark:border-stone-700 dark:bg-stone-900/40 dark:hover:border-orange-300/40 dark:hover:bg-stone-900"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl leading-snug text-ink group-hover:text-accent dark:text-stone-50 dark:group-hover:text-orange-300">
          {recipe.title}
        </h2>
        <StarRating rating={recipe.rating} className="shrink-0 text-sm" />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted dark:text-stone-400">
        {recipe.servings != null && <span>{recipe.servings} servings</span>}
        {time && <span>{time}</span>}
        {recipe.attribution?.name && (
          <span className="truncate">From {recipe.attribution.name}</span>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip, i) => (
            <Chip key={`${chip}-${i}`}>{chip}</Chip>
          ))}
        </div>
      )}
    </Link>
  )
}
