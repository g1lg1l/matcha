import { ArrowDown, ArrowUp, Plus, Shuffle, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { MAX_PLAYERS, shuffle, type Player } from './engine'
import { useLang } from './i18n'
import { colorOfIndex } from './view'
import { Avatar, field, ghost, iconBtn, toast } from './ui'

/** Add, remove, reorder (= seed) and rename players. With `locked`, only renaming is allowed. */
export function PlayersEditor({ players, onChange, locked = false }: { players: Player[]; onChange: (p: Player[]) => void; locked?: boolean }) {
  const { t } = useLang()
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement>(null)

  function add(text: string) {
    // a pasted list adds everyone at once
    const names = text.split(/\r?\n|,|;|\t/).map((s) => s.trim().slice(0, 40)).filter(Boolean)
    if (!names.length) return
    const taken = new Set(players.map((p) => p.name.toLowerCase()))
    const fresh: Player[] = []
    for (const name of names) {
      if (taken.has(name.toLowerCase())) {
        toast(t('duplicate', { name }))
        continue
      }
      taken.add(name.toLowerCase())
      fresh.push({ id: crypto.randomUUID().slice(0, 8), name })
    }
    const next = [...players, ...fresh]
    if (next.length > MAX_PLAYERS) toast(t('tooMany', { n: MAX_PLAYERS }))
    onChange(next.slice(0, MAX_PLAYERS))
    setDraft('')
  }

  const move = (i: number, d: number) => {
    const next = [...players]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }

  const rename = (i: number, name: string) => {
    const clean = name.trim().slice(0, 40)
    if (!clean || players.some((p, j) => j !== i && p.name.toLowerCase() === clean.toLowerCase())) return false
    onChange(players.map((p, j) => (j === i ? { ...p, name: clean } : p)))
    return true
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {!locked && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add(draft)
            input.current?.focus()
          }}
          className="flex gap-2"
        >
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              if (/[\n,;\t]/.test(text)) {
                e.preventDefault()
                add(text)
              }
            }}
            placeholder={t('addPlayer')}
            aria-label={t('addPlayer')}
            maxLength={400}
            enterKeyHint="done"
            className={`${field} min-w-0`}
          />
          <button aria-label={t('add')} disabled={!draft.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary transition active:scale-90 disabled:opacity-40">
            <Plus size={20} />
          </button>
        </form>
      )}
      <div className="flex items-center gap-2 text-sm text-mute">
        <span className="flex-1">{locked ? t('playersLocked') : players.length > 1 ? t('seedHint') : t('addPlayerHint')}</span>
        {!locked && players.length > 2 && (
          <button type="button" onClick={() => onChange(shuffle(players))} className={`${ghost} -mr-3`}>
            <Shuffle size={16} aria-hidden /> {t('shuffle')}
          </button>
        )}
      </div>
      {players.length > 0 && (
        <ol className="grid grid-cols-1 gap-1.5">
          {players.map((p, i) => (
            <li key={p.id} className="pop flex items-center gap-2 rounded-2xl border border-line bg-sheet py-1.5 pr-1.5 pl-2.5">
              <span className="w-6 text-center text-xs font-semibold text-mute tabular-nums">{i + 1}</span>
              <Avatar name={p.name} color={colorOfIndex(i)} />
              <input
                key={p.name}
                defaultValue={p.name}
                aria-label={p.name}
                maxLength={40}
                onBlur={(e) => {
                  if (e.target.value.trim() !== p.name && !rename(i, e.target.value)) e.target.value = p.name
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 font-medium focus:bg-raised focus:outline-none"
              />
              {!locked && (
                <>
                  <button type="button" aria-label={t('moveUp')} disabled={i === 0} onClick={() => move(i, -1)} className={iconBtn}>
                    <ArrowUp size={17} />
                  </button>
                  <button type="button" aria-label={t('moveDown')} disabled={i === players.length - 1} onClick={() => move(i, 1)} className={iconBtn}>
                    <ArrowDown size={17} />
                  </button>
                  <button type="button" aria-label={`${t('remove')} ${p.name}`} onClick={() => onChange(players.filter((x) => x.id !== p.id))} className={iconBtn}>
                    <X size={17} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
