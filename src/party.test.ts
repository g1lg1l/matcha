import { describe, expect, it } from 'vitest'
import { build, POINT_PRESETS, standings, withResult, type Tournament } from './engine'
import { nextRound, placePoints, placesFromScores, splitSizes, tableId, type PartyOptions, type TableResult } from './party'

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

describe('round robin points', () => {
  it('uses custom win/draw/loss points', () => {
    const t: Tournament = { id: 't', name: 'x', emoji: '♟️', format: 'roundrobin', players: players(2), options: { points: POINT_PRESETS[2] }, results: {}, createdAt: '', updatedAt: '' }
    const m = build(t).matches[0]
    const done = withResult(t, m.id, { a: null, b: null, w: 'draw', pa: m.a!, pb: m.b! })
    const table = standings(done.players, build(done).matches, done.options.points)
    expect(table.map((r) => r.points)).toEqual([0.5, 0.5])
  })
})
