import { Check, Crown } from 'lucide-react'
import type { ReactNode } from 'react'
import { rounds, standings, type Bracket, type Built, type Match, type Slot, type Tournament } from './engine'
import { useLang } from './i18n'
import { Avatar } from './ui'
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

export function MatchCard({ m, ctx, label }: { m: Match; ctx: Ctx; label?: string }) {
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
        {won && m.bracket !== 'RR' && <Check size={16} className="shrink-0 text-brand" strokeWidth={3} aria-hidden />}
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

function Column({ title, children, tint }: { title: string; children: ReactNode; tint: string }) {
  return (
    <div className={`flex w-[min(15rem,78vw)] shrink-0 snap-start flex-col rounded-[22px] p-2.5 ${tint}`}>
      <h4 className="px-1.5 pt-1 pb-2.5 font-display text-[13px] font-semibold">{title}</h4>
      <div className="flex flex-1 flex-col justify-around gap-2.5">{children}</div>
    </div>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-5 flex snap-x scroll-px-5 items-stretch gap-3 overflow-x-auto px-5 pb-2">{children}</div>
}

function BracketRow({ bracket, ctx }: { bracket: Bracket; ctx: Ctx }) {
  const cols = rounds(ctx.b.matches, bracket)
  return (
    <Row>
      {cols.map(([round, ms]) => (
        <Column key={round} title={roundLabel(ms[0], ctx.b)} tint={tints[bracket]}>
          {ms.map((m) => (
            <MatchCard key={m.id} m={m} ctx={ctx} />
          ))}
        </Column>
      ))}
      {/* the 3rd place match sits next to the final */}
      {bracket === 'W' &&
        ctx.b.matches
          .filter((m) => m.bracket === '3P')
          .map((m) => (
            <Column key={m.id} title={roundLabel(m, ctx.b)} tint={tints['3P']}>
              <MatchCard m={m} ctx={ctx} />
            </Column>
          ))}
    </Row>
  )
}

export function BracketView({ ctx }: { ctx: Ctx }) {
  const { t } = useLang()
  if (ctx.t.format !== 'double') return <BracketRow bracket="W" ctx={ctx} />
  const finals = ctx.b.matches.filter((m) => m.bracket === 'GF' && !m.hidden)
  return (
    <div className="grid grid-cols-1 gap-6">
      <section>
        <h3 className="mb-2.5 text-sm font-semibold text-mute">🌱 {t('winners')}</h3>
        <BracketRow bracket="W" ctx={ctx} />
      </section>
      {ctx.b.matches.some((m) => m.bracket === 'L') && (
        <section>
          <h3 className="mb-2.5 text-sm font-semibold text-mute">🍂 {t('losers')}</h3>
          <BracketRow bracket="L" ctx={ctx} />
        </section>
      )}
      <section>
        <h3 className="mb-2.5 text-sm font-semibold text-mute">🏆 {t('finals')}</h3>
        <Row>
          {finals.map((m) => (
            <Column key={m.id} title={roundLabel(m, ctx.b)} tint={tints.GF}>
              <MatchCard m={m} ctx={ctx} />
            </Column>
          ))}
        </Row>
      </section>
    </div>
  )
}

export function MatchList({ ctx }: { ctx: Ctx }) {
  const { t } = useLang()
  const label = (m: Match) => {
    const r = roundLabel(m, ctx.b)
    return ctx.t.format === 'double' && (m.bracket === 'W' || m.bracket === 'L') ? `${m.bracket === 'W' ? '🌱' : '🍂'} ${r}` : r
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
              {ms.every((m) => m.status === 'done') && <Check size={15} className="self-center text-brand" strokeWidth={3} aria-hidden />}
              {resting(ms).length > 0 && <span className="ml-auto truncate font-normal">💤 {resting(ms).map((p) => p.name).join(', ')}</span>}
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
  const medal = (rank: number) => ['🥇', '🥈', '🥉'][rank - 1] ?? rank

  if (ctx.t.format === 'roundrobin') {
    const rows = standings(ctx.t.players, ctx.b.matches)
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
                  <td className="px-1.5 text-center font-bold">{r.points}</td>
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
            {rank === 1 && <Crown size={18} className="text-gold" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}
