// Multiplayer games: each round splits everyone into tables (of 3, 4, … players), and everyone
// scores points by where they finish at their table. Optional in-game scores (victory points,
// chips, laps…) can decide the finishing order and the standings. Pure functions, like engine.ts.
import type { Player, Tournament } from './engine'

export interface PartyOptions {
  tableSize: number
  rounds: number
  /** random tables every round, or tables by current standings (leaders play leaders) */
  pairing: 'random' | 'standings'
  /** points for 1st, 2nd, 3rd…; positions past the end score 0 */
  places: number[]
  /** what the standings are sorted by first */
  rankBy: 'points' | 'score'
  /** in-game score: lower is better (golf, Hearts…) */
  lowWins: boolean
  /** BIG rulebook points: 1000 for 1st, the rest by how many sit at the table (overrides places) */
  bigPoints: boolean
  /** players level in the standings: most wins and best average place, or the BIG rulebook */
  tiebreak: 'default' | 'big'
}

export const PARTY_DEFAULTS: PartyOptions = { tableSize: 4, rounds: 3, pairing: 'random', places: [10, 6, 3, 1], rankBy: 'points', lowWins: false, bigPoints: false, tiebreak: 'default' }
export const PLACE_PRESETS = [
  [3, 2, 1, 0],
  [10, 6, 3, 1],
  [5, 3, 2, 1],
  [25, 18, 15, 12, 10, 8, 6, 4],
]

/** BIG (Board Italian Gamers) rulebook, section 4: points by place for tables of 2 to 7 players. */
export const BIG_PLACES: Record<number, number[]> = {
  2: [1000, 336],
  3: [1000, 507, 251],
  4: [1000, 611, 403, 200],
  5: [1000, 682, 507, 336, 167],
  6: [1000, 730, 581, 433, 287, 143],
  7: [1000, 781, 640, 507, 378, 251, 125],
}

export interface TableResult {
  /** finishing place per player, 1-based; equal places are a tie */
  place: Record<string, number>
  /** optional in-game score per player */
  score: Record<string, number | null>
  /** who sat at the table when the result was entered; a result for other players is stale */
  ids: string[]
}

export interface Table {
  id: string
  round: number
  index: number
  players: string[]
  status: 'ready' | 'done'
  result?: TableResult
  /** placement points each player got here */
  points: Record<string, number>
}

export interface PartyRow {
  player: string
  played: number
  wins: number // 1st places
  points: number
  score: number
  hasScore: boolean
  avgPlace: number
}

export const tableId = (round: number, index: number) => `T${round}-${index}`
export const partyOptions = (t: Pick<Tournament, 'options'>): PartyOptions => ({ ...PARTY_DEFAULTS, ...t.options.party })
/** The points list for a table of n players. */
export const placesFor = (o: Pick<PartyOptions, 'places' | 'bigPoints'>, n: number) => (o.bigPoints ? BIG_PLACES[Math.min(7, Math.max(2, n))] : o.places)

export const isTableResult = (r: unknown): r is TableResult => !!r && typeof r === 'object' && 'place' in r

/** Table sizes as even as possible: 10 players at tables of 4 → 4, 3, 3. */
export function splitSizes(n: number, size: number) {
  const s = Math.max(2, size)
  if (n <= s) return [n]
  let k = Math.ceil(n / s)
  // never leave someone alone at a table: 7 players at tables of 2 → 3, 2, 2
  if (Math.floor(n / k) < 2) k = Math.floor(n / s)
  const base = Math.floor(n / k)
  const extra = n % k
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0))
}

/**
 * Points for each player at one table. Tied players share the points of the places they cover:
 * two players tied for 2nd with 10·6·3·1 get (6+3)/2 = 4.5 each.
 */
export function placePoints(place: Record<string, number>, places: number[]) {
  const at = (p: number) => places[p - 1] ?? 0
  const out: Record<string, number> = {}
  const ids = Object.keys(place)
  for (const id of ids) {
    const p = place[id]
    const tied = ids.filter((x) => place[x] === p).length
    let sum = 0
    for (let i = 0; i < tied; i++) sum += at(p + i)
    out[id] = Math.round((sum / tied) * 100) / 100
  }
  return out
}

/** Standard competition ranking from scores (1, 1, 3…). Null if any score is missing. */
export function placesFromScores(ids: string[], score: Record<string, number | null>, lowWins: boolean) {
  if (ids.some((id) => score[id] == null)) return null
  const better = (x: number, y: number) => (lowWins ? x < y : x > y)
  return Object.fromEntries(ids.map((id) => [id, 1 + ids.filter((o) => better(score[o]!, score[id]!)).length]))
}

/** A result is complete when every player has a place and no place is out of range. */
export function validTableResult(r: TableResult | undefined, players: string[]) {
  if (!r || r.ids.length !== players.length || players.some((p) => !r.ids.includes(p))) return false
  return players.every((p) => Number.isInteger(r.place[p]) && r.place[p] >= 1 && r.place[p] <= players.length)
}

export function buildParty(t: Pick<Tournament, 'players' | 'options' | 'results' | 'tables'>) {
  const opts = partyOptions(t)
  const known = new Set(t.players.map((p) => p.id))
  const tables: Table[] = (t.tables ?? []).flatMap((round, r) =>
    round.map((players, i) => {
      const id = tableId(r + 1, i)
      const raw = t.results[id]
      const result = isTableResult(raw) && validTableResult(raw, players) ? raw : undefined
      return {
        id,
        round: r + 1,
        index: i,
        players: players.filter((p) => known.has(p)),
        status: result ? 'done' : 'ready',
        result,
        points: result ? placePoints(result.place, placesFor(opts, players.length)) : {},
      } satisfies Table
    }),
  )
  const rows = partyStandings(t.players, tables, opts)
  const roundsPlayed = t.tables?.length ?? 0
  const roundDone = tables.length > 0 && tables.filter((x) => x.round === roundsPlayed).every((x) => x.status === 'done')
  const finished = roundsPlayed >= opts.rounds && roundDone
  return { tables, rows, finished, roundsPlayed, roundDone, opts }
}

/**
 * BIG tie-break (rulebook 4.2) between players level on points: whoever sat at the higher table
 * in the last round, then finished better there, then the same for the round before, and so on.
 * Round 1 tables are random, so that round is decided by "pbg": the share of the table's total
 * game score. The rulebook breaks a pbg tie at random; here the seed order does, so it is stable.
 */
function bigTieBreak(tables: Table[]) {
  const seat = new Map<string, [table: number, place: number]>()
  const pbg = new Map<string, number>()
  const full = Math.max(0, ...tables.filter((x) => x.round === 1).map((x) => x.players.length))
  let last = 0
  for (const x of tables) {
    if (!x.result) continue
    last = Math.max(last, x.round)
    for (const id of x.players) seat.set(`${x.round}|${id}`, [x.index, x.result.place[id]])
    if (x.round !== 1) continue
    let sum = 0
    for (const id of x.players) sum += x.result.score[id] ?? 0
    // each empty seat at a short table is a ghost worth 90% of the table's average
    sum += (full - x.players.length) * 0.9 * (sum / x.players.length)
    for (const id of x.players) pbg.set(id, sum > 0 ? (x.result.score[id] ?? 0) / sum : 0)
  }
  return (x: string, y: string) => {
    for (let r = last; r >= 2; r--) {
      const a = seat.get(`${r}|${x}`)
      const b = seat.get(`${r}|${y}`)
      // mid-round: only rounds both have finished can compare them
      if (a && b && (a[0] !== b[0] || a[1] !== b[1])) return a[0] - b[0] || a[1] - b[1]
    }
    return (pbg.get(y) ?? 0) - (pbg.get(x) ?? 0)
  }
}

export function partyStandings(players: Player[], tables: Table[], opts: PartyOptions): PartyRow[] {
  const rows = new Map<string, PartyRow & { places: number }>(
    players.map((p) => [p.id, { player: p.id, played: 0, wins: 0, points: 0, score: 0, hasScore: false, avgPlace: 0, places: 0 }]),
  )
  for (const table of tables) {
    if (!table.result) continue
    for (const id of table.players) {
      const row = rows.get(id)
      if (!row) continue
      const place = table.result.place[id]
      row.played++
      row.places += place
      if (place === 1) row.wins++
      row.points += table.points[id] ?? 0
      const s = table.result.score[id]
      if (s != null) {
        row.score += s
        row.hasScore = true
      }
    }
  }
  const sign = opts.lowWins ? 1 : -1
  const byScore = (x: PartyRow, y: PartyRow) => sign * (x.score - y.score)
  const byPoints = (x: PartyRow, y: PartyRow) => y.points - x.points
  const seed = new Map(players.map((p, i) => [p.id, i]))
  const tie = opts.tiebreak === 'big' ? bigTieBreak(tables) : null
  return [...rows.values()]
    .map(({ places, ...row }) => ({ ...row, points: Math.round(row.points * 100) / 100, avgPlace: row.played ? places / row.played : 0 }))
    .sort(
      (x, y) =>
        (tie && ((opts.rankBy === 'score' ? byScore(x, y) : byPoints(x, y)) || tie(x.player, y.player) || seed.get(x.player)! - seed.get(y.player)!)) ||
        (opts.rankBy === 'score' ? byScore(x, y) || byPoints(x, y) : byPoints(x, y) || byScore(x, y)) ||
        y.wins - x.wins ||
        (x.avgPlace || 99) - (y.avgPlace || 99) ||
        seed.get(x.player)! - seed.get(y.player)!,
    )
}

/**
 * Seats everyone for the next round. Random tables, or by standings: the leaders sit together,
 * and at tables of two we swap to avoid a rematch when we can.
 */
export function nextRound(t: Pick<Tournament, 'players' | 'options' | 'results' | 'tables'>, rand: () => number = Math.random): string[][] {
  const { rows, opts } = buildParty(t)
  const ids = t.players.map((p) => p.id)
  const shuffled = shuffleWith(ids, rand)
  let order: string[]
  const bySeat = opts.pairing === 'standings' && (t.tables?.length ?? 0) > 0
  // BIG tie-breaks: tables straight down the standings, tie-breaks included
  if (bySeat && opts.tiebreak === 'big') order = rows.map((r) => r.player)
  else if (bySeat) {
    // keep the standings order, but break exact ties randomly
    const tiebreak = new Map(shuffled.map((id, i) => [id, i]))
    const key = new Map(rows.map((r) => [r.player, opts.rankBy === 'score' ? [r.score * (opts.lowWins ? 1 : -1), -r.points] : [-r.points, r.score * (opts.lowWins ? 1 : -1)]]))
    order = [...ids].sort((x, y) => {
      const [a1, a2] = key.get(x)!
      const [b1, b2] = key.get(y)!
      return a1 - b1 || a2 - b2 || tiebreak.get(x)! - tiebreak.get(y)!
    })
  } else order = shuffled

  const sizes = splitSizes(order.length, opts.tableSize)
  const tables: string[][] = []
  let i = 0
  for (const size of sizes) {
    tables.push(order.slice(i, i + size))
    i += size
  }
  if (opts.tableSize === 2 && opts.pairing === 'standings') avoidRematches(tables, met(t.tables ?? []))
  return tables
}

function met(rounds: string[][][]) {
  const seen = new Set<string>()
  for (const round of rounds) for (const table of round) for (const a of table) for (const b of table) if (a < b) seen.add(`${a}|${b}`)
  return seen
}

function avoidRematches(tables: string[][], seen: Set<string>) {
  const played = (a: string, b: string) => seen.has(a < b ? `${a}|${b}` : `${b}|${a}`)
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i]
    if (t.length !== 2 || !played(t[0], t[1])) continue
    // swap the second player with someone from a later table, closest first
    for (let j = i + 1; j < tables.length; j++) {
      const u = tables[j]
      const k = u.findIndex((x) => !played(t[0], x) && u.every((y) => y === x || !played(t[1], y)))
      if (k >= 0) {
        ;[t[1], u[k]] = [u[k], t[1]]
        break
      }
    }
  }
}

function shuffleWith<T>(list: T[], rand: () => number) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
