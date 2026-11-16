import { Emoji, Icon } from './icons'
import { useState, type ReactNode } from 'react'
import { MIN_PLAYERS, type Format, type Options, type Player, type Tournament } from './engine'
import { useLang } from './i18n'
import { createOnline, errorText } from './online'
import { PlayersEditor } from './Players'
import { PartyEditor, PointsEditor } from './Scoring'
import { go } from './router'
import { rememberOnline, saveLocal } from './store'
import { btn, field, iconBtn, toast, Toggle } from './ui'
import { EMOJIS, formatEmoji, newTournament } from './view'

const DRAFT = 'matcha:draft'
type Draft = { name: string; emoji: string; format: Format; options: Options; players: Player[]; where: 'local' | 'online' }

function loadDraft(): Draft {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT) ?? '')
    if (d && Array.isArray(d.players)) return d
  } catch {
    /* nothing saved */
  }
  return { name: '', emoji: '🏆', format: 'single', options: { thirdPlace: false, bracketReset: true, legs: 1 }, players: [], where: 'local' }
}

/** Opens the new-tournament form prefilled from another tournament: same players, same rules. */
export function duplicate(t: Tournament) {
  const d: Draft = { name: t.name, emoji: t.emoji, format: t.format, options: t.options, players: t.players, where: 'local' }
  try {
    sessionStorage.setItem(DRAFT, JSON.stringify(d))
  } catch {
    /* fine: the form just starts empty */
  }
}

export function Create() {
  const { t } = useLang()
  const [d, setD] = useState(loadDraft)
  const [busy, setBusy] = useState(false)
  const update = (patch: Partial<Draft>) =>
    setD((prev) => {
      const next = { ...prev, ...patch }
      try {
        sessionStorage.setItem(DRAFT, JSON.stringify(next)) // survives a reload or an accidental back
      } catch {
        /* fine */
      }
      return next
    })
  const opt = (patch: Options) => update({ options: { ...d.options, ...patch } })

  async function submit() {
    if (!d.name.trim()) return document.getElementById('t-name')?.focus()
    if (d.players.length < MIN_PLAYERS) return toast(t('tooFew'))
    const tour = newTournament({ name: d.name.trim(), emoji: d.emoji, format: d.format, players: d.players, options: d.options })
    if (d.where === 'local') {
      saveLocal(tour)
      sessionStorage.removeItem(DRAFT)
      return go({ page: 'local', id: tour.id }, true)
    }
    setBusy(true)
    try {
      const row = await createOnline(tour)
      rememberOnline({ code: row.share_code, role: 'owner', t: row.data })
      sessionStorage.removeItem(DRAFT)
      go({ page: 'online', code: row.share_code }, true)
    } catch (e) {
      toast(errorText(e))
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-xl px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="-ml-2 flex items-center gap-1">
        <a href="#/" aria-label={t('back')} className={iconBtn}>
          <Icon name="back" size={22} />
        </a>
        <h1 className="font-display text-xl font-bold">{t('newTournament')}</h1>
      </header>

      <Section title={t('name')}>
        <input
          id="t-name"
          value={d.name}
          onChange={(e) => update({ name: e.target.value })}
          required
          maxLength={60}
          placeholder={t('namePlaceholder')}
          className={`${field} font-display text-lg font-semibold`}
        />
        <div className="no-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => update({ emoji: e })}
              aria-pressed={d.emoji === e}
              className={`hoppy grid size-11 shrink-0 place-items-center rounded-2xl text-[24px] transition active:scale-90 ${
                d.emoji === e ? 'bg-c-mint ring-2 ring-brand' : 'bg-sheet hover:bg-raised'
              }`}
            >
              <Emoji e={e} className="hop" label={e} />
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('format')}>
        <div className="grid gap-2">
          {(['single', 'double', 'roundrobin', 'party'] as const).map((f) => (
            <button
              key={f}
              onClick={() => update({ format: f })}
              aria-pressed={d.format === f}
              className={`hoppy flex items-center gap-3.5 rounded-2xl border-2 p-3.5 text-left transition active:scale-[0.98] ${
                d.format === f ? 'border-brand bg-c-mint' : 'border-transparent bg-sheet hover:border-line'
              }`}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-raised text-[28px]">
                <Emoji e={formatEmoji[f]} className="hop" />
              </span>
              <span>
                <span className="block font-display font-semibold">{t(f)}</span>
                <span className="block text-sm text-mute">{t(`${f}Hint`)}</span>
              </span>
            </button>
          ))}
        </div>
        <div key={d.format} className="pop mt-4 grid grid-cols-1 gap-6 rounded-2xl bg-sheet p-4">
          {d.format === 'single' && <Toggle label={t('thirdPlace')} hint={t('thirdPlaceHint')} checked={!!d.options.thirdPlace} onChange={(v) => opt({ thirdPlace: v })} />}
          {d.format === 'double' && <Toggle label={t('bracketReset')} hint={t('bracketResetHint')} checked={!!d.options.bracketReset} onChange={(v) => opt({ bracketReset: v })} />}
          {d.format === 'roundrobin' && (
            <>
              <Toggle label={t('legs')} hint={t('legsHint')} checked={d.options.legs === 2} onChange={(v) => opt({ legs: v ? 2 : 1 })} />
              <PointsEditor value={d.options.points} onChange={(points) => opt({ points })} />
            </>
          )}
          {d.format === 'party' && <PartyEditor value={d.options.party} onChange={(party) => opt({ party })} />}
        </div>
      </Section>

      <Section title={`${t('players')}${d.players.length ? ` · ${d.players.length}` : ''}`}>
        <PlayersEditor players={d.players} onChange={(players) => update({ players })} />
      </Section>

      <Section title={t('where')}>
        <div className="grid grid-cols-2 gap-2">
          <Choice active={d.where === 'local'} onClick={() => update({ where: 'local' })} icon={<Emoji e="📱" className="hop text-[28px]" />} title={t('local')} hint={t('localHint')} />
          <Choice active={d.where === 'online'} onClick={() => update({ where: 'online' })} icon={<Emoji e="☁️" className="hop text-[28px]" />} title={t('online')} hint={t('onlineHint')} />
        </div>
      </Section>

      <button onClick={submit} disabled={busy} className={`${btn} mt-8 h-13 w-full text-[17px]`}>
        {busy ? t('creating') : (
          <>
            <Emoji e={d.emoji} className="text-[22px]" /> {t('create')}
          </>
        )}
      </button>
    </main>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2.5 text-sm font-semibold text-mute">{title}</h2>
      {children}
    </section>
  )
}

function Choice({ active, onClick, icon, title, hint }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; hint: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`hoppy grid content-start gap-1 rounded-2xl border-2 p-3.5 text-left transition active:scale-[0.98] ${active ? 'border-brand bg-c-mint' : 'border-transparent bg-sheet hover:border-line'}`}
    >
      <span className="text-brand">{icon}</span>
      <span className="font-semibold">{title}</span>
      <span className="text-sm leading-snug text-mute">{hint}</span>
    </button>
  )
}
