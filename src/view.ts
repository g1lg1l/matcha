// Small presentation helpers shared by the screens.
import { build, type Built, type Format, type Match, type Tournament } from './engine'
import { t } from './i18n'

const palette = ['#d1495b', '#2e86ab', '#d9702a', '#6a4c93', '#17907f', '#c4497f', '#3d6fd8', '#6f8a1f']
export const colorOfIndex = (i: number) => palette[i % palette.length]

export const EMOJIS = ['🏆', '⚽', '🏀', '🎾', '🏓', '🎮', '♟️', '🃏', '🎯', '🏐', '🥊', '🍵']

export const formatEmoji: Record<Format, string> = { single: '⚡', double: '🔁', roundrobin: '🔄' }

export function roundLabel(m: Match, b: Built) {
  if (m.bracket === 'GF') return m.round === 1 ? t('grandFinal') : t('resetFinal')
  if (m.bracket === '3P') return t('thirdPlaceMatch')
  const last = Math.max(...b.matches.filter((x) => x.bracket === m.bracket).map((x) => x.round))
  if (m.bracket === 'L') return m.round === last ? t('final') : t('roundN', { n: m.round })
  if (m.bracket === 'W') {
    const fromEnd = last - m.round
    if (fromEnd === 0) return t('final')
    if (fromEnd === 1) return t('semis')
    if (fromEnd === 2 && m.round > 1) return t('quarters')
  }
  return t('roundN', { n: m.round })
}

export function sectionLabel(m: Match, format: Format) {
  if (format !== 'double') return ''
  return m.bracket === 'W' ? t('winners') : m.bracket === 'L' ? t('losers') : t('finals')
}

export type Phase = 'new' | 'live' | 'done'

export function summary(tour: Tournament) {
  const b = build(tour)
  const done = b.matches.filter((m) => m.status === 'done').length
  const phase: Phase = b.finished ? 'done' : done ? 'live' : 'new'
  const champion = b.champion ? tour.players.find((p) => p.id === b.champion)?.name : undefined
  return { built: b, phase, champion }
}

export function newTournament(init: Pick<Tournament, 'name' | 'emoji' | 'format' | 'players' | 'options'>): Tournament {
  const now = new Date().toISOString()
  return { ...init, id: crypto.randomUUID(), results: {}, createdAt: now, updatedAt: now }
}
