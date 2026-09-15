import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultBrowseFilters,
  type BrowseFilters,
} from '../lib/filterRecipes'

type BrowseState = {
  filters: BrowseFilters
  setFilters: (next: BrowseFilters) => void
  filtersOpen: boolean
  setFiltersOpen: (open: boolean) => void
}

const BrowseStateContext = createContext<BrowseState | null>(null)

export function BrowseStateProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<BrowseFilters>(defaultBrowseFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const value = useMemo(
    () => ({ filters, setFilters, filtersOpen, setFiltersOpen }),
    [filters, filtersOpen],
  )

  return (
    <BrowseStateContext.Provider value={value}>
      {children}
    </BrowseStateContext.Provider>
  )
}

export function useBrowseState(): BrowseState {
  const ctx = useContext(BrowseStateContext)
  if (!ctx) {
    throw new Error('useBrowseState must be used within BrowseStateProvider')
  }
  return ctx
}
