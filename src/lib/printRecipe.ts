import { runningInTauri } from './runtime'

export function printRecipe(): void {
  if (import.meta.env.TAURI_ENV_PLATFORM && runningInTauri()) {
    void import('@tauri-apps/api/core').then(({ invoke }) => invoke('plugin:webview|print'))
    return
  }
  window.print()
}
