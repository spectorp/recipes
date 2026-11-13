import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { useDesktopChrome } from '../lib/desktopChrome'
import { printRecipe } from '../lib/printRecipe'
import { runningInTauri } from '../lib/runtime'

/** Mac app (`tauri dev` and `tauri build`). The Pages build swaps this file. */
export const showEditor = true
export const desktopBundle = true

export const EditorPage: LazyExoticComponent<ComponentType> | null = lazy(() =>
  import('../dev/EditorPage').then((module) => ({ default: module.EditorPage })),
)

export const DataFolderScreen: LazyExoticComponent<
  ComponentType<{ message: string | null }>
> | null = lazy(() =>
  import('../components/DataFolderScreen').then((module) => ({
    default: module.DataFolderScreen,
  })),
)

export { printRecipe, useDesktopChrome }

export async function boot(): Promise<void> {
  if (!runningInTauri()) return
  const { primeDesktopLibrary } = await import('../lib/desktopLibrary')
  await primeDesktopLibrary()
}
