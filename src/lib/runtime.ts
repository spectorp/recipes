/** True inside the Mac app webview. False in a normal browser, including one pointed at `tauri dev`. */
export function runningInTauri(): boolean {
  if (typeof window === 'undefined') return false
  const host = window as Window & { __TAURI_INTERNALS__?: unknown; isTauri?: boolean }
  return host.__TAURI_INTERNALS__ != null || host.isTauri === true
}
