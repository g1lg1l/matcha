// Editors for how a tournament counts points: win/draw/loss for leagues, points by finishing
// place for multiplayer games. Used when creating a tournament and in its settings.
import { Emoji, Icon } from './icons'
import { useState, type ReactNode } from 'react'
import { POINT_PRESETS, POINTS, type Points } from './engine'
import { useLang } from './i18n'
import { PARTY_DEFAULTS, PLACE_PRESETS, type PartyOptions } from './party'
import { Segmented, Toggle } from './ui'
import { num } from './view'

const chip = (on: boolean) =>
  `h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold tabular-nums transition active:scale-95 ${on ? 'bg-primary text-on-primary' : 'bg-raised text-mute hover:text-ink'}`

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-sm font-medium">{children}</p>
      {hint && <p className="text-sm text-mute">{hint}</p>}
    </div>
  )
}

/** A small number field that accepts "0,5" as well as "0.5". */
function NumberField({ value, onChange, label, step = 1 }: { value: number; onChange: (n: number) => void; label: string; step?: number }) {
  const [text, setText] = useState(num(value))
  const [focused, setFocused] = useState(false)
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      value={focused ? text : num(value)}
      onFocus={(e) => {
        setText(num(value))
        setFocused(true)
        requestAnimationFrame(() => e.target.select())
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value.replace(',', '.'))
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(Math.round(n * 100) / 100)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') onChange(value + step)
        if (e.key === 'ArrowDown') onChange(value - step)
      }}
      className="h-11 w-full min-w-0 rounded-xl bg-raised text-center font-display text-lg font-bold tabular-nums focus:outline-2 focus:outline-brand"
    />
  )
}

export function Counter({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const { t } = useLang()
  const round = 'grid size-10 place-items-center rounded-full bg-raised text-ink transition active:scale-90 disabled:opacity-30'
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" aria-label={t('less')} disabled={value <= min} onClick={() => onChange(value - 1)} className={round}>
        <Icon name="minus" size={18} />
      </button>
      <span className="w-9 text-center font-display text-xl font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={t('more')} disabled={value >= max} onClick={() => onChange(value + 1)} className={round}>
        <Icon name="add" size={18} />
      </button>
    </div>
  )
}

export function PointsEditor({ value = POINTS, onChange }: { value?: Points; onChange: (p: Points) => void }) {
  const { t } = useLang()
  const names = [t('presetFootball'), '', t('presetChess')]
  const preset = POINT_PRESETS.findIndex((p) => p.win === value.win && p.draw === value.draw && p.loss === value.loss)
  return (
    <div>
      <Label>{t('pointsSystem')}</Label>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
        {POINT_PRESETS.map((p, i) => (
          <button key={i} type="button" onClick={() => onChange(p)} aria-pressed={preset === i} className={chip(preset === i)}>
            {[p.win, p.draw, p.loss].map(num).join(' · ')}
            {names[i] && <span className="ml-1.5 font-medium opacity-75">{names[i]}</span>}
          </button>
        ))}
        <span className={`${chip(preset < 0)} pointer-events-none inline-flex items-center`}>{t('custom')}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(['win', 'draw', 'loss'] as const).map((k) => (
          <label key={k} className="grid gap-1 text-center text-xs font-semibold text-mute">
            {t(k === 'win' ? 'pointsWin' : k === 'draw' ? 'pointsDraw' : 'pointsLoss')}
            <NumberField value={value[k]} label={t(k === 'win' ? 'pointsWin' : k === 'draw' ? 'pointsDraw' : 'pointsLoss')} onChange={(n) => onChange({ ...value, [k]: n })} />
          </label>
        ))}
      </div>
    </div>
  )
}

export function PartyEditor({ value, onChange, minRounds = 1 }: { value: Partial<PartyOptions> | undefined; onChange: (p: PartyOptions) => void; minRounds?: number }) {
  const { t } = useLang()
  const o = { ...PARTY_DEFAULTS, ...value }
  const set = (patch: Partial<PartyOptions>) => onChange({ ...o, ...patch })
  // the points list always covers every seat at the biggest table
  const places = Array.from({ length: o.tableSize + 1 }, (_, i) => o.places[i] ?? 0).slice(0, Math.max(o.tableSize, 2))
  const preset = PLACE_PRESETS.findIndex((p) => same(p.slice(0, places.length).concat(Array(Math.max(0, places.length - p.length)).fill(0)), places))

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{t('tableSize')}</Label>
          <Counter label={t('tableSize')} value={o.tableSize} min={2} max={8} onChange={(n) => set({ tableSize: n, places: Array.from({ length: n }, (_, i) => o.places[i] ?? 0) })} />
        </div>
        <div>
          <Label>{t('roundsCount')}</Label>
          <Counter label={t('roundsCount')} value={o.rounds} min={Math.max(1, minRounds)} max={30} onChange={(n) => set({ rounds: n })} />
        </div>
      </div>

      <div>
        <Label hint={t('tableSizeHint')}>{t('pairing')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['random', 'standings'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set({ pairing: p })}
              aria-pressed={o.pairing === p}
              className={`rounded-2xl border-2 p-3 text-left transition active:scale-[0.98] ${o.pairing === p ? 'border-brand bg-c-mint' : 'border-transparent bg-raised'}`}
            >
              <span className="block font-semibold"><Emoji e={p === 'random' ? '🔀' : '📈'} className="mr-1.5" />
                {p === 'random' ? t('pairingRandom') : t('pairingStandings')}</span>
              <span className="block text-sm text-mute">{p === 'random' ? t('pairingRandomHint') : t('pairingStandingsHint')}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>{t('placePoints')}</Label>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {PLACE_PRESETS.map((p, i) => (
            <button key={i} type="button" onClick={() => set({ places: Array.from({ length: places.length }, (_, k) => p[k] ?? 0) })} aria-pressed={preset === i} className={chip(preset === i)}>
              {p.slice(0, places.length).map(num).join(' · ')}
            </button>
          ))}
          <span className={`${chip(preset < 0)} pointer-events-none inline-flex items-center`}>{t('custom')}</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {places.map((v, i) => (
            <label key={i} className="grid gap-1 text-center text-xs font-semibold text-mute">
              {i < 3 ? <Emoji e={['🥇', '🥈', '🥉'][i]} className="mx-auto text-xl" label={t('placeN', { n: i + 1 })} /> : t('placeN', { n: i + 1 })}
              <NumberField value={v} label={t('placeN', { n: i + 1 })} onChange={(n) => set({ places: places.map((x, k) => (k === i ? n : x)) })} />
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>{t('rankBy')}</Label>
        <Segmented
          label={t('rankBy')}
          value={o.rankBy}
          onChange={(v) => set({ rankBy: v })}
          options={[
            { value: 'points', label: t('rankByPoints') },
            { value: 'score', label: t('rankByScore') },
          ]}
        />
      </div>
      <Toggle label={t('lowWins')} hint={t('lowWinsHint')} checked={o.lowWins} onChange={(v) => set({ lowWins: v })} />
    </div>
  )
}
