// Multiplayer games: rounds of tables, entering a table's finishing order, and the standings.
import { Emoji, Icon } from './icons'
import { useMemo, useRef, useState } from 'react'
import { ChampionCard, Panel, type Col } from './Bracket'
import { build, withResult, type Built, type Tournament } from './engine'
import { useLang } from './i18n'
import { nextRound, partyOptions, placePoints, placesFor, placesFromScores, type Table, type TableResult } from './party'
import { Avatar, btn, burst, closeSheet, Count, danger, ghost, pill, ReadyCard, Sheet, useFlip, warn } from './ui'
import { MatchTimer, TimerChip } from './RoundTimer'
import { colorOfIndex, num } from './view'

const medal = (place: number) => (place <= 3 ? <Emoji e={['🥇', '🥈', '🥉'][place - 1]} className="text-lg" label={`${place}`} /> : undefined)

function usePlayer(t: Tournament) {
  return useMemo(() => {
    const index = new Map(t.players.map((p, i) => [p.id, i]))
    return (id: string) => ({ name: t.players[index.get(id) ?? -1]?.name ?? '?', color: colorOfIndex(index.get(id) ?? 0) })
  }, [t.players])
}

export function RoundsView({ t, b, canEdit, onOpen, onNextRound }: { t: Tournament; b: Built; canEdit: boolean; onOpen: (table: Table) => void; onNextRound: () => void }) {
  const { t: tr } = useLang()
  const who = usePlayer(t)
  const total = Math.max(t.options.party?.rounds ?? 3, b.roundsPlayed)
  const rounds = Array.from({ length: b.roundsPlayed }, (_, i) => b.roundsPlayed - i) // newest first
  const canSeat = canEdit && b.roundDone && b.roundsPlayed < total

  return (
    <div className="grid grid-cols-1 gap-8">
      {canSeat && (
        <button onClick={onNextRound} className={`${pill} shine pop h-14 w-full text-[17px]`}>
          <Icon name="stars" size={20} /> {tr('nextRound', { n: b.roundsPlayed + 1 })}
        </button>
      )}
      {rounds.map((r) => {
        const tables = b.tables.filter((x) => x.round === r)
        const done = tables.every((x) => x.status === 'done')
        return (
          <section key={r}>
            <h3 className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold">
              {tr('roundOf', { n: r, total })}
              {done && <Icon name="check" size={16} className="text-brand" />}
            </h3>
            <div className="stagger grid gap-3 sm:grid-cols-2">
              {tables.map((table) => (
                <TableCard key={table.id} table={table} tid={t.id} who={who} canEdit={canEdit} onOpen={() => onOpen(table)} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/**
 * The same tournament as a bracket: one column per round, its tables down the column, the rounds still to
 * come waiting on the right and the winner at the end. Everyone plays every round, so no lines join the columns.
 */
export function PartyBracket({ t, b, canEdit, onOpen, onNextRound }: { t: Tournament; b: Built; canEdit: boolean; onOpen: (table: Table) => void; onNextRound: () => void }) {
  const { t: tr } = useLang()
  const who = usePlayer(t)
  const total = Math.max(t.options.party?.rounds ?? 3, b.roundsPlayed)
  const canSeat = canEdit && b.roundDone && b.roundsPlayed < total
  const cols: Col[] = Array.from({ length: total }, (_, i) => {
    const round = i + 1
    const tables = b.tables.filter((x) => x.round === round)
    return {
      title: tr('roundN', { n: round }),
      matches: [],
      plain: true,
      count: tables.length ? [tables.filter((x) => x.status === 'done').length, tables.length] : undefined,
      live: tables.some((x) => x.status !== 'done') || (canSeat && round === b.roundsPlayed + 1),
      node: tables.length ? (
        <div className="grid gap-3">
          {tables.map((table) => (
            <TableCard key={table.id} table={table} tid={t.id} who={who} canEdit={canEdit} onOpen={() => onOpen(table)} />
          ))}
        </div>
      ) : canSeat && round === b.roundsPlayed + 1 ? (
        <button onClick={onNextRound} className={`${pill} shine pop h-14 w-full`}>
          <Icon name="stars" size={20} /> {tr('nextRound', { n: round })}
        </button>
      ) : (
        <div className="grid min-h-24 place-items-center rounded-2xl border-2 border-dashed border-line text-sm text-mute">{tr('waiting')}</div>
      ),
    }
  })
  if (b.finished && b.champion) cols.push({ title: tr('champion'), matches: [], node: <ChampionCard {...who(b.champion)} /> })
  return <Panel cols={cols} tint="bg-c-mint" wide />
}

function TableCard({ table, tid, who, canEdit, onOpen }: { table: Table; /** the tournament, for the table's timer */ tid: string; who: ReturnType<typeof usePlayer>; canEdit: boolean; onOpen: () => void }) {
  const { t } = useLang()
  const r = table.result
  const order = r ? [...table.players].sort((x, y) => r.place[x] - r.place[y]) : table.players
  const anyScore = r && table.players.some((p) => r.score[p] != null)
  const body = (
    <>
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
        <span className="text-xs font-semibold text-mute">{t('tableN', { n: table.index + 1 })}</span>
        {!r && canEdit && <span className="text-xs font-semibold text-brand">{t('result')} →</span>}
      </div>
      <ol className="px-1.5 pb-2">
        {order.map((id) => {
          const p = who(id)
          const place = r?.place[id]
          return (
            <li key={id} className={`flex min-h-10 items-center gap-2.5 rounded-xl px-2 ${place === 1 ? 'bg-c-lemon/70' : ''}`}>
              <span className="w-6 text-center text-sm font-semibold text-mute tabular-nums">{place ? (medal(place) ?? `${place}°`) : ''}</span>
              <Avatar {...p} size={24} />
              <span className={`min-w-0 flex-1 truncate ${place === 1 ? 'font-bold' : 'font-medium'}`}>{p.name}</span>
              {anyScore && r.score[id] != null && <span className="text-sm text-mute tabular-nums">{num(r.score[id]!)}</span>}
              {r && <span className="min-w-10 pixel bg-raised px-2 py-0.5 text-center text-xs font-bold tabular-nums">+{num(table.points[id] ?? 0)}</span>}
            </li>
          )
        })}
      </ol>
    </>
  )
  const base = 'block w-full overflow-hidden rounded-2xl bg-sheet text-left'
  return canEdit && !r ? (
    <div className="relative">
      <ReadyCard onClick={onOpen}>{body}</ReadyCard>
      <TimerChip id={`${tid}:${table.id}`} />
    </div>
  ) : canEdit ? (
    <button onClick={onOpen} className={`${base} transition hover:ring-2 hover:ring-brand/40 active:scale-[0.99]`}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  )
}

export function TableSheet({ table, tour, b, onResult, onClose }: { table: Table; tour: Tournament; b: Built; onResult: (id: string, r: TableResult | null) => void; onClose: () => void }) {
  const { t } = useLang()
  const who = usePlayer(tour)
  const opts = partyOptions(tour)
  const saveRef = useRef<HTMLButtonElement>(null)
  const list = useFlip<HTMLOListElement>()
  const ids = table.players
  const initial = table.result
  // tap order, for when there are no scores
  const [order, setOrder] = useState<string[]>(() => (initial ? [...ids].sort((x, y) => initial.place[x] - initial.place[y]) : []))
  const [score, setScore] = useState<Record<string, number | null>>(() => Object.fromEntries(ids.map((id) => [id, initial?.score[id] ?? null])))

  const fromScores = placesFromScores(ids, score, opts.lowWins)
  const place: Record<string, number> = fromScores ?? Object.fromEntries(order.map((id, i) => [id, i + 1]))
  const complete = ids.every((id) => place[id])
  const points = complete ? placePoints(place, placesFor(opts, ids.length)) : {}

  const tap = (id: string) => {
    if (fromScores) return
    setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))
  }

  function save() {
    if (!complete) return warn(t('allPlaced'))
    const result: TableResult = { ids, place, score }
    onResult(table.id, result)
    const after = build(withResult(tour, table.id, result))
    const r = saveRef.current?.getBoundingClientRect()
    if (r) burst(r.left + r.width / 2, r.top, after.finished && !b.finished ? '🏆' : '🎲', after.finished && !b.finished ? 28 : 14)
    closeSheet(saveRef.current)
  }

  const sorted = complete ? [...ids].sort((x, y) => place[x] - place[y]) : ids
  return (
    <Sheet
      label={t('result')}
      onClose={onClose}
      header={
        <div>
          <p className="font-display font-semibold">{t('tableN', { n: table.index + 1 })}</p>
          <p className="text-sm text-mute">{t('roundN', { n: table.round })}</p>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          {initial ? (
            <button
              onClick={() => {
                onResult(table.id, null)
                closeSheet(saveRef.current)
              }}
              className={danger}
            >
              <Icon name="trash" size={16} /> {t('clearResult')}
            </button>
          ) : (
            <button
              onClick={() => {
                setOrder([])
                setScore(Object.fromEntries(ids.map((id) => [id, null])))
              }}
              className={`${ghost} -ml-3`}
            >
              <Icon name="restart" size={15} /> {t('resetOrder')}
            </button>
          )}
          <button ref={saveRef} onClick={save} disabled={!complete} className={`${btn} ml-auto`}>
            <Icon name="check" size={18} /> {t('saveResult')}
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-mute">{t('finishOrder')}</p>
      {!initial && <MatchTimer id={`${tour.id}:${table.id}`} label={t('tableN', { n: table.index + 1 })} />}
      <ol ref={list} className="grid grid-cols-1 gap-2">
        {sorted.map((id) => {
          const p = who(id)
          const pl = place[id]
          return (
            <li key={id} data-flip={id} className={`flex items-center gap-2 rounded-2xl border-2 p-1.5 transition ${pl === 1 ? 'border-brand bg-c-mint' : pl ? 'border-line' : 'border-dashed border-line'}`}>
              <button onClick={() => tap(id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left active:scale-[0.98]" aria-label={p.name}>
                <span key={pl ?? 0} className={`grid size-10 shrink-0 place-items-center pixel text-lg font-bold tabular-nums ${pl ? 'pop bg-sheet' : 'bg-raised text-mute'}`}>
                  {pl ? (medal(pl) ?? `${pl}°`) : '·'}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <Avatar {...p} size={22} />
                    <span className="truncate font-display text-[16px] font-semibold">{p.name}</span>
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-brand tabular-nums">{points[id] != null ? t('ptsGained', { n: num(points[id]) }) : ' '}</span>
                </span>
              </button>
              <input
                inputMode="decimal"
                aria-label={`${t('gameScore')} ${p.name}`}
                placeholder={t('gameScore')}
                value={score[id] == null ? '' : String(score[id]).replace('.', ',')}
                onChange={(e) => {
                  const raw = e.target.value.replace(',', '.').replace(/[^\d.-]/g, '')
                  const n = raw === '' || raw === '-' ? null : Number(raw)
                  setScore((s) => ({ ...s, [id]: n != null && Number.isFinite(n) ? n : null }))
                }}
                className="h-11 w-24 shrink-0 rounded-xl bg-raised px-2 text-center font-display text-lg font-bold tabular-nums placeholder:font-sans placeholder:text-xs placeholder:font-medium placeholder:text-mute/70 focus:outline-2 focus:outline-brand"
              />
            </li>
          )
        })}
      </ol>
    </Sheet>
  )
}

export function PartyStandings({ t, b }: { t: Tournament; b: Built }) {
  const { t: tr } = useLang()
  const who = usePlayer(t)
  const showScore = b.rows.some((r) => r.hasScore)
  const byScore = partyOptions(t).rankBy === 'score'
  const th = 'px-1.5 py-2 text-center font-semibold'
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-[15px] tabular-nums">
        <thead className="text-xs text-mute">
          <tr>
            <th className={`${th} w-8`}>{tr('pos')}</th>
            <th className={`${th} text-left`}>{tr('players')}</th>
            <th className={th}>{tr('pl')}</th>
            <th className={th}>{tr('wins1st')}</th>
            {showScore && <th className={th}>{tr('gameScore')}</th>}
            <th className={th}>{tr('pts')}</th>
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r, i) => {
            const p = who(r.player)
            return (
              <tr key={r.player} className={`border-t border-line ${i === 0 && r.played ? 'bg-c-lemon/60' : ''}`}>
                <td className="px-1.5 py-2.5 text-center">{r.played ? (medal(i + 1) ?? i + 1) : i + 1}</td>
                <td className="px-1.5 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar {...p} size={24} />
                    <span className="truncate font-medium">{p.name}</span>
                  </span>
                </td>
                <td className="px-1.5 text-center text-mute">{r.played}</td>
                <td className="px-1.5 text-center">{r.wins}</td>
                {showScore && <td className={`px-1.5 text-center ${byScore ? 'font-bold' : 'text-mute'}`}>{r.hasScore ? num(r.score) : '–'}</td>}
                <td className={`px-1.5 text-center ${byScore ? 'text-mute' : 'font-bold'}`}><Count n={r.points} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Seats the next round. */
export const withNextRound = (t: Tournament): Tournament => ({ ...t, tables: [...(t.tables ?? []), nextRound(t)] })
