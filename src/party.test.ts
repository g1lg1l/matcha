import { describe, expect, it } from 'vitest'
import { build, POINT_PRESETS, standings, withResult, type Tournament } from './engine'
import { BIG_PLACES, nextRound, placePoints, placesFromScores, splitSizes, tableId, type PartyOptions, type TableResult } from './party'

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }))

function party(n: number, opts: Partial<PartyOptions> = {}): Tournament {
  return {
    id: 't', name: 'Game night', emoji: '🎲', format: 'party', players: players(n),
    options: { party: { tableSize: 4, rounds: 2, pairing: 'random', places: [10, 6, 3, 1], rankBy: 'points', lowWins: false, ...opts } },
    results: {}, tables: [], createdAt: '', updatedAt: '',
  }
}

// deterministic random
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
}

const seat = (t: Tournament, rand = rng(1)): Tournament => ({ ...t, tables: [...(t.tables ?? []), nextRound(t, rand)] })

function finish(t: Tournament, round: number, order: (ids: string[]) => string[] = (ids) => ids, score?: (id: string) => number): Tournament {
  t.tables![round - 1].forEach((ids, i) => {
    const ranked = order(ids)
    const r: TableResult = {
      ids,
      place: Object.fromEntries(ranked.map((id, k) => [id, k + 1])),
      score: Object.fromEntries(ids.map((id) => [id, score ? score(id) : null])),
    }
    t = withResult(t, tableId(round, i), r)
  })
  return t
}

describe('tables', () => {
  it('splits players as evenly as possible', () => {
    expect(splitSizes(8, 4)).toEqual([4, 4])
    expect(splitSizes(10, 4)).toEqual([4, 3, 3])
    expect(splitSizes(9, 4)).toEqual([3, 3, 3])
    expect(splitSizes(3, 4)).toEqual([3])
    expect(splitSizes(7, 2)).toEqual([3, 2, 2])
  })

  it('seats everyone exactly once per round', () => {
    for (let n = 2; n <= 23; n++) {
      const t = seat(party(n))
      const seated = t.tables![0].flat()
      expect(seated.sort()).toEqual(t.players.map((p) => p.id).sort())
    }
  })
})

describe('placement points', () => {
  it('gives points by place, zero past the list', () => {
    expect(placePoints({ a: 1, b: 2, c: 3, d: 4, e: 5 }, [10, 6, 3, 1])).toEqual({ a: 10, b: 6, c: 3, d: 1, e: 0 })
  })
  it('splits points between tied players', () => {
    expect(placePoints({ a: 1, b: 2, c: 2, d: 4 }, [10, 6, 3, 1])).toEqual({ a: 10, b: 4.5, c: 4.5, d: 1 })
    expect(placePoints({ a: 1, b: 1 }, [1, 0])).toEqual({ a: 0.5, b: 0.5 })
  })
  it('ranks by score, high or low wins, with ties', () => {
    expect(placesFromScores(['a', 'b', 'c'], { a: 7, b: 10, c: 7 }, false)).toEqual({ b: 1, a: 2, c: 2 })
    expect(placesFromScores(['a', 'b', 'c'], { a: 72, b: 68, c: 80 }, true)).toEqual({ b: 1, a: 2, c: 3 })
    expect(placesFromScores(['a', 'b'], { a: 1, b: null }, false)).toBeNull()
  })
})

describe('multiplayer games', () => {
  it('adds up points across rounds and finishes after the planned rounds', () => {
    let t = seat(party(8))
    expect(build(t)).toMatchObject({ roundsPlayed: 1, roundDone: false, finished: false })
    t = finish(t, 1)
    expect(build(t)).toMatchObject({ roundDone: true, finished: false })
    t = seat(t)
    t = finish(t, 2)
    const b = build(t)
    expect(b.finished).toBe(true)
    expect(b.champion).toBe(b.rows[0].player)
    const total = b.rows.reduce((s, r) => s + r.points, 0)
    expect(total).toBe(2 * 2 * (10 + 6 + 3 + 1)) // 2 rounds × 2 tables
    expect(b.rows.every((r) => r.played === 2)).toBe(true)
  })

  it('can rank by total game score, lowest first', () => {
    let t = seat(party(4, { rankBy: 'score', lowWins: true, rounds: 1 }))
    const strokes: Record<string, number> = { p1: 80, p2: 70, p3: 75, p4: 90 }
    t = finish(t, 1, (ids) => [...ids].sort((a, b) => strokes[a] - strokes[b]), (id) => strokes[id])
    const b = build(t)
    expect(b.rows.map((r) => r.player)).toEqual(['p2', 'p3', 'p1', 'p4'])
    expect(b.champion).toBe('p2')
  })

  it('seats leaders together when pairing by standings', () => {
    let t = seat(party(8, { pairing: 'standings', rounds: 3 }))
    t = finish(t, 1)
    const winners = t.tables![0].map((table) => table[0]) // place 1 at each table
    t = seat(t)
    const top = t.tables![1][0]
    for (const w of winners) expect(top).toContain(w)
  })

  it('avoids rematches at tables of two when it can', () => {
    let t = seat(party(6, { tableSize: 2, pairing: 'standings', rounds: 5, places: [1, 0] }), rng(3))
    for (let r = 1; r <= 4; r++) {
      t = finish(t, r)
      t = seat(t, rng(r + 10))
    }
    const pairs = t.tables!.flat().map((x) => [...x].sort().join('-'))
    // with 6 players and 5 rounds a full schedule without repeats exists; the greedy swap should get close
    expect(new Set(pairs).size).toBeGreaterThanOrEqual(pairs.length - 3)
  })

  it('ignores a result whose table no longer matches', () => {
    let t = seat(party(4, { rounds: 1 }))
    t = finish(t, 1)
    t = { ...t, tables: [[['p4', 'p3', 'p2', 'p1'].filter((x) => x !== 'p1').concat('p1')]] }
    // same players, still valid
    expect(build(t).tables[0].status).toBe('done')
    t = { ...t, players: [...t.players, { id: 'p5', name: 'P5' }], tables: [[['p1', 'p2', 'p3', 'p5']]] }
    expect(build(t).tables[0].status).toBe('ready')
  })
})

describe('BIG rulebook options', () => {
  const big = (n: number, tableSize = 4): Tournament => party(n, { tableSize, rounds: 3, pairing: 'standings', bigPoints: true, tiebreak: 'big' })
  const row = (t: Tournament, id: string) => build(t).rows.find((r) => r.player === id)!
  const order = (t: Tournament) => build(t).rows.map((r) => r.player)

  it('scores by place and by how many sit at the table', () => {
    // 7 players at tables of 4: one table of 4, one of 3
    let t = seat(big(7))
    expect(t.tables![0].map((x) => x.length)).toEqual([4, 3])
    t = finish(t, 1)
    const [four, three] = t.tables![0]
    expect(four.map((id) => row(t, id).points)).toEqual(BIG_PLACES[4])
    expect(three.map((id) => row(t, id).points)).toEqual([1000, 507, 251])
  })

  it('splits the points of a shared place', () => {
    let t = seat(big(4))
    const ids = t.tables![0][0]
    t = withResult(t, tableId(1, 0), { ids, place: { [ids[0]]: 1, [ids[1]]: 1, [ids[2]]: 3, [ids[3]]: 4 }, score: {} })
    expect(row(t, ids[0]).points).toBe((1000 + 611) / 2)
  })

  it('breaks round 1 ties by share of the table score, counting a ghost at a short table', () => {
    let t = seat(big(7))
    const [four, three] = t.tables![0]
    // both winners score 40 of 100, but the table of 3 adds a ghost worth 90% of its average (30)
    const scores = [40, 30, 20, 10]
    const result = (ids: string[], sc: number[]): TableResult => ({
      ids,
      place: Object.fromEntries(ids.map((id, i) => [id, i + 1])),
      score: Object.fromEntries(ids.map((id, i) => [id, sc[i]])),
    })
    t = withResult(t, tableId(1, 0), result(four, scores))
    t = withResult(t, tableId(1, 1), result(three, [40, 35, 25]))
    expect(order(t).slice(0, 2)).toEqual([four[0], three[0]]) // 40/100 beats 40/130
    // without the ghost the short table's winner would be level; a bigger share puts them ahead
    t = withResult(t, tableId(1, 1), result(three, [60, 10, 7]))
    expect(order(t).slice(0, 2)).toEqual([three[0], four[0]]) // 60/100.1 beats 40/100
  })

  it('seats the next round down the standings, then breaks ties by the higher table', () => {
    let t = finish(seat(big(8)), 1, undefined, (id) => Number(id.slice(1)))
    t = seat(t)
    const [top, bottom] = t.tables![1]
    expect(top).toEqual(order(t).slice(0, 4))
    // round 2: at each table the round 1 loser wins, so a top-table and a bottom-table player are level on points
    t = finish(t, 2, (ids) => [...ids].reverse())
    const pts = (id: string) => row(t, id).points
    const level = top.find((a) => bottom.some((b) => pts(a) === pts(b)))!
    const other = bottom.find((b) => pts(b) === pts(level))!
    expect(order(t).indexOf(level)).toBeLessThan(order(t).indexOf(other))
  })
})

describe('round robin points', () => {
  it('uses custom win/draw/loss points', () => {
    const t: Tournament = { id: 't', name: 'x', emoji: '♟️', format: 'roundrobin', players: players(2), options: { points: POINT_PRESETS[2] }, results: {}, createdAt: '', updatedAt: '' }
    const m = build(t).matches[0]
    const done = withResult(t, m.id, { a: null, b: null, w: 'draw', pa: m.a!, pb: m.b! })
    const table = standings(done.players, build(done).matches, done.options.points)
    expect(table.map((r) => r.points)).toEqual([0.5, 0.5])
  })
})
