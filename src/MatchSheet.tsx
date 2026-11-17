import { Emoji, Icon } from './icons'
import { useRef, useState } from 'react'
import { build, withResult, type Built, type Match, type Result, type Side, type Tournament } from './engine'
import { useLang } from './i18n'
import { Avatar, btn, burst, closeSheet, danger, Sheet, toast } from './ui'
import { colorOfIndex, roundLabel, sectionLabel } from './view'

export function MatchSheet({ m, tour, b, onResult, onClose }: { m: Match; tour: Tournament; b: Built; onResult: (matchId: string, r: Result | null) => void; onClose: () => void }) {
  const { t } = useLang()
  const draws = m.bracket === 'RR'
  const [a, setA] = useState<number | null>(m.result?.a ?? null)
  const [bs, setB] = useState<number | null>(m.result?.b ?? null)
  const [w, setW] = useState<Side | 'draw' | null>(m.result?.w ?? null)
  const saveRef = useRef<HTMLButtonElement>(null)

  const idx = (id: string) => tour.players.findIndex((p) => p.id === id)
  const player = (id: string) => ({ name: tour.players[idx(id)]?.name ?? '?', color: colorOfIndex(idx(id)) })

  // scores pick the winner by themselves; a tie in a knockout still needs a tap
  const setScore = (side: Side, value: number | null) => {
    const na = side === 'a' ? value : a
    const nb = side === 'b' ? value : bs
    if (side === 'a') setA(value)
    else setB(value)
    if (na != null && nb != null) {
      if (na > nb) setW('a')
      else if (nb > na) setW('b')
      else if (draws) setW('draw')
    }
  }

  // does a later match already count on this one?
  const downstream = (() => {
    if (m.status !== 'done' || draws || !m.result) return false
    const flipped: Result = { ...m.result, w: m.result.w === 'a' ? 'b' : 'a' }
    const after = build({ ...tour, results: { ...tour.results, [m.id]: flipped } })
    return b.matches.some((x) => x.id !== m.id && x.status === 'done' && after.byId.get(x.id)?.status !== 'done')
  })()

  function save() {
    if (!w) return toast(t('needWinner'))
    const result: Result = { a, b: bs, w, pa: m.a!, pb: m.b! }
    const next = withResult(tour, m.id, result)
    onResult(m.id, result)
    const rect = saveRef.current?.getBoundingClientRect()
    if (rect) {
      const finished = build(next).finished && !b.finished
      burst(rect.left + rect.width / 2, rect.top, finished ? '🏆' : w === 'draw' ? '🤝' : '🎉', finished ? 28 : 14)
    }
    closeSheet(saveRef.current)
  }

  function clear() {
    onResult(m.id, null)
    closeSheet(saveRef.current)
  }

  const section = sectionLabel(m, tour.format)
  const sideRow = (side: Side) => {
    const id = side === 'a' ? m.a! : m.b!
    const p = player(id)
    const score = side === 'a' ? a : bs
    const picked = w === side
    return (
      <div className={`flex items-center gap-2 rounded-2xl border-2 p-2 transition ${picked ? 'border-brand bg-c-mint' : 'border-line'}`}>
        <button onClick={() => setW(side)} aria-pressed={picked} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left active:scale-[0.98]">
          <Avatar {...p} size={38} />
          <span className="min-w-0">
            <span className="block truncate font-display text-[17px] font-semibold">{p.name}</span>
            <span className={`flex items-center gap-1 text-sm ${picked ? 'font-semibold text-brand' : 'text-mute'}`}>
              {picked ? (
                <>
                  <Icon name="crown" size={14} /> {t('winner')}
                </>
              ) : (
                ' '
              )}
            </span>
          </span>
        </button>
        <Stepper label={t('score', { name: p.name })} value={score} onChange={(v) => setScore(side, v)} />
      </div>
    )
  }

  return (
    <Sheet
      label={t('result')}
      onClose={onClose}
      header={
        <div className="min-w-0">
          <p className="truncate font-display font-semibold">{roundLabel(m, b)}</p>
          {section && <p className="truncate text-sm text-mute">{section}</p>}
        </div>
      }
      footer={
        <div className="flex items-center gap-3">
          {m.status === 'done' && (
            <button onClick={clear} className={danger}>
              {t('clearResult')}
            </button>
          )}
          <button ref={saveRef} onClick={save} disabled={!w} className={`${btn} ml-auto`}>
            {t('saveResult')}
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-mute">{t('tapWinner')}</p>
      <div className="grid gap-2.5">
        {sideRow('a')}
        <div className="text-center font-display text-sm font-bold text-mute">VS</div>
        {sideRow('b')}
      </div>
      {draws && (
        <button
          onClick={() => setW('draw')}
          aria-pressed={w === 'draw'}
          className={`mt-3 h-11 w-full rounded-2xl border-2 font-semibold transition active:scale-[0.98] ${w === 'draw' ? 'border-brand bg-c-mint' : 'border-line text-mute'}`}
        >
          <Emoji e="🤝" className="mr-1.5 text-lg" />{t('draw')}
        </button>
      )}
      {downstream && <p className="mt-4 rounded-xl bg-c-lemon px-3.5 py-2.5 text-sm">{t('correctionWarn')}</p>}
    </Sheet>
  )
}

function Stepper({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  const { t } = useLang()
  const round = 'grid size-9 place-items-center pixel bg-raised text-mute transition hover:text-ink active:scale-90 disabled:opacity-30'
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button aria-label={t('less')} disabled={!value} onClick={() => onChange(value ? value - 1 : null)} className={round}>
        <Icon name="minus" size={16} />
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={value ?? ''}
        placeholder="–"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
          onChange(digits === '' ? null : Number(digits))
        }}
        onFocus={(e) => e.target.select()}
        className="h-11 w-12 rounded-xl bg-raised text-center font-display text-xl font-bold tabular-nums placeholder:text-mute/60 focus:outline-2 focus:outline-brand"
      />
      <button aria-label={t('more')} onClick={() => onChange((value ?? 0) + 1)} className={round}>
        <Icon name="add" size={16} />
      </button>
    </div>
  )
}
