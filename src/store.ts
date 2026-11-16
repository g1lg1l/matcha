// Tournaments kept on this device (localStorage), plus a remembered list of online ones
// with their last seen snapshot, so the home list shows them even offline.
import { useSyncExternalStore } from 'react'
import type { Tournament } from './engine'

export type Role = 'owner' | 'editor' | 'viewer'

export interface OnlineRef {
  code: string
  role: Role
  t: Tournament // last snapshot seen
}

// the first version stored `owner: boolean`
const readOnline = () =>
  read<(OnlineRef & { owner?: boolean })[]>(ONLINE, []).map(({ owner, ...r }) => ({ ...r, role: r.role ?? (owner ? 'owner' : 'viewer') }))

interface State {
  local: Tournament[]
  online: OnlineRef[]
}

const LOCAL = 'matcha:local'
const ONLINE = 'matcha:online'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: the in-memory copy still works for this visit */
  }
}

let state: State = { local: read(LOCAL, []), online: readOnline() }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

// another tab changed things
addEventListener('storage', (e) => {
  if (e.key !== LOCAL && e.key !== ONLINE) return
  state = { local: read(LOCAL, []), online: readOnline() }
  emit()
})

function set(next: Partial<State>) {
  state = { ...state, ...next }
  if (next.local) write(LOCAL, state.local)
  if (next.online) write(ONLINE, state.online)
  emit()
}

export function useStore() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export const getLocal = (id: string) => state.local.find((t) => t.id === id)

export function saveLocal(t: Tournament) {
  const stamped = { ...t, updatedAt: new Date().toISOString() }
  const exists = state.local.some((x) => x.id === t.id)
  set({ local: exists ? state.local.map((x) => (x.id === t.id ? stamped : x)) : [stamped, ...state.local] })
  return stamped
}

export const removeLocal = (id: string) => set({ local: state.local.filter((t) => t.id !== id) })

export const getOnline = (code: string) => state.online.find((r) => r.code === code)

export function rememberOnline(ref: OnlineRef) {
  const rest = state.online.filter((r) => r.code !== ref.code)
  set({ online: [ref, ...rest] })
}

export function updateOnlineSnapshot(code: string, t: Tournament) {
  if (!state.online.some((r) => r.code === code)) return
  set({ online: state.online.map((r) => (r.code === code ? { ...r, t } : r)) })
}

export const forgetOnline = (code: string) => set({ online: state.online.filter((r) => r.code !== code) })
