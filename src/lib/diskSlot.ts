/** Set by the Mac app before the catalog module loads. The website leaves this empty. */
export type DiskRecipeFile = {
  filename: string
  data: unknown
  error: string | null
}

export type DiskLibrary = {
  path: string | null
  message: string | null
  recipes: DiskRecipeFile[]
  categories: unknown
  tags: unknown
  categoriesError: string | null
  tagsError: string | null
}

let primed: DiskLibrary | null = null

export function setDiskLibrary(library: DiskLibrary): void {
  primed = library
}

export function peekDiskLibrary(): DiskLibrary | null {
  return primed
}
