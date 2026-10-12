import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { recipeEditorPlugin } from './vite/recipeEditorPlugin.ts'

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

// https://vite.dev/config/
export default defineConfig({
  base: '/recipes/',
  server: {
    watch: {
      // macOS fsevents reports vite.config.ts as changed during git commits.
      // A second event while Vite is restarting never finishes, so the
      // terminal sits on "restarting server...". Polling follows mtimes.
      useFsEvents: false,
      interval: 200,
    },
  },
  plugins: [react(), tailwindcss(), spaFallback(), redirectBareBase(), recipeEditorPlugin()],
})
