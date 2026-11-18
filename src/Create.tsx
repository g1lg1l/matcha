import { EmojiPicker } from './EmojiPicker'
import { Emoji, Icon } from './icons'
import { useState, type ReactNode } from 'react'
import Stepper, { Step } from './bits/Stepper'
import { build, MIN_PLAYERS, type Format, type Options, type Player, type Tournament } from './engine'
import { useLang } from './i18n'
import { createOnline, errorText } from './online'
import { PlayersEditor } from './Players'
import { PartyEditor, PointsEditor } from './Scoring'
import { go } from './router'
import { rememberOnline, saveLocal } from './store'
import { btn, field, iconBtn, outline, shake, Toggle, warn } from './ui'
import { formatEmoji, newTournament } from './view'

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
  // a draft that is already whole (a rematch, a reload at the end) opens on the last step
  const [step, setStep] = useState(() => (d.name.trim() && d.players.length >= MIN_PLAYERS ? 4 : 1))
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
    const stuck = missing(5)
    if (stuck) return complain(stuck)
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
      warn(errorText(e))
      setBusy(false)
    }
  }

  // one thing at a time: name, format, players, where. A step with something missing doesn't let you past it.
  const complain = (at: number) => {
    const [message, id] = at === 1 ? [t('needName'), 't-name'] : [t(d.format === 'rotating' ? 'rotatingNeeds' : 'tooFew'), 't-players']
    setStep(at)
    // the step has to be on screen before its field can shake
    setTimeout(() => {
      const el = document.getElementById(id)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      shake(el)
      if (at === 1) el?.focus({ preventScroll: true })
    }, at === step ? 0 : 350)
    warn(message)
  }
  const missing = (upTo: number) => (upTo > 1 && !d.name.trim() ? 1 : upTo > 3 && d.players.length < (d.format === 'rotating' ? 4 : MIN_PLAYERS) ? 3 : 0)
  // rotating partners: how many matches come out, and whether every pair gets to play together
  const pairsPlan = (() => {
    const n = d.players.length
    if (d.format !== 'rotating' || n < 4) return ''
    const matches = build({ format: d.format, players: d.players, options: {}, results: {} }).matches.length
    return t(matches * 2 === (n * (n - 1)) / 2 ? 'rotatingPlan' : 'rotatingOdd', { n: matches })
  })()
  const goStep = (next: number) => {
    const stuck = next > step ? missing(next) : 0
    if (stuck) return complain(stuck)
    setStep(next)
    scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="fade-in mx-auto max-w-xl px-5 pt-[max(1.25rem,calc(env(safe-area-inset-top)_+_0.5rem))]">
      <header className="-ml-2 flex items-center gap-1">
        <a href="#/" aria-label={t('back')} className={iconBtn}>
          <Icon name="back" size={22} />
        </a>
        <h1 className="font-display text-xl font-bold">{t('newTournament')}</h1>
      </header>

      <Stepper
        step={step}
        onStepChange={goStep}
        showFooter={false}
        frame={false}
        width="100%"
        accentColor="#c6f24e"
        className="mt-4"
        contentClassName="pt-5"
      >
        <Step title={t('name')}>
          <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-mute">
            <Icon name="edit" size={16} /> {t('name')}
          </h2>
          <input
            id="t-name"
            value={d.name}
            onChange={(e) => update({ name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && goStep(2)}
            required
            maxLength={60}
            enterKeyHint="next"
            placeholder={t('namePlaceholder')}
            className={`${field} font-display text-lg font-semibold`}
          />
          <div className="mt-1.5">
            <EmojiPicker value={d.emoji} onChange={(emoji) => update({ emoji })} label={t('emoji')} />
          </div>
        </Step>

        <Step title={t('format')}>
          <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-mute">
            <Icon name="gamepad" size={16} /> {t('format')}
          </h2>
          <div className="grid gap-2">
            {(['single', 'double', 'roundrobin', 'rotating', 'party'] as const).map((f) => (
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
          <div key={d.format} className={`pop mt-4 grid grid-cols-1 gap-6 rounded-2xl bg-sheet p-4`}>
            {d.format === 'single' && <Toggle label={t('thirdPlace')} hint={t('thirdPlaceHint')} checked={!!d.options.thirdPlace} onChange={(v) => opt({ thirdPlace: v })} />}
            {d.format === 'double' && <Toggle label={t('bracketReset')} hint={t('bracketResetHint')} checked={!!d.options.bracketReset} onChange={(v) => opt({ bracketReset: v })} />}
            {d.format === 'roundrobin' && (
              <>
                <Toggle label={t('legs')} hint={t('legsHint')} checked={d.options.legs === 2} onChange={(v) => opt({ legs: v ? 2 : 1 })} />
                <PointsEditor value={d.options.points} onChange={(points) => opt({ points })} />
              </>
            )}
            {d.format === 'rotating' && <p className="text-sm text-mute">{t('rotatingRules')}</p>}
            {d.format === 'party' && <PartyEditor value={d.options.party} onChange={(party) => opt({ party })} />}
          </div>
        </Step>

        <Step title={t('players')}>
          <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-mute">
            <Icon name="users" size={16} /> {`${t('players')}${d.players.length ? ` · ${d.players.length}` : ''}`}
          </h2>
          {pairsPlan && <p className="mb-3 rounded-xl bg-well px-3.5 py-2.5 text-sm text-mute">{pairsPlan}</p>}
          <div id="t-players">
            <PlayersEditor players={d.players} onChange={(players) => update({ players })} />
          </div>
        </Step>

        <Step title={t('where')}>
          <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-mute">
            <Icon name="cloud" size={16} /> {t('where')}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Choice active={d.where === 'local'} onClick={() => update({ where: 'local' })} icon={<Emoji e="📱" className="hop text-[28px]" />} title={t('local')} hint={t('localHint')} />
            <Choice active={d.where === 'online'} onClick={() => update({ where: 'online' })} icon={<Emoji e="☁️" className="hop text-[28px]" />} title={t('online')} hint={t('onlineHint')} />
          </div>
          {/* what is about to be made, with a way back to each part */}
          <h2 className="mt-7 mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-mute">
            <Icon name="check" size={16} /> {t('ready')}
          </h2>
          <div className="flex items-center gap-4 rounded-2xl bg-sheet p-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-c-sky text-[28px]">
              <Emoji e={d.emoji} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[16px]">{d.name.trim()}</span>
              <span className="dots block text-sm text-mute">
                <span>
                  <span className="inline-flex items-center gap-1">
                    <Emoji e={formatEmoji[d.format]} /> {t(d.format)}
                  </span>
                  <span>{t('playersCount', { n: d.players.length })}</span>
                </span>
              </span>
            </span>
          </div>
        </Step>
      </Stepper>

      {/* always under the thumb, whatever the step's length */}
      <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 bg-paper px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {step > 1 && (
          <button onClick={() => goStep(step - 1)} className={`${outline} h-13`}>
            <Icon name="back" size={18} /> {t('back')}
          </button>
        )}
        {step < 4 ? (
          <button onClick={() => goStep(step + 1)} className={`${btn} h-13 flex-1 text-[17px]`}>
            {t('next')} <Icon name="go" size={20} />
          </button>
        ) : (
          <button onClick={submit} disabled={busy} className={`${btn} h-13 flex-1 text-[17px]`}>
            {busy ? (
              t('creating')
            ) : (
              <>
                <Emoji e={d.emoji} className="text-[22px]" /> {t('create')}
              </>
            )}
          </button>
        )}
      </div>
    </main>
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
