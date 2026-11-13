import { setDiskLibrary, type DiskLibrary } from './diskSlot'
import { recipeJson, RecipeWriteError, prepareRecipeWrite } from './recipeWrite'
import type { RecipeWriteRequest } from '../dev/editorApi'

function desktopError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function emptyLibrary(message: string): DiskLibrary {
  return {
    path: null,
    message,
    recipes: [],
    categories: null,
    tags: null,
    categoriesError: null,
    tagsError: null,
  }
}

/** Read the recipe folder before the catalog module is imported. */
export async function primeDesktopLibrary(): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    setDiskLibrary(await invoke<DiskLibrary>('load_library'))
  } catch (error) {
    setDiskLibrary(emptyLibrary(desktopError(error, 'Could not open the recipe folder.')))
  }
}

export async function chooseDataFolder(): Promise<void> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({
    directory: true,
    multiple: false,
    title: 'Open data folder',
  })
  if (typeof picked !== 'string') return
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    await invoke('set_library', { path: picked })
  } catch (error) {
    throw new Error(desktopError(error, 'Could not open that folder.'))
  }
  window.location.reload()
}

export async function saveDesktopRecipe(
  existingId: string | null,
  body: RecipeWriteRequest,
): Promise<{ id: string }> {
  const catalog = await import('./catalog')
  let prepared
  try {
    const existing = existingId ? catalog.getRecipeById(existingId) : undefined
    const taken = new Set(catalog.recipeFileIds)
    prepared = prepareRecipeWrite({
      body,
      existingId,
      idExists: (candidate) => taken.has(candidate),
      createdAt: existing?.created_at ?? null,
      categories: catalog.categories,
      tags: catalog.tags,
    })
  } catch (error) {
    if (error instanceof RecipeWriteError) throw error
    throw new Error(desktopError(error, 'Could not save the recipe.'))
  }

  const { invoke } = await import('@tauri-apps/api/core')
  try {
    await invoke('save_files', {
      recipeId: prepared.id,
      recipeJson: recipeJson(prepared.recipe),
      categoriesJson: prepared.categories ? recipeJson(prepared.categories) : null,
      tagsJson: prepared.tags ? recipeJson(prepared.tags) : null,
    })
  } catch (error) {
    throw new Error(desktopError(error, 'Could not save the recipe.'))
  }
  return { id: prepared.id }
}

export async function deleteDesktopRecipe(id: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    await invoke('delete_recipe', { id })
  } catch (error) {
    throw new Error(desktopError(error, 'Could not delete the recipe.'))
  }
}
