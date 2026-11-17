// Editors for how a tournament counts points: win/draw/loss for leagues, points by finishing
// place for multiplayer games. Used when creating a tournament and in its settings.
import { Emoji, Icon } from './icons'
import type { ReactNode } from 'react'
import Odometer from './bits/Counter'
import JellyRadio from './bits/JellyRadio'
import ScrubField from './bits/ScrubField'
import { POINT_PRESETS, POINTS, type Points } from './engine'
import { useLang } from './i18n'
import { BIG_PLACES, PARTY_DEFAULTS, PLACE_PRESETS, placesFor, type PartyOptions } from './party'
import { Segmented, Toggle } from './ui'
import { num } from './view'

/** Preset chips: the picked one swells and shoves its neighbours (React Bits JellyRadio). No pick means a custom set. */
function Presets({ items, picked, onPick, label }: { items: ReactNode[]; picked: number; onPick: (i: number) => void; label: string }) {
  const { t } = useLang()
  return (
    <>
    <p className="mt-4 mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-mute">
      <Icon name="sliders" size={14} /> {t('presets')}
    </p>
    {/* one row that scrolls sideways, with room above and below for the swell */}
    <div className="no-scrollbar -mx-4 -my-2 overflow-x-auto px-4 py-2">
    <JellyRadio
      ariaLabel={label}
      items={items.map((x, i) => ({ value: `${i}`, label: x }))}
      value={picked < 0 ? '' : `${picked}`}
      onChange={(_, i) => onPick(i)}
      size="md"
      radius={6}
      swell={0.06}
      barge={3}
      chipColor="#1d1d1d"
      activeColor="#c6f24e"
      textColor="#b4b4b4"
      activeTextColor="#0d1300"
      className="font-semibold tabular-nums"
    />
    </div>
    </>
  )
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-sm font-medium">{children}</p>
      {hint && <p className="text-sm text-mute">{hint}</p>}
    </div>
  )
}

/** A number you drag sideways to change, or tap to type (React Bits ScrubField). */
function NumberField({ value, onChange, label, step = 1 }: { value: number; onChange: (n: number) => void; label: string; step?: number }) {
  return (
    <span role="group" aria-label={label} className="block">
      <ScrubField label="" suffix="" showFill={false} value={value} step={step} min={-999} max={999} onChange={onChange} showDelta={false} showDirty={false} size="lg" accent="#c6f24e" chipColor="#1d1d1d" className="w-full! justify-center px-1! font-display" />
    </span>
  )
}

export function Counter({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const { t } = useLang()
  const round = 'grid size-10 place-items-center pixel bg-raised text-ink transition active:scale-90 disabled:opacity-30'
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" aria-label={t('less')} disabled={value <= min} onClick={() => onChange(value - 1)} className={round}>
        <Icon name="minus" size={18} />
      </button>
      <span className="grid w-9 place-items-center font-display text-xl" aria-live="polite">
        <Odometer value={value} fontSize="1em" duration={0.45} />
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
      <div className="grid grid-cols-3 gap-2">
        {(['win', 'draw', 'loss'] as const).map((k) => (
          <label key={k} className="grid gap-1 text-center text-xs font-semibold text-mute">
            {t(k === 'win' ? 'pointsWin' : k === 'draw' ? 'pointsDraw' : 'pointsLoss')}
            <NumberField value={value[k]} label={t(k === 'win' ? 'pointsWin' : k === 'draw' ? 'pointsDraw' : 'pointsLoss')} onChange={(n) => onChange({ ...value, [k]: n })} />
          </label>
        ))}
      </div>
      <Presets
        label={t('pointsSystem')}
        picked={preset}
        onPick={(i) => onChange(POINT_PRESETS[i])}
        items={POINT_PRESETS.map((p, i) => `${[p.win, p.draw, p.loss].map(num).join(' · ')}${names[i] ? ` ${names[i]}` : ''}`)}
      />
    </div>
  )
}

export function PartyEditor({ value, onChange, minRounds = 1 }: { value: Partial<PartyOptions> | undefined; onChange: (p: PartyOptions) => void; minRounds?: number }) {
  const { t } = useLang()
  const o = { ...PARTY_DEFAULTS, ...value }
  const set = (patch: Partial<PartyOptions>) => onChange({ ...o, ...patch })
  // the points list always covers every seat at the biggest table
  const shown = placesFor(o, o.tableSize)
  const places = Array.from({ length: o.tableSize + 1 }, (_, i) => shown[i] ?? 0).slice(0, Math.max(o.tableSize, 2))
  const preset = PLACE_PRESETS.findIndex((p) => same(p.slice(0, places.length).concat(Array(Math.max(0, places.length - p.length)).fill(0)), places))

  return (
    <div className="grid grid-cols-1 gap-6">
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
        <Label hint={t('placePointsHint')}>{t('placePoints')}</Label>
        <div className="grid grid-cols-4 gap-2">
          {places.map((v, i) => (
            <label key={i} className="grid gap-1 text-center text-xs font-semibold text-mute">
              {/* one fixed-height slot, so the medal rows and the "4°" rows line up */}
              <span className="grid h-6 place-items-center">
                {i < 3 ? <Emoji e={['🥇', '🥈', '🥉'][i]} className="text-xl" label={t('placeN', { n: i + 1 })} /> : t('placeN', { n: i + 1 })}
              </span>
              <NumberField value={v} label={t('placeN', { n: i + 1 })} onChange={(n) => set({ bigPoints: false, places: places.map((x, k) => (k === i ? n : x)) })} />
            </label>
          ))}
        </div>
        <Presets
          label={t('placePoints')}
          picked={o.bigPoints ? PLACE_PRESETS.length : preset}
          onPick={(i) => set(i < PLACE_PRESETS.length ? { bigPoints: false, places: Array.from({ length: places.length }, (_, k) => PLACE_PRESETS[i][k] ?? 0) } : { bigPoints: true })}
          items={[...PLACE_PRESETS.map((p) => p.slice(0, places.length).map(num).join(' · ')), `BIG ${BIG_PLACES[Math.min(7, places.length)].map(num).join(' · ')}`]}
        />
        {o.bigPoints && <p className="mt-2 text-sm text-mute">{t('bigPointsHint')}</p>}
      </div>

      <div>
        <Label>{t('rankBy')}</Label>
        <Segmented
          fit
          label={t('rankBy')}
          value={o.rankBy}
          onChange={(v) => set({ rankBy: v })}
          options={[
            { value: 'points', label: t('rankByPoints') },
            { value: 'score', label: t('rankByScore') },
          ]}
        />
      </div>
      <div>
        <Label hint={o.tiebreak === 'big' ? t('tiebreakBigHint') : t('tiebreakDefaultHint')}>{t('tiebreak')}</Label>
        <Segmented
          fit
          label={t('tiebreak')}
          value={o.tiebreak}
          onChange={(v) => set({ tiebreak: v })}
          options={[
            { value: 'default', label: t('tiebreakDefault') },
            { value: 'big', label: t('tiebreakBig') },
          ]}
        />
      </div>
      <Toggle label={t('lowWins')} hint={t('lowWinsHint')} checked={o.lowWins} onChange={(v) => set({ lowWins: v })} />
    </div>
  )
}
