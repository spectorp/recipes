import type { Recipe } from './schema'

/** Display amount without ugly float noise. */
export function formatAmount(amount: number): string {
  if (Number.isInteger(amount)) return String(amount)

  const fractions: [number, string][] = [
    [0.125, '⅛'],
    [0.25, '¼'],
    [0.333, '⅓'],
    [1 / 3, '⅓'],
    [0.375, '⅜'],
    [0.5, '½'],
    [0.625, '⅝'],
    [0.667, '⅔'],
    [2 / 3, '⅔'],
    [0.75, '¾'],
    [0.875, '⅞'],
  ]

  for (const [value, label] of fractions) {
    if (Math.abs(amount - value) < 0.02) return label
  }

  const whole = Math.floor(amount)
  const frac = amount - whole
  for (const [value, label] of fractions) {
    if (Math.abs(frac - value) < 0.02) {
      return whole > 0 ? `${whole} ${label}` : label
    }
  }

  return Number(amount.toFixed(2)).toString()
}

export function formatIngredientParts(ingredient: {
  name: string
  amount: number
  unit?: string | null
  notes?: string
}): { quantity: string; name: string; notes: string } {
  const amount = formatAmount(ingredient.amount)
  const unit = ingredient.unit
  const quantity = unit ? `${amount} ${unit}` : amount
  const notes =
    ingredient.notes && ingredient.notes.trim()
      ? ` (${ingredient.notes.trim()})`
      : ''
  return { quantity, name: ingredient.name, notes }
}

export function formatIngredientLine(ingredient: {
  name: string
  amount: number
  unit?: string | null
  notes?: string
}): string {
  const { quantity, name, notes } = formatIngredientParts(ingredient)
  return `${quantity} ${name}${notes}`
}

export function recipeChipList(recipe: Recipe): string[] {
  const chips: string[] = []
  for (const key of [
    'meal',
    'method',
    'diet',
    'season',
    'cuisine',
    'main_ingredient',
  ] as const) {
    chips.push(...(recipe.categories?.[key] ?? []))
  }
  chips.push(...(recipe.tags ?? []))
  return chips
}
