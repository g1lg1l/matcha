import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Emoji, Icon, PIXEL_SETS, rememberIcon } from './icons'
import { useLang } from './i18n'
import { field, iconBtn } from './ui'
import { EMOJIS } from './view'

// Some pictures fill less of their square than others (the racing car is long and flat):
// nudge them so the row looks even.
const scale: Record<string, number> = { '🏎️': 1.3, '🎮': 1.05 }

/**
 * A row of pictures to pick the tournament's picture. Scrolls sideways, with the edges fading out.
 * The search looks through every pixel-art icon on Iconify, so there is one for nearly any game.
 */
export function EmojiPicker({ value, onChange, label, compact }: { value: string; onChange: (e: string) => void; label: string; compact?: boolean }) {
  const { t } = useLang()
  const row = useRef<HTMLDivElement>(null)
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ for: string; icons: string[] }>({ for: '', icons: [] })
  const query = q.trim().toLowerCase()
  const asking = searching && query.length >= 2

  // start with the picked one in view
  useLayoutEffect(() => {
    const el = row.current
    const picked = el?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (el && picked) el.scrollLeft = picked.offsetLeft - el.clientWidth / 2 + picked.clientWidth / 2
    // only on mount: picking one shouldn't yank the row around
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ask Iconify a moment after the typing stops; the icon names are English
  useEffect(() => {
    if (!asking) return
    const stop = new AbortController()
    const wait = setTimeout(() => {
      fetch(`https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=48&prefixes=${PIXEL_SETS}`, { signal: stop.signal })
        .then((r) => r.json())
        .then((d: { icons?: string[] }) => setFound({ for: query, icons: (d.icons ?? []).filter((n) => !/-(sharp|solid|fill)$/.test(n)) }))
        .catch(() => {})
    }, 300)
    return () => {
      clearTimeout(wait)
      stop.abort()
    }
  }, [asking, query])

  // a picture found by search, or kept from an older version, leads the row
  const list = asking ? (found.for === query ? found.icons : []) : [...(EMOJIS.includes(value) ? [] : [value]), ...EMOJIS]
  const size = compact ? 'size-11 rounded-[8px] text-[24px]' : 'size-[52px] rounded-[8px] text-[28px]'

  return (
    <div>
      {searching && (
        <div className="pop mb-1 flex items-center gap-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchIcon')}
            aria-label={t('searchIcon')}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className={`${field} min-w-0`}
          />
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => {
              setSearching(false)
              setQ('')
            }}
            className={iconBtn}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      )}
      <div
        ref={row}
        role="radiogroup"
        aria-label={label}
        className={`no-scrollbar -mx-5 flex snap-x scroll-px-5 overflow-x-auto px-5 ${compact ? 'gap-1.5 py-1.5' : 'gap-2 py-2'}`}
        style={{ maskImage: 'linear-gradient(to right, transparent, #000 1.25rem, #000 calc(100% - 1.25rem), transparent)' }}
      >
        {!searching && (
          <button type="button" aria-label={t('searchIcons')} onClick={() => setSearching(true)} className={`twist grid shrink-0 snap-start place-items-center border-2 border-dashed border-line text-mute transition active:scale-90 ${size}`}>
            <Icon name="search" size={22} />
          </button>
        )}
        {asking && found.for === query && !list.length && <p className="py-3 text-sm text-mute">{t('noIcons')}</p>}
        {list.map((e) => {
          const on = value === e
          return (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={e}
              onClick={() => {
                onChange(e)
                void rememberIcon(e)
                setSearching(false)
                setQ('')
              }}
              className={`hoppy grid shrink-0 snap-start place-items-center transition duration-200 active:scale-90 ${size} ${
                on ? 'bg-c-mint shadow-[inset_0_0_0_2px_var(--brand)]' : `${compact ? 'bg-raised' : 'bg-sheet'} hover:-translate-y-0.5`
              }`}
            >
              <span className={`transition-[scale,opacity] duration-200 ${on ? '' : 'opacity-85'}`} style={{ scale: (scale[e] ?? 1) * (on ? 1.12 : 1) }}>
                <Emoji e={e} className="hop block" preview />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
