import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BrowseStateProvider } from './lib/BrowseState'
import { applyTheme, getStoredTheme } from './lib/theme'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RecipePage } from './pages/RecipePage'

const EditorPage = import.meta.env.DEV
  ? lazy(() => import('./dev/EditorPage').then((module) => ({ default: module.EditorPage })))
  : null

function EditorRoute() {
  if (!EditorPage) return null
  return (
    <Suspense
      fallback={
        <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-ink-muted dark:text-stone-400">
          Loading editor…
        </p>
      }
    >
      <EditorPage />
    </Suspense>
  )
}

export default function App() {
  useEffect(() => {
    applyTheme(getStoredTheme())

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system')
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <BrowseStateProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/recipe/:id" element={<RecipePage />} />
          {EditorPage && <Route path="/edit" element={<EditorRoute />} />}
          {EditorPage && <Route path="/edit/:id" element={<EditorRoute />} />}
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowseStateProvider>
    </BrowserRouter>
  )
}
