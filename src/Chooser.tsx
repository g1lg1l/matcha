// Who starts? Everyone holds a finger on the screen; once the same fingers have stayed for a moment, one is picked.
// shortcut: touch only, a mouse is a single pointer and never gets a pick; add a tap-to-place mode if the web needs it.
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Icon } from './icons'
import { useLang } from './i18n'
import { go } from './router'
import { haptic, iconBtn } from './ui'
import { colorOfIndex } from './view'

type Finger = { x: number; y: number; color: number }
type Fingers = Record<number, Finger>

const HOLD = 2000
const only = (f: Fingers, keep: (id: number) => boolean): Fingers => Object.fromEntries(Object.entries(f).filter(([id]) => keep(Number(id))))

export function Chooser() {
  const { t } = useLang()
  const [fingers, setFingers] = useState<Fingers>({})
  const [winner, setWinner] = useState<number>()
  // the fingers really on the glass: after a pick the screen freezes, so `fingers` no longer says
  const held = useRef(new Set<number>())
  const ids = Object.keys(fingers).join()

  // who is touching restarts the wait, where they touch does not
  useEffect(() => {
    if (winner !== undefined || !ids.includes(',')) return
    const timer = setTimeout(() => {
      const all = ids.split(',').map(Number)
      setWinner(all[Math.floor(Math.random() * all.length)])
      ;[0, 150, 300].forEach((at) => setTimeout(haptic, at))
    }, HOLD)
    return () => clearTimeout(timer)
  }, [ids, winner])

  const down = (e: PointerEvent) => {
    const { pointerId: id, clientX: x, clientY: y } = e
    held.current.add(id)
    haptic()
    setFingers((f) => {
      // a touch after a pick starts a new round, with whoever is still holding
      const kept = winner === undefined ? f : only(f, (k) => held.current.has(k))
      const used = new Set(Object.values(kept).map((k) => k.color))
      let color = 0
      while (used.has(color)) color++
      return { ...kept, [id]: { x, y, color } }
    })
    setWinner(undefined)
  }
  const move = (e: PointerEvent) => {
    const { pointerId: id, clientX: x, clientY: y } = e
    setFingers((f) => (f[id] ? { ...f, [id]: { ...f[id], x, y } } : f))
  }
  const up = (e: PointerEvent) => {
    const id = e.pointerId
    held.current.delete(id)
    // the pick stays on screen after the fingers lift
    if (winner === undefined) setFingers((f) => only(f, (k) => k !== id))
  }

  const won = winner === undefined ? undefined : fingers[winner]
  return (
    <main
      className="fixed inset-0 touch-none overflow-hidden transition-colors duration-300 select-none [-webkit-touch-callout:none]"
      style={{ background: won && colorOfIndex(won.color) }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="absolute top-[max(1.25rem,calc(env(safe-area-inset-top)_+_0.5rem))] left-3 z-10 flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => (history.length > 1 ? history.back() : go({ page: 'home' }))} aria-label={t('back')} className={iconBtn}>
          <Icon name="back" size={22} />
        </button>
        <h1 className="font-display text-xl font-bold">{t('whoStarts')}</h1>
      </header>
      {!ids && <p className="pointer-events-none absolute inset-0 grid place-items-center px-10 text-center text-[17px] leading-relaxed text-mute">{t('whoStartsHint')}</p>}
      {Object.entries(fingers).map(([id, f]) => {
        const picked = Number(id) === winner
        if (winner !== undefined && !picked) return null
        const color = colorOfIndex(f.color)
        return (
          <div key={id} className="pointer-events-none absolute size-28 -translate-1/2" style={{ left: f.x, top: f.y }}>
            {!picked && <span className="absolute inset-0 animate-ping motion-reduce:hidden" style={{ background: color }} />}
            <span className={`pixel relative grid size-full place-items-center text-black transition-transform ${picked ? 'scale-125' : ''}`} style={{ background: picked ? '#fff' : color }}>
              {picked && <Icon name="crown" size={48} />}
            </span>
          </div>
        )
      })}
      <p className="sr-only" aria-live="polite">
        {won && t('whoStartsPicked')}
      </p>
    </main>
  )
}
