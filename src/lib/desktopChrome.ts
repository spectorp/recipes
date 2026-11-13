import { useEffect } from 'react'
import { runningInTauri } from './runtime'

/** Mac menu actions and opening attribution links in the system browser. */
export function useDesktopChrome(canCreate: boolean): void {
  useEffect(() => {
    if (!import.meta.env.TAURI_ENV_PLATFORM || !runningInTauri()) return

    let cancelled = false
    let unlisten: (() => void) | undefined
    void import('@tauri-apps/api/event').then(async ({ listen }) => {
      const stop = await listen<string>('menu-action', (event) => {
        if (event.payload === 'new-recipe') {
          if (!canCreate) return
          window.location.assign(`${import.meta.env.BASE_URL}edit`)
        }
        if (event.payload === 'open-data-folder') {
          void import('./desktopLibrary').then((mod) => mod.chooseDataFolder())
        }
      })
      if (cancelled) stop()
      else unlisten = stop
    })

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('/')) return
      let url: URL
      try {
        url = new URL(anchor.href)
      } catch {
        return
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return
      if (url.host === window.location.host) return
      event.preventDefault()
      void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(url.toString()))
    }
    document.addEventListener('click', onClick)

    return () => {
      cancelled = true
      unlisten?.()
      document.removeEventListener('click', onClick)
    }
  }, [canCreate])
}
