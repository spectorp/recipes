import categoriesJson from '../../data/categories.json'
import tagsJson from '../../data/tags.json'
import { peekDiskLibrary, type DiskLibrary } from './diskSlot'
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

const EMPTY_CATEGORIES: CategoriesFile = {
  method: [],
  diet: [],
  meal: [],
  season: [],
  cuisine: [],
  main_ingredient: [],
}

const loadErrors: LoadError[] = []
const recipesById = new Map<string, Recipe>()
const fileIds: string[] = []

function addRecipe(source: string, fileId: string, raw: unknown, readError: string | null): void {
  fileIds.push(fileId)
  if (readError) {
    loadErrors.push({ source, message: readError })
    console.warn(`[catalog] Skipping recipe ${source}: ${readError}`)
    return
  }

  const parsed = recipeSchema.safeParse(raw)
  if (!parsed.success) {
    const message = formatZodError(parsed.error)
    loadErrors.push({ source, message })
    console.warn(`[catalog] Skipping invalid recipe ${source}: ${message}`)
    return
  }

  const recipe = parsed.data
  if (recipe.id !== fileId) {
    const message = `id "${recipe.id}" does not match filename "${fileId}.json"`
    loadErrors.push({ source, message })
    console.warn(`[catalog] Skipping recipe ${source}: ${message}`)
    return
  }

  if (recipesById.has(recipe.id)) {
    const message = `duplicate id "${recipe.id}"`
    loadErrors.push({ source, message })
    console.warn(`[catalog] Skipping recipe ${source}: ${message}`)
    return
  }

  recipesById.set(recipe.id, recipe)
}

function parseCategories(value: unknown, readError: string | null): CategoriesFile {
  if (readError) {
    loadErrors.push({ source: 'data/categories.json', message: readError })
    console.warn(`[catalog] Invalid categories.json: ${readError}`)
    return EMPTY_CATEGORIES
  }
  if (value == null) return EMPTY_CATEGORIES
  const result = categoriesFileSchema.safeParse(value)
  if (!result.success) {
    const message = formatZodError(result.error)
    loadErrors.push({ source: 'data/categories.json', message })
    console.warn(`[catalog] Invalid categories.json: ${message}`)
    return EMPTY_CATEGORIES
  }
  return result.data
}

function parseTags(value: unknown, readError: string | null): TagsFile {
  if (readError) {
    loadErrors.push({ source: 'data/tags.json', message: readError })
    console.warn(`[catalog] Invalid tags.json: ${readError}`)
    return { tags: [] }
  }
  if (value == null) return { tags: [] }
  const result = tagsFileSchema.safeParse(value)
  if (!result.success) {
    const message = formatZodError(result.error)
    loadErrors.push({ source: 'data/tags.json', message })
    console.warn(`[catalog] Invalid tags.json: ${message}`)
    return { tags: [] }
  }
  return result.data
}

function loadBundled(): { categories: CategoriesFile; tags: TagsFile } {
  for (const [path, raw] of Object.entries(recipeModules)) {
    addRecipe(path, basenameId(path), raw, null)
  }
  return {
    categories: parseCategories(categoriesJson, null),
    tags: parseTags(tagsJson, null),
  }
}

function loadDisk(disk: DiskLibrary): { categories: CategoriesFile; tags: TagsFile } {
  for (const file of disk.recipes) {
    const fileId = basenameId(file.filename)
    addRecipe(`data/recipes/${file.filename}`, fileId, file.data, file.error)
  }
  return {
    categories: parseCategories(disk.categories, disk.categoriesError),
    tags: parseTags(disk.tags, disk.tagsError),
  }
}

/**
 * The Mac app primes this before the catalog module loads.
 * The website and `npm run dev` leave it empty and use the bundled JSON.
 */
const diskLibrary = peekDiskLibrary()
const vocab = diskLibrary ? loadDisk(diskLibrary) : loadBundled()

/** All valid recipes, sorted by title (case-insensitive). */
export const recipes: Recipe[] = [...recipesById.values()].sort((a, b) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
)

export const categories: CategoriesFile = vocab.categories
export const tags: TagsFile = vocab.tags
export const catalogLoadErrors: LoadError[] = loadErrors

/** Filename stems, including files that failed validation. Used when allocating a new id. */
export const recipeFileIds: readonly string[] = fileIds

/** Set when the Mac app loaded a folder. Null on the website. */
export const dataFolderPath: string | null = diskLibrary?.path ? diskLibrary.path : null
export const dataFolderMessage: string | null = diskLibrary?.message ?? null

export function getRecipeById(id: string): Recipe | undefined {
  return recipesById.get(id)
}

// Dev editor writes JSON while this page is open. Accept the update here so
// Vite does not reload the editor and discard unsaved form state. A full
// navigation after save still loads the new catalog.
if (import.meta.hot) {
  import.meta.hot.accept()
}
