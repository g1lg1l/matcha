// Online tournaments live in Supabase (the same project as Midori, tables prefixed matcha_).
// Every device is an anonymous Supabase user. Whoever creates a tournament owns it and is the only one
// who can change it; anyone with the share code can follow it, live. The client only loads when needed,
// so local tournaments work fully offline.
import { Capacitor } from '@capacitor/core'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { Result, Tournament } from './engine'
import type { TableResult } from './party'
import type { Role } from './store'
import { t as tr } from './i18n'

export const WEB_URL = 'https://g1lg1l.github.io/matcha/'

export interface Row {
  id: string
  owner_id: string
  share_code: string
  data: Tournament
  updated_at: string
}

let client: Promise<SupabaseClient> | null = null
function sb() {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  )
  return client
}

let uid: Promise<string> | null = null
/** Signs in anonymously the first time it's needed. Retries on the next call if that failed. */
export function me() {
  uid ??= sb()
    .then(async (s) => {
      const { data } = await s.auth.getSession()
      if (data.session) return data.session.user.id
      const { data: anon, error } = await s.auth.signInAnonymously()
      if (error) throw error
      return anon.user!.id
    })
    .catch((e) => {
      uid = null
      throw e
    })
  return uid
}

export async function createOnline(t: Tournament): Promise<Row> {
  const s = await sb()
  await me()
  const id = crypto.randomUUID()
  const { data, error } = await s
    .from('matcha_tournaments')
    .insert({ id, data: { ...t, id } })
    .select('id, owner_id, share_code, data, updated_at')
    .single()
  if (error) throw error
  return data as Row
}

/**
 * Follows the tournament behind a share code (so RLS lets us read it) and loads it, with our role.
 * A referee code makes us an editor. Null if the share code is wrong.
 */
export async function openByCode(code: string, referee?: string): Promise<{ row: Row; role: Role } | null> {
  const s = await sb()
  await me()
  const { data: follow, error } = await s.rpc('matcha_follow', referee ? { code, referee } : { code })
  if (error) {
    if (error.code === 'P0002') return null
    throw error
  }
  const { id, role } = (follow as { id: string; role: Role }[])[0]
  const { data, error: e2 } = await s.from('matcha_tournaments').select('id, owner_id, share_code, data, updated_at').eq('id', id).maybeSingle()
  if (e2) throw e2
  return data ? { row: data as Row, role } : null
}

/** One result, changed in place on the server, so referees entering different matches don't clash. */
export async function setResultOnline(id: string, match: string, result: Result | TableResult | null) {
  const s = await sb()
  const { error } = await s.rpc('matcha_set_result', { tid: id, match, result })
  if (error) throw error
}

export async function refereeCode(id: string) {
  const s = await sb()
  const { data, error } = await s.rpc('matcha_referee_code', { tid: id })
  if (error) throw error
  return data as string
}

export async function resetRefereeCode(id: string) {
  const s = await sb()
  const { data, error } = await s.rpc('matcha_reset_referee_code', { tid: id })
  if (error) throw error
  return data as string
}

const FIELDS = ['name', 'emoji', 'players', 'options', 'tables', 'results'] as const

/** Sends only the parts of the document that changed, each replaced on its own on the server. */
export async function saveOnline(prev: Tournament, next: Tournament) {
  const s = await sb()
  for (const field of FIELDS) {
    if (JSON.stringify(prev[field]) === JSON.stringify(next[field])) continue
    const { error } = await s.rpc('matcha_set_field', { tid: next.id, field, value: next[field] ?? null })
    if (error) throw error
  }
}

export async function deleteOnline(id: string) {
  const s = await sb()
  const { error } = await s.from('matcha_tournaments').delete().eq('id', id)
  if (error) throw error
}

export async function unfollow(id: string) {
  const s = await sb()
  const userId = await me()
  await s.from('matcha_followers').delete().eq('tournament_id', id).eq('user_id', userId)
}

/** Live updates for one tournament. Returns the unsubscribe function. */
export function subscribe(id: string, onChange: (row: Row | null) => void) {
  let channel: RealtimeChannel | undefined
  let stopped = false
  sb().then((s) => {
    if (stopped) return
    channel = s
      .channel(`matcha:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matcha_tournaments', filter: `id=eq.${id}` }, (p) =>
        onChange(p.eventType === 'DELETE' ? null : (p.new as Row)),
      )
      .subscribe()
  })
  return () => {
    stopped = true
    if (channel) sb().then((s) => s.removeChannel(channel!))
  }
}

export function shareUrl(code: string, referee?: string) {
  const base = Capacitor.isNativePlatform() ? WEB_URL : `${location.origin}${location.pathname}`
  return `${base}#/s/${code}${referee ? `/${referee}` : ''}`
}

/** Accepts a full share or referee link, or just the code. */
export function parseCode(input: string) {
  const s = input.trim()
  const fromLink = /#\/s\/([A-Za-z0-9]+)(?:\/([A-Za-z0-9]+))?/.exec(s)
  if (fromLink) return { code: fromLink[1], referee: fromLink[2] }
  return /^[A-Za-z0-9]{6,40}$/.test(s) ? { code: s } : null
}

export function errorText(error: unknown) {
  const { code, message = '' } = (error ?? {}) as { code?: string; message?: string }
  if (code === '42501' || /row-level security/i.test(message)) return tr('denied')
  if (code === '23514') return tr('tooBig')
  if (/fetch|network|Failed to/i.test(message)) return tr('offline')
  return tr('genericError')
}
