// Bracket engine. Pure functions, no React, no Supabase.
// A tournament stores only its settings, its players in seed order and the results. Every view
// (matches, who plays whom next, standings, the champion) is rebuilt from those by build(), so
// correcting an old result re-flows the whole bracket by itself.

export type Format = 'single' | 'double' | 'roundrobin'

export interface Player {
  id: string
  name: string
}

export interface Options {
  /** single elimination: semi-final losers play for 3rd place */
  thirdPlace?: boolean
  /** double elimination: if the losers-bracket champion wins the grand final, play it once more */
  bracketReset?: boolean
  /** round robin: 2 = home and away */
  legs?: 1 | 2
}

export type Side = 'a' | 'b'

export interface Result {
  /** scores are optional: in a knockout you can just tap the winner */
  a: number | null
  b: number | null
  w: Side | 'draw'
  /** who was in the match when the result was entered; a result for other players is stale and ignored */
  pa: string
  pb: string
}

export interface Tournament {
  id: string
  name: string
  emoji: string
  format: Format
  players: Player[] // in seed order
  options: Options
  results: Record<string, Result>
  createdAt: string
  updatedAt: string
}

export type Bracket = 'W' | 'L' | 'GF' | '3P' | 'RR'

/** a player id, null for a bye (nobody will ever come), undefined while still waiting for an earlier match */
export type Slot = string | null | undefined

export type Status = 'waiting' | 'ready' | 'done' | 'bye'

export interface Match {
  id: string
  bracket: Bracket
  round: number // 1-based within its bracket
  index: number
  a: Slot
  b: Slot
  status: Status
  winner: Slot
  loser: Slot
  result?: Result
  /** grand final reset that turned out not to be needed */
  hidden?: boolean
}

interface Wire {
  to: string
  slot: Side
}

interface Shell extends Match {
  winnerTo?: Wire
  loserTo?: Wire
}

export interface Built {
  matches: Match[]
  byId: Map<string, Match>
  champion: string | null
  finished: boolean
  /** knockout only: final ranking, filled in as players are knocked out */
  ranks: Map<string, number>
}

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 128

/** 1v8, 4v5, 2v7, 3v6 ... so the top seeds only meet late. Returns 1-based seeds. */
export function seedOrder(size: number) {
  let order = [1]
  while (order.length < size) {
    const m = order.length * 2 + 1
    order = order.flatMap((s) => [s, m - s])
  }
  return order
}

export const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)))

const id = (b: Bracket, round: number, index: number) => (b === 'GF' || b === '3P' ? (round > 1 ? `${b}${round}` : b) : `${b}${round}-${index}`)

function shell(bracket: Bracket, round: number, index: number): Shell {
  return { id: id(bracket, round, index), bracket, round, index, a: undefined, b: undefined, status: 'waiting', winner: undefined, loser: undefined }
}

/** Builds the empty knockout structure with its wiring, in an order where every match comes after the ones that feed it. */
function knockout(n: number, format: 'single' | 'double', options: Options): Shell[] {
  const size = nextPow2(n)
  const k = Math.log2(size)
  const out: Shell[] = []
  const W: Shell[][] = []
  for (let r = 1; r <= k; r++) {
    const round: Shell[] = []
    for (let i = 0; i < size / 2 ** r; i++) round.push(shell('W', r, i))
    W.push(round)
    out.push(...round)
  }
  for (let r = 0; r < k - 1; r++) W[r].forEach((m, i) => (m.winnerTo = { to: W[r + 1][Math.floor(i / 2)].id, slot: i % 2 ? 'b' : 'a' }))

  if (format === 'single') {
    if (options.thirdPlace && k >= 2) {
      const p3 = shell('3P', 1, 0)
      W[k - 2].forEach((m, i) => (m.loserTo = { to: p3.id, slot: i % 2 ? 'b' : 'a' }))
      out.push(p3)
    }
    return out
  }

  // Double elimination. Losers bracket rounds alternate: odd rounds pair up survivors of the losers bracket,
  // even rounds take the players just dropped from the winners bracket.
  const L: Shell[][] = []
  for (let m = 1; m <= 2 * (k - 1); m++) {
    const count = size / 2 ** (Math.ceil(m / 2) + 1)
    const round: Shell[] = []
    for (let i = 0; i < count; i++) round.push(shell('L', m, i))
    L.push(round)
  }
  if (k >= 2) {
    W[0].forEach((m, i) => (m.loserTo = { to: L[0][Math.floor(i / 2)].id, slot: i % 2 ? 'b' : 'a' }))
    for (let m = 2; m <= 2 * (k - 1); m++) {
      const prev = L[m - 2]
      const here = L[m - 1]
      if (m % 2 === 0) {
        const j = m / 2
        prev.forEach((x, i) => (x.winnerTo = { to: here[i].id, slot: 'a' }))
        // drop the next winners round in reverse every other time, so the same pair doesn't meet again straight away
        const flip = j % 2 === 1
        W[j].forEach((x, i) => (x.loserTo = { to: here[flip ? here.length - 1 - i : i].id, slot: 'b' }))
      } else {
        prev.forEach((x, i) => (x.winnerTo = { to: here[Math.floor(i / 2)].id, slot: i % 2 ? 'b' : 'a' }))
      }
    }
  }
  L.forEach((round) => out.push(...round))

  const gf = shell('GF', 1, 0)
  W[k - 1][0].winnerTo = { to: gf.id, slot: 'a' }
  if (k >= 2) L[L.length - 1][0].winnerTo = { to: gf.id, slot: 'b' }
  else W[0][0].loserTo = { to: gf.id, slot: 'b' }
  out.push(gf)
  if (options.bracketReset) out.push(shell('GF', 2, 0))
  return out
}

/** Circle method: everyone plays everyone once per leg. With an odd count one player rests each round. */
function roundRobin(players: Player[], legs: 1 | 2): Shell[] {
  const ids: (string | null)[] = players.map((p) => p.id)
  if (ids.length % 2) ids.push(null)
  const n = ids.length
  const rounds: [string, string][][] = []
  let arr = ids
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const x = arr[i]
      const y = arr[n - 1 - i]
      // alternate who is listed first so nobody is always "home"
      if (x && y) pairs.push(r % 2 && i === 0 ? [y, x] : [x, y])
    }
    rounds.push(pairs)
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]
  }
  const all = legs === 2 ? [...rounds, ...rounds.map((pairs) => pairs.map(([x, y]) => [y, x] as [string, string]))] : rounds
  return all.flatMap((pairs, r) =>
    pairs.map(([a, b], i) => ({ ...shell('RR', r + 1, i), a, b })),
  )
}

const validFor = (r: Result | undefined, a: Slot, b: Slot, draws: boolean) =>
  r && r.pa === a && r.pb === b && (draws || r.w !== 'draw') ? r : undefined

export function build(t: Pick<Tournament, 'format' | 'players' | 'options' | 'results'>): Built {
  const { format, players, options, results } = t
  const ranks = new Map<string, number>()

  if (format === 'roundrobin') {
    const matches: Match[] = roundRobin(players, options.legs ?? 1).map((m) => {
      const result = validFor(results[m.id], m.a, m.b, true)
      if (!result) return { ...m, status: 'ready' }
      const winner = result.w === 'draw' ? null : result.w === 'a' ? m.a : m.b
      const loser = result.w === 'draw' ? null : result.w === 'a' ? m.b : m.a
      return { ...m, status: 'done', result, winner, loser }
    })
    const finished = matches.length > 0 && matches.every((m) => m.status === 'done')
    const table = standings(players, matches)
    table.forEach((row, i) => ranks.set(row.player, i + 1))
    return { matches, byId: new Map(matches.map((m) => [m.id, m])), finished, champion: finished ? (table[0]?.player ?? null) : null, ranks }
  }

  const shells = knockout(players.length, format, options)
  const byId = new Map(shells.map((m) => [m.id, m]))
  const size = nextPow2(players.length)
  seedOrder(size).forEach((seed, i) => {
    const m = shells[Math.floor(i / 2)]
    m[i % 2 ? 'b' : 'a'] = players[seed - 1]?.id ?? null
  })

  // where each knocked-out player went out, in play order, for the ranking
  const out: { player: string; stage: string }[] = []

  for (const m of shells) {
    if (m.bracket === 'GF' && m.round === 2) {
      const gf = byId.get('GF')!
      const needed = gf.status === 'done' && gf.winner === gf.b
      if (!needed) {
        m.hidden = true
        m.status = gf.status === 'done' ? 'bye' : 'waiting'
        continue
      }
      m.a = gf.a
      m.b = gf.b
    }
    if (m.a === undefined || m.b === undefined) {
      m.status = 'waiting'
    } else if (m.a === null || m.b === null) {
      m.status = 'bye'
      m.winner = m.a ?? m.b
      m.loser = null
    } else {
      const r = validFor(results[m.id], m.a, m.b, false)
      if (r) {
        m.result = r
        m.status = 'done'
        m.winner = r.w === 'a' ? m.a : m.b
        m.loser = r.w === 'a' ? m.b : m.a
      } else m.status = 'ready'
    }
    if (m.winnerTo && m.winner !== undefined) byId.get(m.winnerTo.to)![m.winnerTo.slot] = m.winner
    if (m.loserTo && m.loser !== undefined) byId.get(m.loserTo.to)![m.loserTo.slot] = m.loser
    // in single elimination every loss is final; in double only losers-bracket losses (the GF is handled below)
    if (m.loser && m.bracket !== '3P' && (format === 'single' ? m.bracket === 'W' : m.bracket === 'L')) out.push({ player: m.loser, stage: `${m.bracket}${m.round}` })
  }

  let champion: string | null = null
  let runnerUp: string | null = null
  if (format === 'single') {
    const final = shells.find((m) => m.bracket === 'W' && m.round === Math.log2(size))!
    if (final.status !== 'waiting' && final.status !== 'ready') {
      champion = final.winner ?? null
      runnerUp = final.loser ?? null
    }
  } else {
    const gf = byId.get('GF')!
    const reset = byId.get('GF2')
    if (gf.status === 'done') {
      if (gf.winner === gf.a || !reset) {
        champion = gf.winner ?? null
        runnerUp = gf.loser ?? null
      } else if (reset.status === 'done') {
        champion = reset.winner ?? null
        runnerUp = reset.loser ?? null
      }
    }
  }
  const p3 = byId.get('3P')
  const finished = champion !== null && (!p3 || p3.status === 'done' || p3.status === 'bye')

  // Ranking: champion 1st, runner-up 2nd, then everyone by how late they went out. Same round, same rank.
  if (champion) ranks.set(champion, 1)
  if (runnerUp) ranks.set(runnerUp, 2)
  let next = ranks.size + 1
  if (p3?.status === 'done') {
    ranks.set(p3.winner!, next++)
    ranks.set(p3.loser!, next++)
  }
  const stages = [...new Set(out.map((o) => o.stage))].reverse()
  for (const stage of stages) {
    const group = out.filter((o) => o.stage === stage && !ranks.has(o.player) && o.player !== runnerUp)
    group.forEach((o) => ranks.set(o.player, next))
    next += group.length
  }

  const matches: Match[] = shells.map(({ winnerTo: _w, loserTo: _l, ...m }) => m)
  return { matches, byId: new Map(matches.map((m) => [m.id, m])), champion, finished, ranks }
}

export interface Row {
  player: string
  played: number
  won: number
  drawn: number
  lost: number
  for: number
  against: number
  points: number
}

export const POINTS = { win: 3, draw: 1, loss: 0 }

/** League table: points, then score difference, then scored, then head-to-head points. */
export function standings(players: Player[], matches: Match[]): Row[] {
  const rows = new Map<string, Row>(players.map((p) => [p.id, { player: p.id, played: 0, won: 0, drawn: 0, lost: 0, for: 0, against: 0, points: 0 }]))
  for (const m of matches) {
    if (m.status !== 'done' || !m.result || !m.a || !m.b) continue
    const a = rows.get(m.a)
    const b = rows.get(m.b)
    if (!a || !b) continue
    const { a: sa, b: sb, w } = m.result
    a.played++
    b.played++
    a.for += sa ?? 0
    a.against += sb ?? 0
    b.for += sb ?? 0
    b.against += sa ?? 0
    if (w === 'draw') {
      a.drawn++
      b.drawn++
      a.points += POINTS.draw
      b.points += POINTS.draw
    } else {
      const [win, lose] = w === 'a' ? [a, b] : [b, a]
      win.won++
      lose.lost++
      win.points += POINTS.win
      lose.points += POINTS.loss
    }
  }
  const h2h = (x: string, y: string) => {
    let pts = 0
    for (const m of matches) {
      if (m.status !== 'done' || !m.result) continue
      if (m.a === x && m.b === y) pts += m.result.w === 'a' ? 3 : m.result.w === 'draw' ? 1 : 0
      if (m.b === x && m.a === y) pts += m.result.w === 'b' ? 3 : m.result.w === 'draw' ? 1 : 0
    }
    return pts
  }
  const seed = new Map(players.map((p, i) => [p.id, i]))
  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.for - y.against - (x.for - x.against) ||
      y.for - x.for ||
      h2h(y.player, x.player) - h2h(x.player, y.player) ||
      seed.get(x.player)! - seed.get(y.player)!,
  )
}

/** Matches that can be played right now, in bracket order. */
export const playable = (b: Built) => b.matches.filter((m) => m.status === 'ready')

/** True once any result counts; after that the player list is locked (renames are still fine). */
export const started = (t: Pick<Tournament, 'format' | 'players' | 'options' | 'results'>) =>
  build(t).matches.some((m) => m.status === 'done')

/** Drops results that no longer match their match, so the stored document stays tidy. */
export function prune(t: Tournament): Tournament {
  const built = build(t)
  const results = Object.fromEntries(Object.entries(t.results).filter(([id]) => built.byId.get(id)?.result))
  return { ...t, results }
}

export function shuffle<T>(list: T[]) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Columns for the bracket view: [label key, round number, matches]. */
export function rounds(matches: Match[], bracket: Bracket) {
  const map = new Map<number, Match[]>()
  for (const m of matches) if (m.bracket === bracket) map.set(m.round, [...(map.get(m.round) ?? []), m])
  return [...map.entries()].sort((x, y) => x[0] - y[0])
}

/** Sets (or with null clears) one result and drops any later results it made stale. */
export function withResult(t: Tournament, matchId: string, result: Result | null): Tournament {
  const { [matchId]: _old, ...rest } = t.results
  return prune({ ...t, results: result ? { ...rest, [matchId]: result } : rest })
}
