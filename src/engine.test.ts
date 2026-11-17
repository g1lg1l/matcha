import { describe, expect, it } from 'vitest'
import { build, playable, seedOrder, standings, type Format, type Options, type Result, type Tournament } from './engine'

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }))

const make = (n: number, format: Format, options: Options = {}): Tournament => ({
  id: 't',
  name: 'Test',
  emoji: '🏆',
  format,
  players: players(n),
  options,
  results: {},
  createdAt: '',
  updatedAt: '',
})

function win(t: Tournament, matchId: string, side: 'a' | 'b' | 'draw', score: [number, number] | null = null): Tournament {
  const m = build(t).byId.get(matchId)!
  const r: Result = { a: score?.[0] ?? null, b: score?.[1] ?? null, w: side, pa: m.a!, pb: m.b! }
  return { ...t, results: { ...t.results, [matchId]: r } }
}

// deterministic "random" so failures reproduce
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
}

function playOut(t: Tournament, rand: () => number, draws = false) {
  for (let guard = 0; guard < 2000; guard++) {
    const ready = playable(build(t))
    if (!ready.length) return t
    const m = ready[Math.floor(rand() * ready.length)]
    const x = rand()
    t = win(t, m.id, draws && x < 0.2 ? 'draw' : x < 0.6 ? 'a' : 'b')
  }
  throw new Error('never finished')
}

describe('seeding', () => {
  it('keeps top seeds apart', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3])
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })
  it('gives byes to the top seeds', () => {
    const b = build(make(5, 'single'))
    const r1 = b.matches.filter((m) => m.bracket === 'W' && m.round === 1)
    expect(r1.map((m) => [m.a, m.b])).toEqual([
      ['p1', null],
      ['p4', 'p5'],
      ['p2', null],
      ['p3', null],
    ])
    expect(r1.filter((m) => m.status === 'bye')).toHaveLength(3)
  })
})

describe('single elimination', () => {
  it('advances winners and crowns a champion', () => {
    let t = make(4, 'single')
    t = win(t, 'W1-0', 'a', [3, 1]) // p1 beats p4
    t = win(t, 'W1-1', 'b') // p3 beats p2
    // one semifinal in: its loser is last for now, never first
    expect([...build(win(make(4, 'single'), 'W1-0', 'a')).ranks.entries()]).toEqual([['p4', 4]])
    const mid = build(t)
    expect(mid.byId.get('W2-0')).toMatchObject({ a: 'p1', b: 'p3', status: 'ready' })
    expect([...mid.ranks.values()]).toEqual([3, 3])
    t = win(t, 'W2-0', 'b')
    const done = build(t)
    expect(done.champion).toBe('p3')
    expect(done.finished).toBe(true)
    expect(done.ranks.get('p3')).toBe(1)
    expect(done.ranks.get('p1')).toBe(2)
    expect(done.ranks.get('p2')).toBe(3)
    expect(done.ranks.get('p4')).toBe(3)
  })

  it('plays a third place match when asked', () => {
    let t = make(4, 'single', { thirdPlace: true })
    t = win(t, 'W1-0', 'a')
    t = win(t, 'W1-1', 'a')
    expect(build(t).byId.get('3P')).toMatchObject({ a: 'p4', b: 'p3', status: 'ready' })
    t = win(t, 'W2-0', 'a')
    expect(build(t).finished).toBe(false)
    t = win(t, '3P', 'b')
    const b = build(t)
    expect(b.finished).toBe(true)
    expect([...b.ranks.entries()].sort()).toEqual([
      ['p1', 1],
      ['p2', 2],
      ['p3', 3],
      ['p4', 4],
    ])
  })

  it('ignores later results when an earlier one changes', () => {
    let t = make(4, 'single')
    t = win(t, 'W1-0', 'a')
    t = win(t, 'W1-1', 'a')
    t = win(t, 'W2-0', 'a')
    expect(build(t).champion).toBe('p1')
    t = win(t, 'W1-0', 'b') // correction: p4 actually won
    const b = build(t)
    expect(b.byId.get('W2-0')).toMatchObject({ a: 'p4', b: 'p2', status: 'ready' })
    expect(b.champion).toBeNull()
  })

  it('works with two players', () => {
    let t = make(2, 'single', { thirdPlace: true })
    expect(build(t).matches).toHaveLength(1)
    t = win(t, 'W1-0', 'b')
    expect(build(t)).toMatchObject({ champion: 'p2', finished: true })
  })
})

describe('double elimination', () => {
  it('sends losers down and needs a reset when the losers side wins the final', () => {
    let t = make(4, 'double', { bracketReset: true })
    t = win(t, 'W1-0', 'a') // p1 > p4
    t = win(t, 'W1-1', 'a') // p2 > p3
    expect(build(t).byId.get('L1-0')).toMatchObject({ a: 'p4', b: 'p3', status: 'ready' })
    t = win(t, 'W2-0', 'a') // p1 > p2, p2 drops
    t = win(t, 'L1-0', 'b') // p3 > p4, p4 out
    expect(build(t).byId.get('L2-0')).toMatchObject({ a: 'p3', b: 'p2' })
    t = win(t, 'L2-0', 'a') // p3 > p2
    expect(build(t).byId.get('GF')).toMatchObject({ a: 'p1', b: 'p3', status: 'ready' })
    expect(build(t).byId.get('GF2')?.hidden).toBe(true)
    t = win(t, 'GF', 'b') // p3 wins: reset
    const reset = build(t)
    expect(reset.champion).toBeNull()
    expect(reset.byId.get('GF2')).toMatchObject({ a: 'p1', b: 'p3', status: 'ready' })
    t = win(t, 'GF2', 'b')
    const b = build(t)
    expect(b.champion).toBe('p3')
    expect([...b.ranks.entries()].sort()).toEqual([
      ['p1', 2],
      ['p2', 3],
      ['p3', 1],
      ['p4', 4],
    ])
  })

  it('ends after one grand final without reset', () => {
    let t = make(3, 'double')
    t = playOut(t, () => 0.99) // b always wins
    const b = build(t)
    expect(b.finished).toBe(true)
    expect(b.byId.has('GF2')).toBe(false)
  })

  it('handles two players', () => {
    let t = make(2, 'double', { bracketReset: true })
    t = win(t, 'W1-0', 'a')
    expect(build(t).byId.get('GF')).toMatchObject({ a: 'p1', b: 'p2' })
    t = win(t, 'GF', 'b')
    t = win(t, 'GF2', 'a')
    expect(build(t).champion).toBe('p1')
  })
})

describe('every size plays out cleanly', () => {
  for (const format of ['single', 'double'] as const)
    for (const extra of [false, true])
      it(`${format}${extra ? ' with options' : ''}, 2 to 40 players`, () => {
        for (let n = 2; n <= 40; n++)
          for (let seed = 1; seed <= 3; seed++) {
            const t = playOut(make(n, format, { thirdPlace: extra, bracketReset: extra }), rng(n * 31 + seed))
            const b = build(t)
            expect(b.finished, `n=${n}`).toBe(true)
            expect(b.champion).toBeTruthy()

            const played = b.matches.filter((m) => m.status === 'done')
            const losses = new Map<string, number>()
            for (const m of played) {
              expect(m.a).not.toBe(m.b)
              if (m.bracket !== '3P') losses.set(m.loser!, (losses.get(m.loser!) ?? 0) + 1)
            }
            const maxLosses = format === 'single' ? 1 : 2
            for (const [, l] of losses) expect(l).toBeLessThanOrEqual(maxLosses)
            if (format === 'double') {
              // everyone but the champion goes out on their second loss; without a reset,
              // the winners-bracket champion can lose the grand final with only one
              for (const p of t.players) {
                if (p.id === b.champion) continue
                const l = losses.get(p.id)
                if (extra) expect(l, `n=${n} ${p.id}`).toBe(2)
                else expect(l === 2 || (l === 1 && p.id === b.matches.find((m) => m.id === 'GF')!.a)).toBe(true)
              }
            } else {
              expect(played.filter((m) => m.bracket !== '3P')).toHaveLength(n - 1)
            }
            expect(b.ranks.size).toBe(n)
            expect(b.ranks.get(b.champion!)).toBe(1)
          }
      })

  it('never has a player in two playable matches at once', () => {
    for (let n = 3; n <= 20; n++) {
      let t = make(n, 'double', { bracketReset: true })
      const rand = rng(n)
      for (;;) {
        const ready = playable(build(t))
        if (!ready.length) break
        const ids = ready.flatMap((m) => [m.a, m.b])
        expect(new Set(ids).size).toBe(ids.length)
        const m = ready[Math.floor(rand() * ready.length)]
        t = win(t, m.id, rand() < 0.5 ? 'a' : 'b')
      }
    }
  })
})

describe('round robin', () => {
  it('pairs everyone once per leg', () => {
    for (let n = 2; n <= 12; n++)
      for (const legs of [1, 2] as const) {
        const b = build(make(n, 'roundrobin', { legs }))
        expect(b.matches).toHaveLength(((n * (n - 1)) / 2) * legs)
        const pairs = new Map<string, number>()
        for (const m of b.matches) {
          const key = [m.a, m.b].sort().join('-')
          pairs.set(key, (pairs.get(key) ?? 0) + 1)
        }
        expect([...pairs.values()].every((c) => c === legs)).toBe(true)
        // nobody plays twice in the same round
        for (const r of new Set(b.matches.map((m) => m.round))) {
          const ids = b.matches.filter((m) => m.round === r).flatMap((m) => [m.a, m.b])
          expect(new Set(ids).size).toBe(ids.length)
        }
      }
  })

  it('ranks by points, then difference', () => {
    let t = make(3, 'roundrobin')
    const ms = build(t).matches
    const find = (x: string, y: string) => ms.find((m) => (m.a === x && m.b === y) || (m.a === y && m.b === x))!
    const play = (x: string, y: string, sx: number, sy: number) => {
      const m = find(x, y)
      const [a, b] = m.a === x ? [sx, sy] : [sy, sx]
      t = win(t, m.id, a > b ? 'a' : a < b ? 'b' : 'draw', [a, b])
    }
    play('p1', 'p2', 2, 2)
    play('p1', 'p3', 3, 0)
    play('p2', 'p3', 1, 0)
    const b = build(t)
    expect(b.finished).toBe(true)
    const table = standings(t.players, b.matches)
    expect(table.map((r) => [r.player, r.points])).toEqual([
      ['p1', 4],
      ['p2', 4],
      ['p3', 0],
    ])
    expect(b.champion).toBe('p1')
  })

  it('plays out with draws', () => {
    const t = playOut(make(7, 'roundrobin', { legs: 2 }), rng(7), true)
    expect(build(t).finished).toBe(true)
  })
})
