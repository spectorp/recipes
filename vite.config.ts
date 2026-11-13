import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type UserConfig } from 'vite'
import { recipeEditorPlugin } from './vite/recipeEditorPlugin.ts'

/** Set by the Tauri CLI. The GitHub Pages build leaves this unset. */
const desktop = Boolean(process.env.TAURI_ENV_PLATFORM)
const devHost = process.env.TAURI_DEV_HOST

/** GitHub Pages serves 404.html for unknown paths — copy index for SPA deep links. */
function spaFallback(): Plugin {
  return {
    name: 'spa-github-pages-fallback',
    closeBundle() {
      const index = resolve('dist/index.html')
      const fallback = resolve('dist/404.html')
      copyFileSync(index, fallback)
    },
  }
}

/**
 * Vite's base is `/recipes/` and it 404s a request for `/recipes`.
 * The home page used to live at that slashless path, so a dev-server
 * restart reloaded into Vite's "did you mean /recipes/" page.
 */
function redirectBareBase(): Plugin {
  return {
    name: 'redirect-bare-base',
    apply: 'serve',
    configureServer(server) {
      const base = server.config.base
      if (!base.endsWith('/') || base === '/') return
      const bare = base.slice(0, -1)
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        const query = url.indexOf('?')
        const pathname = query === -1 ? url : url.slice(0, query)
        if (pathname !== bare) {
          next()
          return
        }
        const search = query === -1 ? '' : url.slice(query)
        res.writeHead(302, { Location: `${base}${search}` })
        res.end()
      })
    },
  }
}

/**
 * `src/shell/local.ts` is what TypeScript checks (the Mac app).
 * The Pages build and browser dev server swap in a file that does not
 * import Tauri. Otherwise Vite still emits those modules as loose chunks.
 */
function shellEntry(shellFile: string): Plugin {
  const target = resolve(shellFile)
  return {
    name: 'shell-entry',
    enforce: 'pre',
    resolveId(source) {
      const normalized = source.replaceAll('\\', '/')
      const isLocal =
        normalized.endsWith('/shell/local') || normalized.endsWith('/shell/local.ts')
      if (!isLocal || normalized === target.replaceAll('\\', '/')) return
      return target
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }): UserConfig => {
  const shellFile = desktop
    ? 'src/shell/local.ts'
    : command === 'serve'
      ? 'src/shell/dev.ts'
      : 'src/shell/pages.ts'

  return {
    // GitHub Pages is served from /recipes/. The Mac app is served from /.
    base: desktop ? '/' : '/recipes/',
    // Expose Tauri's platform flag so the Mac app bundle can tell it is desktop.
    envPrefix: ['VITE_', 'TAURI_ENV_'],
    clearScreen: !desktop,
    server: {
      ...(desktop
        ? {
            port: 1420,
            strictPort: true,
            host: devHost || false,
            hmr: devHost
              ? {
                  protocol: 'ws' as const,
                  host: devHost,
                  port: 1421,
                }
              : undefined,
          }
        : {}),
      watch: {
        // macOS fsevents reports vite.config.ts as changed during git commits.
        // A second event while Vite is restarting never finishes, so the
        // terminal sits on "restarting server...". Polling follows mtimes.
        useFsEvents: false,
        interval: 200,
        ignored: ['**/src-tauri/**'],
      },
    },
    plugins: [
      shellEntry(shellFile),
      react(),
      tailwindcss(),
      spaFallback(),
      redirectBareBase(),
      recipeEditorPlugin(),
    ],
  }
})
