// A countdown for the round or the match being played: start, pause, reset, and a time picked from a few presets.
// It rings, buzzes and says so when time is up, and keeps the screen on while it runs.
// shortcut: it lives on this device only; put it in the tournament document when the people following online need to see it.
import { useEffect, useRef, useState } from 'react'
import Counter from './bits/Counter'
import JellyRadio from './bits/JellyRadio'
import { Icon } from './icons'
import { useLang } from './i18n'
import { ring, timers, unlockSound, useTimer } from './timers'
import { iconBtn, pill, Segmented } from './ui'

type Saved = { minutes: number; endsAt: number | null; left: number; /** what it times: it starts over with each new round, or after each result */ per?: 'round' | 'match' }
const PRESETS = [5, 10, 15, 20, 30, 45, 60]
const MINUTE = 60_000

function load(key: string): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? '')
    if (typeof s?.minutes === 'number' && typeof s?.left === 'number') return s
  } catch {
    /* nothing saved */
  }
  return { minutes: 20, endsAt: null, left: 20 * MINUTE }
}

/** `round` is the round being played and `played` how many results are in: when the one it times changes, the timer goes back to the full time, stopped. `plain` is for a single game: nothing to start over with. */
export function RoundTimer({ id, round, played, plain }: { id: string; round: number; played: number; plain?: boolean }) {
  const { t } = useLang()
  const key = `matcha:timer:${id}`
  const [s, setS] = useState(() => load(key))
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState(false)
  // what the ticking interval reads: the timer as it is now, not as it was when it started
  const latest = useRef(s)
  useEffect(() => {
    latest.current = s
  })

  const save = (next: Saved) => {
    setS(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* fine, just not remembered */
    }
  }

  const running = s.endsAt !== null
  const left = Math.max(0, running ? s.endsAt! - now : s.left)
  const seconds = Math.ceil(left / 1000)
  const full = s.minutes * MINUTE

  // tick while it runs, with the screen kept on
  useEffect(() => {
    if (s.endsAt === null) return
    const endsAt = s.endsAt
    const tick = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= endsAt) {
        save({ ...latest.current, endsAt: null, left: 0 })
        ring()
      }
    }, 250)
    // the browser drops the lock when the app goes to the background: ask again when it is back
    let lock: WakeLockSentinel | undefined
    let over = false
    const hold = () =>
      navigator.wakeLock?.request('screen').then(
        (l) => {
          if (over) l.release().catch(() => {})
          else lock = l
        },
        () => {},
      )
    const back = () => {
      if (document.visibilityState === 'visible') hold()
    }
    hold()
    document.addEventListener('visibilitychange', back)
    return () => {
      over = true
      clearInterval(tick)
      document.removeEventListener('visibilitychange', back)
      lock?.release().catch(() => {})
    }
    // save only reads the latest state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.endsAt])

  // a new round, or the next match, starts from the full time
  const per = s.per ?? 'round'
  const lap = per === 'round' ? round : played
  const seen = useRef(lap)
  useEffect(() => {
    if (seen.current === lap) return
    seen.current = lap
    save({ ...s, endsAt: null, left: full })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lap])

  const toggle = () => {
    if (running) return save({ ...s, endsAt: null, left })
    unlockSound()
    const from = left || full
    setNow(Date.now())
    save({ ...s, endsAt: Date.now() + from, left: from })
  }

  const low = left > 0 && left <= MINUTE
  return (
    <section aria-label={t('timer')} className="mt-4 rounded-2xl bg-sheet py-2.5 pr-2.5 pl-3.5">
      <div className="flex items-center gap-2">
        <Icon name="clock" size={18} className={left === 0 || low ? 'text-danger' : 'text-mute'} />
        <button
          onClick={() => setEditing(!editing)}
          aria-expanded={editing}
          aria-label={t('timerSet')}
          className={`flex flex-1 items-baseline font-sans font-semibold text-[26px] tabular-nums ${left === 0 ? 'blink text-danger' : low ? 'text-danger' : ''}`}
        >
          <Counter value={Math.floor(seconds / 60)} minDigits={2} fontSize="1em" duration={0.35} />
          <span className="px-0.5">:</span>
          <Counter value={seconds % 60} minDigits={2} fontSize="1em" duration={0.35} />
        </button>
        <button onClick={() => save({ ...s, endsAt: null, left: full })} aria-label={t('timerReset')} disabled={!running && left === full} className={`${iconBtn} twist`}>
          <Icon name="restart" size={20} />
        </button>
        <button onClick={toggle} className={`${pill} h-10 min-w-24 px-4 text-sm`}>
          <Icon name={running ? 'pause' : 'play'} size={16} /> {running ? t('pause') : t('start')}
        </button>
      </div>
      {editing && (
        <div className="pop no-scrollbar -mr-2.5 -ml-3.5 overflow-x-auto py-2 pr-2.5 pl-3.5">
          <JellyRadio
            ariaLabel={t('timerSet')}
            items={PRESETS.map((m) => ({ value: `${m}`, label: t('minutesN', { n: m }) }))}
            value={`${s.minutes}`}
            onChange={(v) => {
              save({ ...s, minutes: Number(v), endsAt: null, left: Number(v) * MINUTE })
            }}
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
      )}
      {editing && !plain && (
        <div className="mt-1 mr-1">
          <p className="mb-1.5 text-xs font-semibold text-mute">{t('timerPer')}</p>
          <Segmented
            fit
            label={t('timerPer')}
            value={per}
            onChange={(v) => {
              seen.current = v === 'round' ? round : played
              save({ ...s, per: v })
            }}
            options={[
              { value: 'round', label: t('timerRound') },
              { value: 'match', label: t('timerMatch') },
            ]}
          />
        </div>
      )}
    </section>
  )
}

const clock = (left: number) => {
  const seconds = Math.ceil(left / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/** The timer of one match or table, inside its sheet: its own time, start, pause, back to full. */
export function MatchTimer({ id, label }: { id: string; label: string }) {
  const { t } = useLang()
  const { minutes, running, left, touched } = useTimer(id)
  const seconds = Math.ceil(left / 1000)
  const low = left <= MINUTE
  return (
    <section aria-label={t('matchTimer')} className="mb-4 rounded-2xl bg-raised py-2 pr-2 pl-3.5">
      <div className="flex items-center gap-2">
        <Icon name="clock" size={18} className={touched && low ? 'text-danger' : 'text-mute'} />
        <span className={`flex flex-1 items-baseline font-sans font-semibold text-2xl tabular-nums ${left === 0 ? 'blink text-danger' : touched && low ? 'text-danger' : ''}`}>
          <Counter value={Math.floor(seconds / 60)} minDigits={2} fontSize="1em" duration={0.35} />
          <span className="px-0.5">:</span>
          <Counter value={seconds % 60} minDigits={2} fontSize="1em" duration={0.35} />
        </span>
        <button onClick={() => timers.set(id, minutes, label)} aria-label={t('timerReset')} disabled={!touched} className={`${iconBtn} twist`}>
          <Icon name="restart" size={20} />
        </button>
        <button onClick={() => (running ? timers.pause(id) : timers.start(id, label))} className={`${pill} h-10 min-w-24 px-4 text-sm`}>
          <Icon name={running ? 'pause' : 'play'} size={16} /> {running ? t('pause') : t('start')}
        </button>
      </div>
      <div className="no-scrollbar -mr-2 -ml-3.5 overflow-x-auto py-2 pr-2 pl-3.5">
        <JellyRadio
          ariaLabel={t('timerSet')}
          items={[3, 5, 10, 15, 20, 30].map((m) => ({ value: `${m}`, label: t('minutesN', { n: m }) }))}
          value={`${minutes}`}
          onChange={(v) => timers.set(id, Number(v), label)}
          size="md"
          radius={6}
          swell={0.06}
          barge={3}
          chipColor="#111111"
          activeColor="#c6f24e"
          textColor="#b4b4b4"
          activeTextColor="#0d1300"
          className="font-semibold tabular-nums"
        />
      </div>
    </section>
  )
}

/** A match's timer on its card, once it has been started: a small tag over the top edge. */
export function TimerChip({ id }: { id: string }) {
  const { running, left, touched } = useTimer(id)
  if (!touched) return null
  return (
    <span className={`rounded-md pointer-events-none absolute -top-2 right-3 z-[3] inline-flex items-center gap-1 px-1.5 py-0.5 font-sans font-semibold text-xs tabular-nums ${left === 0 ? 'blink bg-danger text-black' : running ? 'bg-primary text-on-primary' : 'bg-line text-ink'}`}>
      <Icon name={running ? 'clock' : 'pause'} size={12} /> {clock(left)}
    </span>
  )
}
