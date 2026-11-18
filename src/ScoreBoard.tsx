// A plain scoreboard (format "counter"): one card per player with a big score, plus and minus, and a keypad for
// bigger steps. No matches and no bracket: the scores are the whole of it.
// shortcut: every tap saves, which online is one call each; batch them if a busy table makes that chatty.
import { useEffect, useRef, useState } from 'react'
import Counter from './bits/Counter'
import { SCORES, scoresOf } from './engine'
import { Icon } from './icons'
import { useLang } from './i18n'
import type { Source } from './TournamentPage'
import { btn, closeSheet, ghost, Segmented, Sheet, toast } from './ui'
import { colorOfIndex } from './view'

type Mode = 'sub' | 'add' | 'set'

export function ScoreBoard({ source }: { source: Source }) {
  const { t } = useLang()
  const tour = source.t
  const scores = scoresOf(tour)
  const [editing, setEditing] = useState<string>()
  const write = (next: Record<string, number>, to = source) => to.setResult(SCORES, { ids: to.t.players.map((p) => p.id), place: {}, score: next })
  // the scoreboard as it is when an undo is tapped, seconds after the render that made the toast
  const live = useRef(source)
  useEffect(() => {
    live.current = source
  })
  // a change you can take back, for the ones that move a score a long way. Taking it back undoes that change only: what was scored since stays.
  const change = (next: Record<string, number>, message: string) => {
    const before = scores
    write(next)
    toast(message, {
      label: t('undo'),
      run: () => {
        const now = scoresOf(live.current.t)
        const ids = new Set([...Object.keys(before), ...Object.keys(next), ...Object.keys(now)])
        write(Object.fromEntries([...ids].map((id) => [id, (now[id] ?? 0) + (before[id] ?? 0) - (next[id] ?? 0)])), live.current)
      },
    })
  }
  const best = Math.max(...tour.players.map((p) => scores[p.id] ?? 0))
  const anyone = tour.players.some((p) => scores[p.id])
  const edited = tour.players.find((p) => p.id === editing)
  const side = 'grid size-16 shrink-0 place-items-center text-white transition active:scale-90 disabled:opacity-40'

  return (
    <>
      <div className="mt-4 mb-2 flex justify-end">
        <button disabled={!source.canEdit || !anyone} onClick={() => change({}, t('scoresReset'))} className={`${ghost} twist -mr-3 disabled:opacity-40`}>
          <Icon name="restart" size={16} /> {t('resetScores')}
        </button>
      </div>
      <ul className="stagger grid gap-2.5">
        {tour.players.map((p, i) => {
          const score = scores[p.id] ?? 0
          return (
            <li key={p.id} className="pixel overflow-hidden text-white" style={{ background: colorOfIndex(i) }}>
              <div className="flex items-center gap-2 bg-black/15 px-4 py-2">
                {/* the name is its own field: tap it to rename, as in the players list */}
                <input
                  key={p.name}
                  defaultValue={p.name}
                  aria-label={p.name}
                  maxLength={40}
                  readOnly={!source.canEdit}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name && name !== p.name && !tour.players.some((x) => x.id !== p.id && x.name.toLowerCase() === name.toLowerCase())) source.save({ ...tour, players: tour.players.map((x) => (x.id === p.id ? { ...x, name } : x)) })
                    else e.target.value = p.name
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="min-w-0 flex-1 bg-transparent font-display text-lg text-ellipsis outline-none focus:bg-black/20"
                />
                {anyone && score === best && <Icon name="crown" size={18} className="pop" />}
              </div>
              <div className="flex items-center px-1 py-2">
                <button aria-label={`${t('less')}: ${p.name}`} disabled={!source.canEdit} onClick={() => write({ ...scores, [p.id]: score - 1 })} className={side}>
                  <Icon name="minus" size={30} />
                </button>
                <button
                  aria-label={t('score', { name: p.name })}
                  disabled={!source.canEdit}
                  onClick={() => setEditing(p.id)}
                  className="grid min-w-0 flex-1 place-items-center font-display text-[68px] leading-none tabular-nums transition active:scale-95"
                >
                  <Counter value={score} fontSize="1em" duration={0.4} />
                </button>
                <button aria-label={`${t('more')}: ${p.name}`} disabled={!source.canEdit} onClick={() => write({ ...scores, [p.id]: score + 1 })} className={side}>
                  <Icon name="add" size={30} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {source.canEdit && (
        <button
          onClick={() => {
            const taken = new Set(tour.players.map((p) => p.name.toLowerCase()))
            let n = tour.players.length + 1
            while (taken.has(t('playerN', { n }).toLowerCase())) n++
            source.save({ ...tour, players: [...tour.players, { id: crypto.randomUUID().slice(0, 8), name: t('playerN', { n }) }] })
          }}
          className="twist mt-2.5 flex h-14 w-full items-center justify-center gap-2 border-2 border-dashed border-line font-display text-mute transition active:scale-[0.98]"
        >
          <Icon name="userPlus" size={20} /> {t('addOne')}
        </button>
      )}
      {edited && (
        <Keypad
          name={edited.name}
          score={scores[edited.id] ?? 0}
          onClose={() => setEditing(undefined)}
          onApply={(value) => change({ ...scores, [edited.id]: value }, t('scoreSaved'))}
        />
      )}
    </>
  )
}

// Take away, add or set: type the amount, or tap one of the usual steps.
function Keypad({ name, score, onApply, onClose }: { name: string; score: number; onApply: (value: number) => void; onClose: () => void }) {
  const { t } = useLang()
  const [mode, setMode] = useState<Mode>('add')
  const [entry, setEntry] = useState('')
  const done = useRef<HTMLButtonElement>(null)
  const n = Number(entry || 0)
  const after = (by: number) => (mode === 'add' ? score + by : mode === 'sub' ? score - by : by)
  const apply = (value: number) => {
    onApply(value)
    closeSheet(done.current)
  }
  const key = 'pixel grid h-14 place-items-center bg-raised font-display text-2xl transition active:scale-95 active:bg-line'
  const sign = mode === 'add' ? '+' : mode === 'sub' ? '−' : '='

  return (
    <Sheet
      label={t('score', { name })}
      onClose={onClose}
      header={<p className="overflow-hidden font-display text-ellipsis whitespace-nowrap">{name}</p>}
      footer={
        <button ref={done} onClick={() => apply(after(n))} className={`${btn} h-13 w-full text-[17px]`}>
          <Icon name="check" size={20} /> {t('confirm')}
        </button>
      }
    >
      <Segmented
        label={t('score', { name })}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'sub', label: <Icon name="minus" size={22} /> },
          { value: 'add', label: <Icon name="add" size={22} /> },
          { value: 'set', label: <span className="font-display text-xl">=</span> },
        ]}
      />
      <p className="my-4 text-center font-display tabular-nums" aria-live="polite">
        <span className="block text-sm text-mute">
          {mode === 'set' ? score : `${score} ${sign} ${n}`}
        </span>
        <span className="block text-[56px] leading-none">{after(n)}</span>
      </p>
      {mode !== 'set' && (
        <div className="mb-2 grid grid-cols-4 gap-2">
          {[5, 10, 15, 20].map((q) => (
            <button key={q} onClick={() => apply(after(q))} className="pixel h-11 bg-marker font-display text-on-marker transition active:scale-95">
              {sign}
              {q}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => setEntry((e) => (e + d).slice(0, 6))} className={key}>
            {d}
          </button>
        ))}
        <span />
        <button onClick={() => setEntry((e) => (e + '0').slice(0, 6))} className={key}>
          0
        </button>
        <button onClick={() => setEntry((e) => e.slice(0, -1))} aria-label="⌫" className={key}>
          <Icon name="back" size={24} />
        </button>
      </div>
    </Sheet>
  )
}
