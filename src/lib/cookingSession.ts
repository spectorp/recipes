import { useSyncExternalStore } from 'react'
import { getRecipeById } from './catalog'

/** How many recipes can be in the now-cooking set at once. */
export const COOKING_CAP = 4

const STORAGE_KEY = 'recipes-cooking'

export type CookingRecipeState = {
  scale: number
  checkedIngredients: string[]
  checkedSteps: string[]
  scrollY: number
}

type Session = {
  order: string[]
  states: Record<string, CookingRecipeState>
}

const EMPTY_ORDER: string[] = []

function emptyState(): CookingRecipeState {
  return {
    scale: 1,
    checkedIngredients: [],
    checkedSteps: [],
    scrollY: 0,
  }
}

function emptySession(): Session {
  return { order: [], states: {} }
}

function normalizeScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  const rounded = Number(value.toFixed(3))
  if (rounded <= 0 || rounded > 100) return 1
  return rounded
}

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string' || seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

function normalizeScroll(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return value
}

function normalizeState(input: Partial<CookingRecipeState> | undefined): CookingRecipeState {
  return {
    scale: normalizeScale(input?.scale),
    checkedIngredients: normalizeIds(input?.checkedIngredients),
    checkedSteps: normalizeIds(input?.checkedSteps),
    scrollY: normalizeScroll(input?.scrollY),
  }
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

function statesEqual(a: CookingRecipeState, b: CookingRecipeState): boolean {
  return (
    a.scale === b.scale &&
    a.scrollY === b.scrollY &&
    sameIds(a.checkedIngredients, b.checkedIngredients) &&
    sameIds(a.checkedSteps, b.checkedSteps)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object'
}

function sanitizeSession(value: unknown): Session {
  if (!isRecord(value) || value.v !== 1 || !Array.isArray(value.order)) {
    return emptySession()
  }
  const statesIn = isRecord(value.states) ? value.states : {}
  const order: string[] = []
  const states: Record<string, CookingRecipeState> = {}
  for (const id of value.order) {
    if (typeof id !== 'string' || order.includes(id) || order.length >= COOKING_CAP) {
      continue
    }
    if (!getRecipeById(id)) continue
    order.push(id)
    const raw = statesIn[id]
    states[id] = normalizeState(isRecord(raw) ? (raw as Partial<CookingRecipeState>) : undefined)
  }
  return { order, states }
}

function persist(next: Session): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, order: next.order, states: next.states }),
    )
  } catch {
    /* private mode / quota: keep the in-memory session */
  }
}

function loadSession(): Session {
  if (typeof sessionStorage === 'undefined') return emptySession()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptySession()
    return sanitizeSession(JSON.parse(raw) as unknown)
  } catch {
    return emptySession()
  }
}

let session: Session = loadSession()
persist(session)

const listeners = new Set<() => void>()

function emit(): void {
  persist(session)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getOrder(): string[] {
  return session.order
}

function getServerOrder(): string[] {
  return EMPTY_ORDER
}

/** Pinned recipe ids, in the order they were added. */
export function useCookingOrder(): string[] {
  return useSyncExternalStore(subscribe, getOrder, getServerOrder)
}

export function readCookingState(id: string): CookingRecipeState | undefined {
  if (!session.order.includes(id)) return undefined
  const state = session.states[id]
  if (!state) return undefined
  return {
    scale: state.scale,
    checkedIngredients: [...state.checkedIngredients],
    checkedSteps: [...state.checkedSteps],
    scrollY: state.scrollY,
  }
}

/** Merge progress for a pinned recipe. No-op when it is not in the set. */
export function writeCookingState(id: string, patch: Partial<CookingRecipeState>): void {
  if (!session.order.includes(id)) return
  const prev = session.states[id] ?? emptyState()
  const next = normalizeState({
    scale: patch.scale ?? prev.scale,
    checkedIngredients: patch.checkedIngredients ?? prev.checkedIngredients,
    checkedSteps: patch.checkedSteps ?? prev.checkedSteps,
    scrollY: patch.scrollY ?? prev.scrollY,
  })
  if (statesEqual(prev, next)) return
  session = {
    order: session.order,
    states: { ...session.states, [id]: next },
  }
  persist(session)
}

export function pinRecipe(
  id: string,
  initial?: Partial<CookingRecipeState>,
): 'added' | 'already' | 'full' {
  if (session.order.includes(id)) return 'already'
  if (!getRecipeById(id)) return 'full'
  if (session.order.length >= COOKING_CAP) return 'full'
  session = {
    order: [...session.order, id],
    states: {
      ...session.states,
      [id]: normalizeState({ ...emptyState(), ...initial }),
    },
  }
  emit()
  return 'added'
}

export function unpinRecipe(id: string): void {
  if (!session.order.includes(id)) return
  const states = { ...session.states }
  delete states[id]
  session = {
    order: session.order.filter((item) => item !== id),
    states,
  }
  emit()
}
