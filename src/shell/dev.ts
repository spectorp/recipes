import { lazy } from 'react'

/** Browser `npm run dev`. The editor talks to the Vite plugin, not Tauri. */
export const showEditor = true
export const desktopBundle = false

export const EditorPage = lazy(() =>
  import('../dev/EditorPage').then((module) => ({ default: module.EditorPage })),
)

export const DataFolderScreen = null

export function useDesktopChrome(_canCreate: boolean): void {
  void _canCreate
}

export function printRecipe(): void {
  window.print()
}

export async function boot(): Promise<void> {}
