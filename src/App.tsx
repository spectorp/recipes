import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BrowseStateProvider } from './lib/BrowseState'
import { applyTheme, getStoredTheme } from './lib/theme'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RecipePage } from './pages/RecipePage'

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
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <BrowseStateProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/recipe/:id" element={<RecipePage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowseStateProvider>
    </BrowserRouter>
  )
}
