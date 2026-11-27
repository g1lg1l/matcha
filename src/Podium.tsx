import { Emoji } from './icons'
import type { Built, Tournament } from './engine'
import { Avatar } from './ui'
import { colorOfIndex } from './view'

/** 2nd · 1st · 3rd on steps that rise in one after the other. Shared places share a step. */
export function Podium({ t, b }: { t: Tournament; b: Built }) {
  const at = (rank: number) => t.players.map((p, i) => ({ ...p, i })).filter((p) => b.ranks.get(p.id) === rank)
  const steps = [
    { rank: 2, h: 'h-20', medal: '🥈', tint: 'bg-c-sky', delay: '120ms' },
    { rank: 1, h: 'h-28', medal: '🥇', tint: 'bg-c-lemon', delay: '0ms' },
    { rank: 3, h: 'h-14', medal: '🥉', tint: 'bg-c-peach', delay: '240ms' },
  ]
  // with a tie for 1st or 2nd the next step down may be empty: fill it with whoever is next
  const used = new Set<string>()
  const pick = (rank: number) => {
    for (let r = rank; r <= t.players.length; r++) {
      const ps = at(r).filter((p) => !used.has(p.id))
      if (ps.length) {
        ps.forEach((p) => used.add(p.id))
        return ps
      }
    }
    return []
  }
  const people = new Map([1, 2, 3].map((r) => [r, pick(r)]))
  return (
    <div className="mx-auto mb-6 grid max-w-sm grid-cols-3 items-end gap-2" aria-hidden>
      {steps.map((s) => {
        const ps = people.get(s.rank) ?? []
        return (
          <div key={s.rank} className="pop flex min-w-0 flex-col items-center" style={{ animationDelay: s.delay, animationFillMode: 'backwards' }}>
            <div className="mb-1.5 flex -space-x-2">
              {ps.slice(0, 3).map((p) => (
                <span key={p.id} className="rounded-md ring-2 ring-paper">
                  <Avatar name={p.name} color={colorOfIndex(p.i)} size={s.rank === 1 ? 44 : 36} />
                </span>
              ))}
            </div>
            <p className={`mb-1.5 w-full truncate text-center ${s.rank === 1 ? 'font-display font-bold' : 'text-sm font-semibold'}`}>{ps.map((p) => p.name).join(' & ') || '–'}</p>
            <div className={`grid w-full place-items-center rounded-t-2xl ${s.rank === 1 ? 'text-[44px]' : 'text-4xl'} ${s.h} ${s.tint}`}>
              <Emoji e={s.medal} className="bob" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
