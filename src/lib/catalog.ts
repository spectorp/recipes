import categoriesJson from '../../data/categories.json'
import tagsJson from '../../data/tags.json'
import {
  categoriesFileSchema,
  recipeSchema,
  tagsFileSchema,
  type CategoriesFile,
  type Recipe,
  type TagsFile,
} from './schema'

export type LoadError = {
  source: string
  message: string
}

function basenameId(path: string): string {
  const file = path.split('/').pop() ?? path
  return file.replace(/\.json$/i, '')
}

function formatZodError(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    .join('; ')
}

/**
 * Build-time recipe catalog via Vite `import.meta.glob`.
 * Invalid files are skipped; see `catalogLoadErrors`.
 */
const recipeModules = import.meta.glob('../../data/recipes/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

const loadErrors: LoadError[] = []
const recipesById = new Map<string, Recipe>()

for (const [path, raw] of Object.entries(recipeModules)) {
  const fileId = basenameId(path)
  const parsed = recipeSchema.safeParse(raw)

  if (!parsed.success) {
    const message = formatZodError(parsed.error)
    loadErrors.push({ source: path, message })
    console.warn(`[catalog] Skipping invalid recipe ${path}: ${message}`)
    continue
  }

  const recipe = parsed.data

  if (recipe.id !== fileId) {
    const message = `id "${recipe.id}" does not match filename "${fileId}.json"`
    loadErrors.push({ source: path, message })
    console.warn(`[catalog] Skipping recipe ${path}: ${message}`)
    continue
  }

  if (recipesById.has(recipe.id)) {
    const message = `duplicate id "${recipe.id}"`
    loadErrors.push({ source: path, message })
    console.warn(`[catalog] Skipping recipe ${path}: ${message}`)
    continue
  }

  recipesById.set(recipe.id, recipe)
}

function loadVocab(): { categories: CategoriesFile; tags: TagsFile } {
  const categoriesResult = categoriesFileSchema.safeParse(categoriesJson)
  if (!categoriesResult.success) {
    const message = formatZodError(categoriesResult.error)
    loadErrors.push({ source: 'data/categories.json', message })
    console.warn(`[catalog] Invalid categories.json: ${message}`)
  }

  const tagsResult = tagsFileSchema.safeParse(tagsJson)
  if (!tagsResult.success) {
    const message = formatZodError(tagsResult.error)
    loadErrors.push({ source: 'data/tags.json', message })
    console.warn(`[catalog] Invalid tags.json: ${message}`)
  }

  return {
    categories: categoriesResult.success
      ? categoriesResult.data
      : {
          method: [],
          diet: [],
          meal: [],
          season: [],
          cuisine: [],
          main_ingredient: [],
        },
    tags: tagsResult.success ? tagsResult.data : { tags: [] },
  }
}

const vocab = loadVocab()

/** All valid recipes, sorted by title (case-insensitive). */
export const recipes: Recipe[] = [...recipesById.values()].sort((a, b) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
)

export const categories: CategoriesFile = vocab.categories
export const tags: TagsFile = vocab.tags
export const catalogLoadErrors: LoadError[] = loadErrors

export function getRecipeById(id: string): Recipe | undefined {
  return recipesById.get(id)
}
