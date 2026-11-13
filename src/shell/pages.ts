/** GitHub Pages build. No editor, no Tauri imports. */

export const showEditor = false
export const desktopBundle = false
export const EditorPage = null
export const DataFolderScreen = null

export function useDesktopChrome(_canCreate: boolean): void {
  void _canCreate
}

export function printRecipe(): void {
  window.print()
}

export async function boot(): Promise<void> {}
