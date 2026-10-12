import { CATEGORY_KEYS, RECIPE_UNITS, type CategoryKey, type Recipe } from '../lib/schema'

export type IngredientDraft = {
  key: string
  id: string
  amount: string
  unit: string
  name: string
  notes: string
  group: string
}

export type StepDraft = {
  key: string
  id: string
  text: string
}

export type RecipeDraft = {
  title: string
  categories: Record<CategoryKey, string[]>
  tags: string[]
  servings: string
  prep_time_minutes: string
  cook_time_minutes: string
  ingredients: IngredientDraft[]
  steps: StepDraft[]
  rating: number | null
  attributionName: string
  attributionUrl: string
  notes: string
}

export type RecipeWriteRequest = {
  title: string
  categories: Record<CategoryKey, string[]>
  tags: string[]
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  ingredients: {
    id: string
    name: string
    amount: number | null
    unit: string | null
    notes: string
    group: string
  }[]
  steps: { id: string; text: string }[]
  rating: number | null
  attribution: { name: string; url: string } | null
  notes: string
}

export function emptyDraft(): RecipeDraft {
  return {
    title: '',
    categories: {
      method: [],
      diet: [],
      meal: [],
      season: [],
      cuisine: [],
      main_ingredient: [],
    },
    tags: [],
    servings: '',
    prep_time_minutes: '',
    cook_time_minutes: '',
    ingredients: [blankIngredient('new-ingredient')],
    steps: [blankStep('new-step')],
    rating: null,
    attributionName: '',
    attributionUrl: '',
    notes: '',
  }
}

export function draftFromRecipe(recipe: Recipe): RecipeDraft {
  const categories = {} as Record<CategoryKey, string[]>
  for (const key of CATEGORY_KEYS) {
    categories[key] = [...(recipe.categories?.[key] ?? [])]
  }
  return {
    title: recipe.title,
    categories,
    tags: [...(recipe.tags ?? [])],
    servings: recipe.servings == null ? '' : String(recipe.servings),
    prep_time_minutes:
      recipe.prep_time_minutes == null ? '' : String(recipe.prep_time_minutes),
    cook_time_minutes:
      recipe.cook_time_minutes == null ? '' : String(recipe.cook_time_minutes),
    ingredients:
      recipe.ingredients.length > 0
        ? recipe.ingredients.map((ingredient) => ({
            key: ingredient.id,
            id: ingredient.id,
            amount: ingredient.amount == null ? '' : String(ingredient.amount),
            unit: ingredient.unit ?? '',
            name: ingredient.name,
            notes: ingredient.notes ?? '',
            group: ingredient.group ?? '',
          }))
        : [blankIngredient('new-ingredient')],
    steps:
      recipe.steps.length > 0
        ? recipe.steps.map((step) => ({
            key: step.id,
            id: step.id,
            text: step.text,
          }))
        : [blankStep('new-step')],
    rating: recipe.rating && recipe.rating > 0 ? recipe.rating : null,
    attributionName: recipe.attribution?.name ?? '',
    attributionUrl: recipe.attribution?.url ?? '',
    notes: recipe.notes ?? '',
  }
}

export function blankIngredient(key: string): IngredientDraft {
  return { key, id: '', amount: '', unit: '', name: '', notes: '', group: '' }
}

export function blankStep(key: string): StepDraft {
  return { key, id: '', text: '' }
}

export function validateDraft(draft: RecipeDraft):
  | { ok: true; body: RecipeWriteRequest }
  | { ok: false; errors: string[] } {
  const errors: string[] = []
  const title = draft.title.trim()
  if (!title) errors.push('Title is required.')

  const servings = readWholeNumber(draft.servings, 'Servings', 1, errors)
  const prep = readWholeNumber(draft.prep_time_minutes, 'Prep time', 0, errors)
  const cook = readWholeNumber(draft.cook_time_minutes, 'Cook time', 0, errors)

  const ingredients = []
  for (const [index, ingredient] of draft.ingredients.entries()) {
    const name = ingredient.name.trim()
    const notes = ingredient.notes.trim()
    const group = ingredient.group.trim()
    const amountText = ingredient.amount.trim()
    const blank =
      !name && !notes && !group && !amountText && !ingredient.unit
    if (blank) continue
    const amount = readAmount(amountText, index + 1, errors)
    if (!name) errors.push(`Ingredient ${index + 1} needs a name.`)
    if (ingredient.unit && !(RECIPE_UNITS as readonly string[]).includes(ingredient.unit)) {
      errors.push(`Ingredient ${index + 1} has an unknown unit.`)
    }
    ingredients.push({
      id: ingredient.id,
      name,
      amount: amount ?? null,
      unit: ingredient.unit || null,
      notes,
      group,
    })
  }

  const steps = draft.steps
    .map((step) => ({ id: step.id, text: step.text.trim() }))
    .filter((step) => step.text.length > 0)

  if (draft.rating != null && (draft.rating < 1 || draft.rating > 5)) {
    errors.push('Rating must be from 1 to 5.')
  }

  if (errors.length > 0) return { ok: false, errors }

  const attributionName = draft.attributionName.trim()
  const attributionUrl = draft.attributionUrl.trim()

  return {
    ok: true,
    body: {
      title,
      categories: draft.categories,
      tags: draft.tags,
      servings,
      prep_time_minutes: prep,
      cook_time_minutes: cook,
      ingredients,
      steps,
      rating: draft.rating,
      attribution:
        attributionName || attributionUrl
          ? { name: attributionName, url: attributionUrl }
          : null,
      notes: draft.notes.trim(),
    },
  }
}

function readWholeNumber(
  raw: string,
  label: string,
  min: number,
  errors: string[],
): number | null {
  const text = raw.trim()
  if (!text) return null
  if (!/^\d+$/.test(text)) {
    errors.push(`${label} must be a whole number.`)
    return null
  }
  const value = Number(text)
  if (value < min) {
    errors.push(min === 1 ? `${label} must be at least 1.` : `${label} cannot be negative.`)
    return null
  }
  return value
}

function readAmount(raw: string, index: number, errors: string[]): number | null {
  if (!raw) return null
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(raw)) {
    errors.push(
      `Ingredient ${index} amount must be a number, or left blank when there is no quantity.`,
    )
    return null
  }
  return Number(raw)
}

export async function saveRecipe(
  id: string | null,
  body: RecipeWriteRequest,
): Promise<{ id: string }> {
  const path = id
    ? `__editor/recipes/${encodeURIComponent(id)}`
    : '__editor/recipes'
  const data = await request(path, id ? 'PUT' : 'POST', body)
  if (!data.id) throw new Error('Save did not return a recipe id.')
  return { id: data.id }
}

export async function deleteRecipe(id: string): Promise<void> {
  await request(`__editor/recipes/${encodeURIComponent(id)}`, 'DELETE')
}

async function request(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ id?: string; error?: string }> {
  const url = `${import.meta.env.BASE_URL}${path}`
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the local editor. Run npm run dev on this computer.')
  }

  const text = await response.text()
  let data: { id?: string; error?: string } | null = null
  if (text) {
    try {
      data = JSON.parse(text) as { id?: string; error?: string }
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    if (!data && response.status === 404) {
      throw new Error(
        'The editor API is not on this dev server. Stop npm run dev and start it again.',
      )
    }
    throw new Error(data?.error || `Request failed (${response.status}).`)
  }
  if (!data) {
    throw new Error('The editor API is only available while npm run dev is running.')
  }
  return data
}
