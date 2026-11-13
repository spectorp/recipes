export {}

declare global {
  interface ImportMetaEnv {
    readonly TAURI_ENV_PLATFORM?: string
  }
}
