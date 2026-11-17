import type { ReactNode } from 'react'
import { Emoji, Icon } from './icons'
import { rounds, standings, type Bracket, type Built, type Match, type Slot, type Tournament } from './engine'
import { useLang } from './i18n'
import { Avatar } from './ui'
import { colorOfIndex, num, roundLabel } from './view'

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

export function MatchCard({ m, ctx, label }: { m: Match; ctx: Ctx; label?: ReactNode }) {
  const { t } = useLang()
  const who = useNames(ctx.t)
  const clickable = ctx.canEdit && (m.status === 'ready' || m.status === 'done')
  const side = (s: Slot, key: 'a' | 'b') => {
    const won = m.status === 'done' && m.winner === s && !!s
    const lost = m.status === 'done' && m.loser === s && !!s
    const score = m.result?.[key]
    return (
      <div className={`flex min-h-9 items-center gap-2 px-3 ${lost ? 'text-mute' : ''}`}>
        {s ? <Avatar {...who(s)} size={22} /> : <span className="size-[22px] shrink-0 rounded-full border-2 border-dashed border-line" />}
        <span className={`min-w-0 flex-1 truncate text-[15px] ${won ? 'font-bold' : s ? 'font-medium' : 'text-mute italic'}`}>
          {s ? who(s).name : s === null ? t('bye') : t('tbd')}
        </span>
        {won && m.bracket !== 'RR' && <Icon name="check" size={16} className="shrink-0 text-brand" />}
        {score != null && <span className={`min-w-5 text-right tabular-nums ${won ? 'font-bold' : ''}`}>{score}</span>}
      </div>
    )
  }
  const body = (
    <>
      {label && <div className="px-3 pt-2 text-xs font-semibold text-mute">{label}</div>}
      <div className={label ? 'pb-1' : 'py-1'}>
        {side(m.a, 'a')}
        <div className="mx-3 border-t border-line" />
        {side(m.b, 'b')}
      </div>
    </>
  )
  const base = `relative block w-full overflow-hidden rounded-2xl bg-sheet text-left shadow-[0_1px_0_var(--line)] ${
    m.status === 'ready' ? 'border-l-4 border-brand' : m.status === 'bye' ? 'opacity-45' : ''
  }`
  return clickable ? (
    <button onClick={() => ctx.onOpen(m)} className={`${base} transition hover:ring-2 hover:ring-brand/40 active:scale-[0.98]`}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  )
}

// Bracket columns sit in one tinted panel and are joined by lines: each match has a stub out to the
// right, pairs feeding the same next match get a vertical joiner, and the next match a stub in.
// Every slot in a column has the same height and columns stretch to the same height, so centres line up.
// (spelled out in full so Tailwind sees every class)
const stubOut = 'after:pointer-events-none after:absolute after:top-1/2 after:left-full after:w-4 after:-translate-y-px after:border-t-2 after:border-ink/20'
const stubIn = 'before:pointer-events-none before:absolute before:top-1/2 before:right-full before:w-4 before:-translate-y-px before:border-t-2 before:border-ink/20'
const joiner = 'before:pointer-events-none before:absolute before:top-1/4 before:bottom-1/4 before:left-[calc(100%+1rem-1px)] before:-translate-y-px before:border-l-2 before:border-ink/20'

interface Col {
  title: string
  matches: Match[]
  /** no lines into or out of this column (the 3rd place match) */
  loose?: boolean
}

function Panel({ cols, tint, ctx }: { cols: Col[]; tint: string; ctx: Ctx }) {
  return (
    <div className="no-scrollbar -mx-5 overflow-x-auto px-5 pb-2">
      <div className={`inline-flex min-w-full rounded-[24px] p-3 sm:p-4 ${tint}`}>
        {cols.map((col, i) => {
          const next = cols[i + 1]
          const linksOut = !!next && !next.loose && !col.loose
          const linksIn = i > 0 && !col.loose && !cols[i - 1].loose
          const paired = linksOut && next.matches.length * 2 === col.matches.length
          const slot = (m: Match) => (
            <div key={m.id} className={`relative flex flex-1 flex-col justify-center py-1.5 ${linksOut ? stubOut : ''} ${linksIn ? stubIn : ''}`}>
              <MatchCard m={m} ctx={ctx} />
            </div>
          )
          const groups = paired ? Array.from({ length: col.matches.length / 2 }, (_, k) => col.matches.slice(k * 2, k * 2 + 2)) : null
          return (
            <div key={col.title + i} className={`flex w-[min(13.5rem,70vw)] shrink-0 flex-col ${next ? (col.loose || next.loose ? 'mr-6' : 'mr-8') : ''}`}>
              <h4 className="truncate px-1 pb-2 font-display text-[13px] font-semibold">{col.title}</h4>
              <div className="flex flex-1 flex-col">
                {groups
                  ? groups.map((g, k) => (
                      <div key={k} className={`relative flex flex-1 flex-col ${joiner}`}>
                        {g.map(slot)}
                      </div>
                    ))
                  : col.matches.map(slot)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function columns(ctx: Ctx, bracket: Bracket): Col[] {
  return rounds(ctx.b.matches, bracket)
    .map(([, ms]) => ms.filter((m) => !m.hidden))
    .filter((ms) => ms.length)
    .map((ms) => ({ title: roundLabel(ms[0], ctx.b), matches: ms }))
}

export function BracketView({ ctx }: { ctx: Ctx }) {
  const { t } = useLang()
  const third = ctx.b.matches.filter((m) => m.bracket === '3P').map((m) => ({ title: roundLabel(m, ctx.b), matches: [m], loose: true }))
  if (ctx.t.format !== 'double') return <Panel cols={[...columns(ctx, 'W'), ...third]} tint={tints.W} ctx={ctx} />
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
        <Panel cols={columns(ctx, 'GF')} tint={tints.GF} ctx={ctx} />
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

  if (ctx.t.format === 'roundrobin') {
    const cols = rounds(ctx.b.matches, 'RR')
    const resting = (ms: Match[]) => ctx.t.players.filter((p) => !ms.some((m) => m.a === p.id || m.b === p.id))
    return (
      <div className="grid grid-cols-1 gap-6">
        {cols.map(([round, ms]) => (
          <section key={round}>
            <h3 className="mb-2.5 flex items-baseline gap-2 text-sm font-semibold text-mute">
              {t('roundN', { n: round })}
              {ms.every((m) => m.status === 'done') && <Icon name="check" size={15} className="self-center text-brand" />}
              {resting(ms).length > 0 && <span className="ml-auto truncate font-normal"><Emoji e="💤" className="mr-1" /> {resting(ms).map((p) => p.name).join(', ')}</span>}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
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
  const group = (title: string, ms: Match[], empty?: string) =>
    (ms.length > 0 || empty) && (
      <section>
        <h3 className="mb-2.5 text-sm font-semibold text-mute">
          {title} {ms.length > 0 && <span className="ml-1 rounded-full bg-well px-2 py-0.5 text-xs">{ms.length}</span>}
        </h3>
        {ms.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
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
      {group(t('upNext'), ready, ctx.b.finished ? t('allDone') : undefined)}
      {group(t('played'), done)}
      {group(t('waiting'), waiting)}
    </div>
  )
}

export function Standings({ ctx }: { ctx: Ctx }) {
  const { t } = useLang()
  const who = useNames(ctx.t)
  const medal = (rank: number) => (rank <= 3 ? <Emoji e={['🥇', '🥈', '🥉'][rank - 1]} className="text-xl" label={`${rank}`} /> : rank)

  if (ctx.t.format === 'roundrobin') {
    const rows = standings(ctx.t.players, ctx.b.matches, ctx.t.options.points)
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
              <th className={th}>{t('d')}</th>
              <th className={th}>{t('l')}</th>
              <th className={th}>{t('diff')}</th>
              <th className={th}>{t('pts')}</th>
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
                  <td className="px-1.5 text-center">{r.won}</td>
                  <td className="px-1.5 text-center">{r.drawn}</td>
                  <td className="px-1.5 text-center">{r.lost}</td>
                  <td className="px-1.5 text-center text-mute">{diff > 0 ? `+${diff}` : diff}</td>
                  <td className="px-1.5 text-center font-bold">{num(r.points)}</td>
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
    <ol className="grid grid-cols-1 gap-1.5">
      {alive.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-sheet px-3 py-2.5">
          <span className="w-7 text-center text-sm text-mute">•</span>
          <Avatar {...who(p.id)} />
          <span className="flex-1 truncate font-medium">{p.name}</span>
          <span className="rounded-full bg-c-mint px-2.5 py-0.5 text-xs font-semibold">{t('inProgress')}</span>
        </li>
      ))}
      {out.map((p) => {
        const rank = ctx.b.ranks.get(p.id)!
        return (
          <li key={p.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${rank === 1 ? 'bg-c-lemon' : 'bg-sheet'}`}>
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
