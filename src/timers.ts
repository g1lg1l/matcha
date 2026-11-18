// One countdown per match or table, next to the general one (RoundTimer). They live in this module, not in a
// component, so a timer keeps running and still rings after its sheet is closed or another tab is shown.
// shortcut: on this device only, like the general timer; put them in the tournament document when viewers need them.
import { useSyncExternalStore } from 'react'
import { t } from './i18n'
import { haptic, toast } from './ui'

export interface Timer {
  minutes: number
  /** when it runs out, or null while it stands still */
  endsAt: number | null
  /** milliseconds left while it stands still */
  left: number
  /** what to call it when it rings: "Ann – Bob", "Table 2" */
  label: string
}

const KEY = 'matcha:timers'
const MINUTE = 60_000
let all: Record<string, Timer> = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
})()
let version = 0
// the time as of the last tick or change: what a render reads, so that rendering stays pure
let now = Date.now()
let ticker = 0
let audio: AudioContext | null = null
const listeners = new Set<() => void>()

function put(next: Record<string, Timer>) {
  all = next
  now = Date.now()
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* fine, just not remembered */
  }
  wake()
  version++
  listeners.forEach((l) => l())
}

/** Call from a tap: that is what lets the phone play the beep later. */
export function unlockSound() {
  audio ??= new AudioContext()
  audio.resume().catch(() => {})
}

/** Time is up: a toast, three buzzes and three short beeps. */
export function ring(label = '') {
  toast(`${t('timeUp')} ${label}`.trim())
  ;[0, 250, 500].forEach((at) => setTimeout(haptic, at))
  if (!audio) return
  for (const at of [0, 0.25, 0.5]) {
    const tone = audio.createOscillator()
    const volume = audio.createGain()
    tone.type = 'square'
    tone.frequency.value = 880
    volume.gain.value = 0.08
    tone.connect(volume).connect(audio.destination)
    tone.start(audio.currentTime + at)
    tone.stop(audio.currentTime + at + 0.15)
  }
}

// one clock for all of them, running only while one of them does
function tick() {
  now = Date.now()
  const over = Object.entries(all).filter(([, s]) => s.endsAt !== null && now >= s.endsAt)
  if (over.length) {
    put({ ...all, ...Object.fromEntries(over.map(([k, s]) => [k, { ...s, endsAt: null, left: 0 }])) })
    over.forEach(([, s]) => ring(s.label))
  } else {
    version++
    listeners.forEach((l) => l())
  }
}
function wake() {
  const running = Object.values(all).some((s) => s.endsAt !== null)
  if (running && !ticker) ticker = window.setInterval(tick, 500)
  if (!running && ticker) {
    clearInterval(ticker)
    ticker = 0
  }
}
wake() // a timer left running before a reload picks up where it was

/** The minutes a new timer starts with: whatever the last one was set to. */
const usual = () => Object.values(all).at(-1)?.minutes ?? 10

export const timers = {
  /** Starts it, or carries on from where it was paused. Call from a tap: that is what lets the phone play the beep. */
  start(key: string, label: string) {
    unlockSound()
    const s = all[key] ?? { minutes: usual(), endsAt: null, left: usual() * MINUTE, label }
    const from = s.left || s.minutes * MINUTE
    put({ ...all, [key]: { ...s, label, endsAt: Date.now() + from, left: from } })
  },
  pause(key: string) {
    const s = all[key]
    if (s?.endsAt) put({ ...all, [key]: { ...s, endsAt: null, left: Math.max(0, s.endsAt - Date.now()) } })
  },
  /** Back to the full time, standing still. */
  set(key: string, minutes: number, label: string) {
    put({ ...all, [key]: { minutes, endsAt: null, left: minutes * MINUTE, label } })
  },
  /** The tournament is gone: so are all its timers, the general one included. */
  forgetAll(tournament: string) {
    try {
      localStorage.removeItem(`matcha:timer:${tournament}`)
    } catch {
      /* nothing to remove */
    }
    const rest = Object.fromEntries(Object.entries(all).filter(([key]) => !key.startsWith(`${tournament}:`)))
    if (Object.keys(rest).length !== Object.keys(all).length) put(rest)
  },
  /** The match is over: its timer goes with it. */
  forget(key: string) {
    if (!all[key]) return
    const rest = { ...all }
    Reflect.deleteProperty(rest, key)
    put(rest)
  },
}

/** The timer under `key` as it is right now; re-renders twice a second while it runs. */
export function useTimer(key: string) {
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
  )
  const s = all[key] as Timer | undefined
  const minutes = s?.minutes ?? usual()
  const running = !!s && s.endsAt !== null
  const left = s ? Math.max(0, running ? s.endsAt! - now : s.left) : minutes * MINUTE
  return { exists: !!s, minutes, running, left, touched: !!s && (running || left < minutes * MINUTE) }
}
