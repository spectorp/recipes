import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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

// https://vite.dev/config/
export default defineConfig({
  base: '/recipes/',
  plugins: [react(), tailwindcss(), spaFallback()],
})
