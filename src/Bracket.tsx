import { useEffect, useRef, useState, type ReactNode } from 'react'
import DotGrid from './bits/DotGrid'
import { Emoji, Icon, type IconName } from './icons'
import { pairsTable, rounds, standings, type Bracket, type Built, type Match, type Slot, type Tournament } from './engine'
import { useLang } from './i18n'
import { TimerChip } from './RoundTimer'
import { Avatar, Count, ReadyCard, reducedMotion, tick, useFlip } from './ui'
import { colorOfIndex, roundLabel } from './view'

export interface Ctx {
  t: Tournament
  b: Built
  canEdit: boolean
  onOpen: (m: Match) => void
}

const useNames = (t: Tournament) => {
  const index = new Map(t.players.map((p, i) => [p.id, i]))
  return (id: string) => ({ name: t.players[index.get(id)!]?.name ?? '?', color: colorOfIndex(index.get(id) ?? 0) })
}

const tints: Record<Bracket, string> = { W: 'bg-c-mint', L: 'bg-c-peach', GF: 'bg-c-lemon', '3P': 'bg-c-lilac', RR: 'bg-c-sky' }

export function MatchCard({ m, ctx, label, gold }: { m: Match; ctx: Ctx; label?: ReactNode; /** the match that decides it all */ gold?: boolean }) {
  const { t } = useLang()
  const who = useNames(ctx.t)
  const clickable = ctx.canEdit && (m.status === 'ready' || m.status === 'done')
  // a card bumps when its state changes: a player arrives, a result lands
  const box = useRef<HTMLDivElement>(null)
  const was = useRef(`${m.status}${m.a}${m.b}`)
  useEffect(() => {
    const now = `${m.status}${m.a}${m.b}`
    if (was.current !== now) tick(box.current, 1.06)
    was.current = now
  }, [m.status, m.a, m.b])
  const side = (s: Slot, key: 'a' | 'b') => {
    const mate = key === 'a' ? m.a2 : m.b2
    const won = m.status === 'done' && m.winner === s && !!s
    const lost = m.status === 'done' && m.loser === s && !!s
    const score = m.result?.[key]
    return (
      <div className={`flex min-h-10 items-center gap-2 px-3 transition-colors duration-500 ${lost ? 'text-mute' : ''} ${won ? (gold ? 'bg-gold/15' : 'bg-brand/10') : ''}`}>
        {s ? <Avatar {...who(s)} size={22} /> : <span className="size-[22px] shrink-0 pixel border-2 border-dashed border-line" />}
        {mate && <span className="-ml-3.5 flex"><Avatar {...who(mate)} size={22} /></span>}
        <span className={`min-w-0 flex-1 truncate text-[15px] ${won ? 'font-bold' : s ? 'font-medium' : 'text-mute italic'}`}>
          {s ? `${who(s).name}${mate ? ` & ${who(mate).name}` : ''}` : s === null ? t('bye') : t('tbd')}
        </span>
        {won && m.bracket !== 'RR' && <Icon name={gold ? 'crown' : 'check'} size={16} className={`pop shrink-0 ${gold ? 'text-gold' : 'text-brand'}`} />}
        {score != null && (
          <span className={`min-w-5 text-right font-display text-base tabular-nums ${won ? '' : 'text-mute'}`}>
            <Count n={score} />
          </span>
        )}
      </div>
    )
  }
  const body = (
    <>
      {label && <div className="px-3 pt-2 text-xs font-semibold text-mute">{label}</div>}
      <div className={label ? 'pb-1' : 'py-1'}>
        {side(m.a, 'a')}
        <div className="border-t border-line" />
        {side(m.b, 'b')}
      </div>
    </>
  )
  const base = `relative block w-full overflow-hidden rounded-2xl bg-sheet text-left ${m.status === 'bye' ? 'opacity-45' : ''} ${gold && m.status === 'done' ? 'shadow-[inset_0_0_0_2px_var(--gold)]' : ''}`
  return (
    <div ref={box} className="relative">
      {m.status === 'ready' && <TimerChip id={`${ctx.t.id}:${m.id}`} />}
      {clickable && m.status === 'ready' ? (
        <ReadyCard onClick={() => ctx.onOpen(m)}>{body}</ReadyCard>
      ) : clickable ? (
        <button onClick={() => ctx.onOpen(m)} className={`${base} transition hover:ring-2 hover:ring-brand/40 active:scale-[0.98]`}>
          {body}
        </button>
      ) : (
        <div className={base}>{body}</div>
      )}
    </div>
  )
}

// Bracket columns sit in one arena and are joined by wires (index.css): each match has a stub out to the
// right, pairs feeding the same next match get a vertical joiner, and the next match a stub in.
// Every slot in a column has the same height and columns stretch to the same height, so centres line up.
export interface Col {
  title: ReactNode
  matches: Match[]
  /** no lines into or out of this column (the 3rd place match) */
  loose?: boolean
  /** something else than matches in this column (the champion at the end, a round of tables) */
  node?: ReactNode
  /** a column of its own content with no line into it and no gold: a round of multiplayer tables */
  plain?: boolean
  /** done and total, when the column doesn't hold matches to count */
  count?: [number, number]
  /** something here waits to be played, when the column doesn't hold matches to tell */
  live?: boolean
}

// the dots light up in the colour of their bracket
const hues: Record<string, string> = { 'bg-c-mint': '#c6f24e', 'bg-c-peach': '#ff8a3d', 'bg-c-lemon': '#ffc83d' }

export function Panel({ cols, tint, ctx, wide }: { cols: Col[]; tint: string; /** only needed for columns of matches */ ctx?: Ctx; /** roomier columns, for tables of several players */ wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const column = (i: number) => box.current?.children[i] as HTMLElement | undefined
  const goTo = (i: number, smooth = true) => {
    const el = column(i)
    if (box.current && el) box.current.scrollTo({ left: el.offsetLeft - 20, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' })
  }
  // the bracket is wider than a phone: bring the round with the next match to play into view as rounds go by
  const isLive = (c: Col) => c.live ?? c.matches.some((m) => m.status === 'ready')
  const next = cols.findIndex(isLive)
  useEffect(() => {
    if (next >= 0) goTo(next)
    // goTo only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next])
  // which round is at the left edge, for the pager
  const onScroll = () => {
    const left = (box.current?.scrollLeft ?? 0) + 20
    let best = 0
    cols.forEach((_, i) => {
      if (Math.abs((column(i)?.offsetLeft ?? 0) - left) < Math.abs((column(best)?.offsetLeft ?? 0) - left)) best = i
    })
    setAt(best)
  }

  return (
    <div className="relative -mx-5 overflow-hidden">
      {/* the plain ground, with a grid of dots that stir under the finger (React Bits DotGrid) */}
      <div aria-hidden className="absolute inset-0">
        <DotGrid dotSize={2} gap={18} baseColor="#2a2a2a" activeColor={hues[tint] ?? '#c6f24e'} proximity={90} strength={0.6} shockRadius={160} shockStrength={2} glow={0.25} dpr={2} />
      </div>
      <div ref={box} onScroll={onScroll} className="no-scrollbar relative flex snap-x snap-mandatory scroll-px-5 overflow-x-auto px-5 pt-4 pb-3">
        {cols.map((col, i) => {
          const next = cols[i + 1]
          const linksOut = !!next && !next.loose && !col.loose
          const linksIn = i > 0 && !col.loose && !cols[i - 1].loose
          const paired = linksOut && next.matches.length * 2 === col.matches.length
          const [played, real] = col.count ?? [col.matches.filter((m) => m.status === 'done').length, col.matches.filter((m) => m.status !== 'bye').length]
          const live = isLive(col)
          // the last round of matches: nothing after it but the champion or the 3rd place match
          const decider = !col.loose && !col.node && (!next || !!next.loose || !!next.node)
          const slot = (m: Match) => (
            <div
              key={m.id}
              className={`relative flex flex-1 flex-col justify-center py-1.5 ${linksOut ? `wire-out ${m.status === 'done' || m.status === 'bye' ? 'lit-out' : ''}` : ''} ${linksIn ? `wire-in ${m.a || m.b ? 'lit-in' : ''}` : ''}`}
            >
              <MatchCard m={m} ctx={ctx!} gold={decider && m.bracket !== 'L'} />
            </div>
          )
          const groups = paired ? Array.from({ length: col.matches.length / 2 }, (_, k) => col.matches.slice(k * 2, k * 2 + 2)) : null
          return (
            <div key={i} className={`flex ${wide ? 'w-[min(17rem,80vw)]' : 'w-[min(14rem,72vw)]'} shrink-0 snap-start flex-col ${next ? (col.plain ? 'mr-4' : col.loose || next.loose ? 'mr-6' : 'mr-8') : ''}`}>
              <h4 className={`flex items-center gap-2 px-1 pb-2 font-display text-[14px] ${live ? 'text-brand' : col.node && !col.plain ? 'text-gold' : ''}`}>
                {live && <span aria-hidden className="blink size-1.5 shrink-0 bg-brand" />}
                <span className="min-w-0 flex-1 truncate">{col.title}</span>
                {real > 0 && (
                  <span className="shrink-0 font-sans text-xs font-semibold text-mute tabular-nums">
                    {played}/{real}
                  </span>
                )}
              </h4>
              <div className="flex flex-1 flex-col">
                {col.plain ? (
                  <div className="py-1.5">{col.node}</div>
                ) : col.node ? (
                  <div className="wire-in lit-in relative flex flex-1 flex-col justify-center py-1.5">{col.node}</div>
                ) : groups ? (
                  groups.map((g, k) => (
                    <div key={k} className={`wire-join relative flex flex-1 flex-col ${g.every((m) => m.status === 'done' || m.status === 'bye') ? 'lit-in' : ''}`}>
                      {g.map(slot)}
                    </div>
                  ))
                ) : (
                  col.matches.map(slot)
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* one pip per round: where you are, and a tap takes you there */}
      {cols.length > 1 && (
        <div className="relative flex justify-center gap-1 pb-3">
          {cols.map((col, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={typeof col.title === 'string' ? col.title : undefined} aria-current={i === at} className="grid h-6 place-items-center px-1">
              <span className={`block h-1.5 transition-all duration-300 ${i === at ? 'w-6 bg-brand' : 'w-1.5 bg-ink/30'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function columns(ctx: Ctx, bracket: Bracket): Col[] {
  return rounds(ctx.b.matches, bracket)
    .map(([, ms]) => ms.filter((m) => !m.hidden))
    .filter((ms) => ms.length)
    .map((ms) => ({ title: roundLabel(ms[0], ctx.b), matches: ms }))
}

/** Who won it all, at the end of a bracket. */
export function ChampionCard({ name, color }: { name: string; color: string }) {
  return (
    <div className="pop grid justify-items-center gap-1.5 rounded-2xl bg-sheet px-3 py-4 text-center shadow-[inset_0_0_0_2px_var(--gold)]">
      <Emoji e="👑" className="wobble text-2xl" />
      <Avatar name={name} color={color} size={72} />
      <span className="w-full truncate font-display text-lg">{name}</span>
    </div>
  )
}

export function BracketView({ ctx }: { ctx: Ctx }) {
  const { t } = useLang()
  const who = useNames(ctx.t)
  const third = ctx.b.matches.filter((m) => m.bracket === '3P').map((m) => ({ title: roundLabel(m, ctx.b), matches: [m], loose: true }))
  // once it is decided, the champion stands at the end of the bracket
  const crowned: Col[] = ctx.b.champion
    ? [
        {
          title: t('champion'),
          matches: [],
          node: <ChampionCard {...who(ctx.b.champion)} />,
        },
      ]
    : []
  if (ctx.t.format !== 'double') return <Panel cols={[...columns(ctx, 'W'), ...crowned, ...third]} tint={tints.W} ctx={ctx} />
  return (
    <div className="grid grid-cols-1 gap-6">
      <section>
        <h3 className="mb-2.5 text-sm font-semibold text-mute"><Emoji e="🌱" className="mr-1.5" />{t('winners')}</h3>
        <Panel cols={columns(ctx, 'W')} tint={tints.W} ctx={ctx} />
      </section>
      {ctx.b.matches.some((m) => m.bracket === 'L') && (
        <section>
          <h3 className="mb-2.5 text-sm font-semibold text-mute"><Emoji e="🍂" className="mr-1.5" />{t('losers')}</h3>
          <Panel cols={columns(ctx, 'L')} tint={tints.L} ctx={ctx} />
        </section>
      )}
      <section>
        <h3 className="mb-2.5 text-sm font-semibold text-mute"><Emoji e="🏆" className="mr-1.5" />{t('finals')}</h3>
        <Panel cols={[...columns(ctx, 'GF'), ...crowned]} tint={tints.GF} ctx={ctx} />
      </section>
    </div>
  )
}

export function MatchList({ ctx }: { ctx: Ctx }) {
  const { t } = useLang()
  const label = (m: Match) => {
    const r = roundLabel(m, ctx.b)
    return ctx.t.format === 'double' && (m.bracket === 'W' || m.bracket === 'L') ? (
          <>
            <Emoji e={m.bracket === 'W' ? '🌱' : '🍂'} className="mr-1" /> {r}
          </>
        ) : (
          r
        )
  }

  if (ctx.t.format === 'roundrobin' || ctx.t.format === 'rotating') {
    const cols = rounds(ctx.b.matches, 'RR')
    const resting = (ms: Match[]) => ctx.t.players.filter((p) => !ms.some((m) => [m.a, m.a2, m.b, m.b2].includes(p.id)))
    return (
      <div className="grid grid-cols-1 gap-6">
        {cols.map(([round, ms]) => (
          <section key={round}>
            <h3 className="mb-2.5 flex items-baseline gap-2 text-sm font-semibold text-mute">
              {t('roundN', { n: round })}
              {ms.every((m) => m.status === 'done') && <Icon name="check" size={15} className="self-center text-brand" />}
              {resting(ms).length > 0 && <span className="ml-auto truncate font-normal"><Emoji e="💤" className="mr-1" /> {resting(ms).map((p) => p.name).join(', ')}</span>}
            </h3>
            <div className="stagger grid gap-2 sm:grid-cols-2">
              {ms.map((m) => (
                <MatchCard key={m.id} m={m} ctx={ctx} />
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  const visible = ctx.b.matches.filter((m) => m.status !== 'bye' && !m.hidden)
  const ready = visible.filter((m) => m.status === 'ready')
  const waiting = visible.filter((m) => m.status === 'waiting')
  const done = visible.filter((m) => m.status === 'done').reverse()
  const group = (icon: IconName, title: string, ms: Match[], empty?: string) =>
    (ms.length > 0 || empty) && (
      <section>
        <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-mute">
          <Icon name={icon} size={16} /> {title} {ms.length > 0 && <span className="ml-1 pixel bg-well px-2 py-0.5 text-xs">{ms.length}</span>}
        </h3>
        {ms.length ? (
          <div className="stagger grid gap-2 sm:grid-cols-2">
            {ms.map((m) => (
              <MatchCard key={m.id} m={m} ctx={ctx} label={label(m)} />
            ))}
          </div>
        ) : (
          <p className="text-mute">{empty}</p>
        )}
      </section>
    )
  return (
    <div className="grid grid-cols-1 gap-7">
      {group('play', t('upNext'), ready, ctx.b.finished ? t('allDone') : undefined)}
      {group('check', t('played'), done)}
      {group('clock', t('waiting'), waiting)}
    </div>
  )
}

export function Standings({ ctx }: { ctx: Ctx }) {
  const { t } = useLang()
  const who = useNames(ctx.t)
  const list = useFlip<HTMLOListElement>()
  const medal = (rank: number) => (rank <= 3 ? <Emoji e={['🥇', '🥈', '🥉'][rank - 1]} className="text-xl" label={`${rank}`} /> : rank)

  if (ctx.t.format === 'roundrobin' || ctx.t.format === 'rotating') {
    const pairs = ctx.t.format === 'rotating'
    const rows = pairs ? pairsTable(ctx.t.players, ctx.b.matches) : standings(ctx.t.players, ctx.b.matches, ctx.t.options.points)
    const th = 'px-1.5 py-2 text-center font-semibold'
    return (
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full text-[15px] tabular-nums">
          <thead className="text-xs text-mute">
            <tr>
              <th className={`${th} w-8`}>{t('pos')}</th>
              <th className={`${th} text-left`}>{t('players')}</th>
              <th className={th}>{t('pl')}</th>
              <th className={th}>{t('w')}</th>
              {pairs ? (
                <>
                  <th className={th}>{t('pf')}</th>
                  <th className={th}>{t('pa')}</th>
                </>
              ) : (
                <>
                  <th className={th}>{t('d')}</th>
                  <th className={th}>{t('l')}</th>
                  <th className={th}>{t('diff')}</th>
                  <th className={th}>{t('pts')}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const p = who(r.player)
              const diff = r.for - r.against
              return (
                <tr key={r.player} className={`border-t border-line ${i === 0 && r.played ? 'bg-c-lemon/60' : ''}`}>
                  <td className="px-1.5 py-2.5 text-center">{r.played ? medal(i + 1) : i + 1}</td>
                  <td className="px-1.5 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar {...p} size={24} />
                      <span className="truncate font-medium">{p.name}</span>
                    </span>
                  </td>
                  <td className="px-1.5 text-center text-mute">{r.played}</td>
                  {pairs ? (
                    <>
                      <td className="px-1.5 text-center font-bold"><Count n={r.won} /></td>
                      <td className="px-1.5 text-center">{r.for}</td>
                      <td className="px-1.5 text-center text-mute">{r.against}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-1.5 text-center">{r.won}</td>
                      <td className="px-1.5 text-center">{r.drawn}</td>
                      <td className="px-1.5 text-center">{r.lost}</td>
                      <td className="px-1.5 text-center text-mute">{diff > 0 ? `+${diff}` : diff}</td>
                      <td className="px-1.5 text-center font-bold"><Count n={r.points} /></td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // knockout: players still in it first, then everyone by final position
  const alive = ctx.t.players.filter((p) => !ctx.b.ranks.has(p.id))
  const out = ctx.t.players.filter((p) => ctx.b.ranks.has(p.id)).sort((x, y) => ctx.b.ranks.get(x.id)! - ctx.b.ranks.get(y.id)!)
  return (
    <ol ref={list} className="stagger grid grid-cols-1 gap-1.5">
      {alive.map((p) => (
        <li key={p.id} data-flip={p.id} className="flex items-center gap-3 rounded-2xl bg-sheet px-3 py-2.5">
          <span className="w-7 text-center text-sm text-mute">•</span>
          <Avatar {...who(p.id)} />
          <span className="flex-1 truncate font-medium">{p.name}</span>
          <span className="pixel bg-c-mint px-2.5 py-0.5 text-xs font-semibold">{t('inProgress')}</span>
        </li>
      ))}
      {out.map((p) => {
        const rank = ctx.b.ranks.get(p.id)!
        return (
          <li key={p.id} data-flip={p.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${rank === 1 ? 'bg-c-lemon' : 'bg-sheet'}`}>
            <span className="w-7 text-center tabular-nums">{medal(rank)}</span>
            <Avatar {...who(p.id)} />
            <span className={`flex-1 truncate ${rank <= 3 ? 'font-semibold' : 'font-medium text-mute'}`}>{p.name}</span>
            {rank === 1 && <Emoji e="👑" className="wobble text-xl" />}
          </li>
        )
      })}
    </ol>
  )
}
