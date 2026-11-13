import {
  CATEGORY_KEYS,
  RECIPE_UNITS,
  recipeSchema,
  type CategoriesFile,
  type CategoryKey,
  type Recipe,
  type TagsFile,
} from './schema.ts'

const RECIPE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const UNIT_SET = new Set<string>(RECIPE_UNITS)

const CATEGORY_PREFIX: Record<CategoryKey, string> = {
  method: 'me',
  diet: 'd',
  meal: 'ml',
  season: 's',
  cuisine: 'c',
  main_ingredient: 'mi',
}

export class RecipeWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecipeWriteError'
  }
}

export function isSafeRecipeId(id: string): boolean {
  return RECIPE_ID_RE.test(id)
}

export type PreparedRecipeWrite = {
  id: string
  recipe: Record<string, unknown>
  /** Full vocab file when new names were appended; otherwise null. */
  categories: CategoriesFile | null
  tags: TagsFile | null
}

/**
 * Validate a recipe draft and build the JSON that should be written.
 * Does not touch the filesystem. The Vite dev server and the Mac app both use this.
 */
export function prepareRecipeWrite(input: {
  body: unknown
  existingId: string | null
  idExists: (id: string) => boolean
  createdAt: string | null
  categories: CategoriesFile
  tags: TagsFile
}): PreparedRecipeWrite {
  const normalized = normalizeWrite(input.body)
  const id =
    input.existingId ?? allocateId(normalized.title, input.idExists)
  if (input.existingId != null && !isSafeRecipeId(input.existingId)) {
    throw new RecipeWriteError('Invalid recipe id')
  }
  if (!id) {
    throw new RecipeWriteError('Title needs a letter or number so an id can be created')
  }

  const createdAt =
    input.existingId != null
      ? input.createdAt?.trim() || new Date().toISOString()
      : new Date().toISOString()

  const categoriesFile = structuredClone(input.categories)
  const tagsFile = structuredClone(input.tags)
  const categories = canonicalizeCategories(normalized.categories, categoriesFile)
  const tags = canonicalizeNames(normalized.tags, tagsFile.tags)

  const recipeInput: Record<string, unknown> = {
    id,
    title: normalized.title,
    ingredients: normalized.ingredients,
    steps: normalized.steps,
    created_at: createdAt,
    updated_at: new Date().toISOString(),
  }
  if (categories) recipeInput.categories = categories
  if (tags.length > 0) recipeInput.tags = tags
  if (normalized.servings != null) recipeInput.servings = normalized.servings
  if (normalized.prep_time_minutes != null) {
    recipeInput.prep_time_minutes = normalized.prep_time_minutes
  }
  if (normalized.cook_time_minutes != null) {
    recipeInput.cook_time_minutes = normalized.cook_time_minutes
  }
  if (normalized.rating != null) recipeInput.rating = normalized.rating
  if (normalized.attribution) recipeInput.attribution = normalized.attribution
  if (normalized.notes) recipeInput.notes = normalized.notes

  const parsed = recipeSchema.safeParse(recipeInput)
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
        return `${path}${issue.message}`
      })
      .join('; ')
    throw new RecipeWriteError(message)
  }

  const added = addMissingVocab(
    { categories: categoriesFile, tags: tagsFile },
    parsed.data.categories,
    tags,
  )

  return {
    id,
    recipe: serializeRecipe(parsed.data),
    categories: added.categories ? categoriesFile : null,
    tags: added.tags ? tagsFile : null,
  }
}

export function recipeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function isUnitName(value: string): value is (typeof RECIPE_UNITS)[number] {
  return UNIT_SET.has(value)
}

type NormalizedWrite = {
  title: string
  categories: Record<CategoryKey, string[]>
  tags: string[]
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  ingredients: Recipe['ingredients']
  steps: Recipe['steps']
  rating: number | null
  attribution: { name?: string; url?: string } | null
  notes: string
}

function normalizeWrite(body: unknown): NormalizedWrite {
  if (!body || typeof body !== 'object') throw new RecipeWriteError('Expected a JSON object')
  const record = body as Record<string, unknown>
  const title = cleanLine(record.title)
  if (!title) throw new RecipeWriteError('Title is required')

  return {
    title,
    categories: normalizeCategories(record.categories),
    tags: normalizeNameList(record.tags, 'Tags'),
    servings: optionalInt(record.servings, 'Servings'),
    prep_time_minutes: optionalInt(record.prep_time_minutes, 'Prep time'),
    cook_time_minutes: optionalInt(record.cook_time_minutes, 'Cook time'),
    ingredients: normalizeIngredients(record.ingredients),
    steps: normalizeSteps(record.steps),
    rating: optionalRating(record.rating),
    attribution: normalizeAttribution(record.attribution),
    notes: typeof record.notes === 'string' ? record.notes.trim() : '',
  }
}

function normalizeCategories(value: unknown): Record<CategoryKey, string[]> {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const categories = {} as Record<CategoryKey, string[]>
  for (const key of CATEGORY_KEYS) {
    categories[key] = normalizeNameList(source[key], key)
  }
  return categories
}

function normalizeNameList(value: unknown, label: string): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new RecipeWriteError(`${label} must be a list`)
  const seen = new Set<string>()
  const names: string[] = []
  for (const item of value) {
    const name = cleanLine(item).toLowerCase()
    if (!name) continue
    if (seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

function normalizeIngredients(value: unknown): Recipe['ingredients'] {
  if (!Array.isArray(value)) throw new RecipeWriteError('Ingredients must be a list')
  const used = new Set<string>()
  const ingredients: Recipe['ingredients'] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new RecipeWriteError('Ingredient is invalid')
    const row = item as Record<string, unknown>
    const name = cleanLine(row.name)
    const notes = typeof row.notes === 'string' ? row.notes.trim() : ''
    const group = cleanLine(row.group)
    const amount = optionalAmount(row.amount)
    const blank = !name && !notes && !group && amount == null && (row.unit == null || row.unit === '')
    if (blank) continue
    if (!name) throw new RecipeWriteError('Each ingredient needs a name')
    let unit: (typeof RECIPE_UNITS)[number] | null = null
    if (row.unit != null && row.unit !== '') {
      if (typeof row.unit !== 'string' || !isUnitName(row.unit)) {
        throw new RecipeWriteError(`Unit "${String(row.unit)}" is not allowed`)
      }
      unit = row.unit
    }
    const ingredient: Recipe['ingredients'][number] = {
      id: takeId(row.id, 'i', used),
      name,
      amount,
      unit,
    }
    if (notes) ingredient.notes = notes
    if (group) ingredient.group = group
    ingredients.push(ingredient)
  }
  return ingredients
}

function normalizeSteps(value: unknown): Recipe['steps'] {
  if (!Array.isArray(value)) throw new RecipeWriteError('Steps must be a list')
  const used = new Set<string>()
  const steps: Recipe['steps'] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new RecipeWriteError('Step is invalid')
    const row = item as Record<string, unknown>
    const text = typeof row.text === 'string' ? row.text.trim() : ''
    if (!text) continue
    steps.push({ id: takeId(row.id, 's', used), text })
  }
  return steps
}

function normalizeAttribution(value: unknown): { name?: string; url?: string } | null {
  if (value == null) return null
  if (typeof value !== 'object') throw new RecipeWriteError('Attribution is invalid')
  const row = value as Record<string, unknown>
  const name = cleanLine(row.name)
  const url = typeof row.url === 'string' ? row.url.trim() : ''
  if (!name && !url) return null
  const attribution: { name?: string; url?: string } = {}
  if (name) attribution.name = name
  if (url) attribution.url = url
  return attribution
}

function optionalInt(value: unknown, label: string): number | null {
  if (value == null || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new RecipeWriteError(`${label} must be a whole number`)
  }
  if (label === 'Servings' && value < 1) throw new RecipeWriteError('Servings must be at least 1')
  return value
}

function optionalAmount(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RecipeWriteError('Ingredient amount must be a number, or blank when there is no quantity')
  }
  return value
}

function optionalRating(value: unknown): number | null {
  if (value == null || value === '' || value === 0) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new RecipeWriteError('Rating must be from 1 to 5')
  }
  return value
}

function canonicalizeCategories(
  categories: Record<CategoryKey, string[]>,
  vocab: CategoriesFile,
): Recipe['categories'] {
  const result: NonNullable<Recipe['categories']> = {}
  for (const key of CATEGORY_KEYS) {
    const names = canonicalizeNames(categories[key], vocab[key])
    if (names.length > 0) result[key] = names
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function canonicalizeNames(names: string[], vocab: { name: string }[]): string[] {
  return names.map((name) => {
    const match = vocab.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
    return match ? match.name : name.toLowerCase()
  })
}

function addMissingVocab(
  vocab: { categories: CategoriesFile; tags: TagsFile },
  categories: Recipe['categories'],
  tags: string[],
): { categories: boolean; tags: boolean } {
  let categoriesChanged = false
  let tagsChanged = false
  for (const key of CATEGORY_KEYS) {
    for (const name of categories?.[key] ?? []) {
      if (vocab.categories[key].some((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
        continue
      }
      vocab.categories[key].push({
        id: nextVocabId(CATEGORY_PREFIX[key], vocab.categories[key]),
        name,
      })
      categoriesChanged = true
    }
  }
  for (const name of tags) {
    if (vocab.tags.tags.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) continue
    vocab.tags.tags.push({ id: nextVocabId('t', vocab.tags.tags), name })
    tagsChanged = true
  }
  return { categories: categoriesChanged, tags: tagsChanged }
}

function nextVocabId(prefix: string, entries: { id: string }[]): string {
  const re = new RegExp(`^${prefix}(\\d+)$`)
  let max = 0
  for (const entry of entries) {
    const match = re.exec(entry.id)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}${max + 1}`
}

function serializeRecipe(recipe: Recipe): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: recipe.id,
    title: recipe.title,
  }
  if (recipe.categories) {
    const categories: Record<string, string[]> = {}
    for (const key of CATEGORY_KEYS) {
      const values = recipe.categories[key]
      if (values && values.length > 0) categories[key] = values
    }
    if (Object.keys(categories).length > 0) out.categories = categories
  }
  if (recipe.tags && recipe.tags.length > 0) out.tags = recipe.tags
  if (recipe.servings != null) out.servings = recipe.servings
  if (recipe.prep_time_minutes != null) out.prep_time_minutes = recipe.prep_time_minutes
  if (recipe.cook_time_minutes != null) out.cook_time_minutes = recipe.cook_time_minutes
  out.ingredients = recipe.ingredients.map((ingredient) => {
    const row: Record<string, unknown> = {
      id: ingredient.id,
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit ?? null,
    }
    if (ingredient.notes) row.notes = ingredient.notes
    if (ingredient.group) row.group = ingredient.group
    return row
  })
  out.steps = recipe.steps.map((step) => ({ id: step.id, text: step.text }))
  if (recipe.rating != null) out.rating = recipe.rating
  if (recipe.attribution) out.attribution = recipe.attribution
  if (recipe.notes) out.notes = recipe.notes
  if (recipe.created_at) out.created_at = recipe.created_at
  if (recipe.updated_at) out.updated_at = recipe.updated_at
  return out
}

function allocateId(title: string, idExists: (id: string) => boolean): string {
  const base = slugifyTitle(title)
  if (!base || !isSafeRecipeId(base)) return ''
  if (!idExists(base)) return base
  let n = 2
  while (idExists(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

function slugifyTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function takeId(value: unknown, prefix: string, used: Set<string>): string {
  if (typeof value === 'string' && /^[a-z][a-z0-9_-]{0,40}$/i.test(value) && !used.has(value)) {
    used.add(value)
    return value
  }
  let n = 1
  while (used.has(`${prefix}${n}`)) n += 1
  const id = `${prefix}${n}`
  used.add(id)
  return id
}

function cleanLine(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}
