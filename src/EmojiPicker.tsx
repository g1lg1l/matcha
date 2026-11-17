import { useLayoutEffect, useRef } from 'react'
import { Emoji } from './icons'
import { EMOJIS } from './view'

// Some pictures fill less of their square than others (the racing car is long and flat):
// nudge them so the row looks even.
const scale: Record<string, number> = { '🏎️': 1.3, '⛳': 1.1, '🎮': 1.05 }

/** A row of pictures to pick the tournament's emoji. Scrolls sideways, with the edges fading out. */
export function EmojiPicker({ value, onChange, label, compact }: { value: string; onChange: (e: string) => void; label: string; compact?: boolean }) {
  const row = useRef<HTMLDivElement>(null)

  // start with the picked one in view
  useLayoutEffect(() => {
    const el = row.current
    const picked = el?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (el && picked) el.scrollLeft = picked.offsetLeft - el.clientWidth / 2 + picked.clientWidth / 2
    // only on mount: picking one shouldn't yank the row around
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={row}
      role="radiogroup"
      aria-label={label}
      className={`no-scrollbar -mx-5 flex snap-x scroll-px-5 overflow-x-auto px-5 ${compact ? 'gap-1.5 py-1.5' : 'gap-2 py-2'}`}
      style={{ maskImage: 'linear-gradient(to right, transparent, #000 1.25rem, #000 calc(100% - 1.25rem), transparent)' }}
    >
      {EMOJIS.map((e) => {
        const on = value === e
        return (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={e}
            onClick={() => onChange(e)}
            className={`hoppy grid shrink-0 snap-start place-items-center transition duration-200 active:scale-90 ${
              compact ? 'size-11 rounded-[14px] text-[24px]' : 'size-[52px] rounded-[18px] text-[28px]'
            } ${on ? 'bg-c-mint shadow-[inset_0_0_0_2px_var(--brand)]' : `${compact ? 'bg-raised' : 'bg-sheet'} shadow-[inset_0_-2px_0_var(--line)] hover:-translate-y-0.5`}`}
          >
            <span className={`transition-[scale,opacity] duration-200 ${on ? '' : 'opacity-85'}`} style={{ scale: (scale[e] ?? 1) * (on ? 1.12 : 1) }}>
              <Emoji e={e} className="hop block" />
            </span>
          </button>
        )
      })}
    </div>
  )
}
