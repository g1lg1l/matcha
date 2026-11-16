import { Capacitor } from '@capacitor/core'
import { ChevronRight, Crown, Plus, Share } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Tournament } from './engine'
import { setLang, useLang } from './i18n'
import { parseCode } from './online'
import { go } from './router'
import { useStore, type Role } from './store'
import { RoleBadge } from './TournamentPage'
import { field, Logo, outline, pill, Segmented, toast } from './ui'
import { formatEmoji, summary } from './view'

type Entry = { key: string; href: string; t: Tournament; online?: Role }

export function Home() {
  const { t, lang } = useLang()
  const { local, online } = useStore()
  const entries: Entry[] = [
    ...local.map((x) => ({ key: x.id, href: `#/t/${x.id}`, t: x })),
    ...online.map((r) => ({ key: r.code, href: `#/s/${r.code}`, t: r.t, online: r.role })),
  ].sort((a, b) => b.t.updatedAt.localeCompare(a.t.updatedAt))

  return (
    <main className="mx-auto max-w-xl px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-16">
      <header className="flex items-center gap-3">
        <Logo className="size-11" />
        <h1 className="font-display text-[28px] font-bold tracking-tight">matcha</h1>
        <div className="ml-auto">
          <Segmented
            label={t('language')}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'it', label: 'IT' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </div>
      </header>
      <p className="mt-5 max-w-[36ch] text-[17px] leading-relaxed text-mute">{t('tagline')}</p>

      <a href="#/new" className={`${pill} mt-8 h-14 w-full text-[17px]`}>
        <Plus size={22} aria-hidden /> {entries.length ? t('newTournament') : t('firstTournament')}
      </a>

      {entries.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-mute">{t('yourTournaments')}</h2>
          <ul className="mt-3 grid gap-2">
            {entries.map((e) => (
              <li key={e.key}>
                <Card entry={e} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <OpenLink />
      <InstallCard />
    </main>
  )
}

const phaseTint = { new: 'bg-c-sky', live: 'bg-c-peach', done: 'bg-c-lemon' }

function Card({ entry }: { entry: Entry }) {
  const { t } = useLang()
  const { phase, champion, progress } = summary(entry.t)
  return (
    <a href={entry.href} className="flex items-center gap-4 rounded-2xl border border-line bg-sheet p-3.5 transition-colors hover:border-brand">
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-2xl ${phaseTint[phase]}`}>{entry.t.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[16px] font-semibold">{entry.t.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-mute">
          <span>
            {formatEmoji[entry.t.format]} {t(entry.t.format)}
          </span>
          <span aria-hidden>·</span>
          {phase === 'done' ? (
            <span className="inline-flex min-w-0 items-center gap-1 font-medium text-ink">
              <Crown size={14} className="text-gold" aria-hidden /> <span className="truncate">{champion}</span>
            </span>
          ) : (
            <span>{phase === 'live' ? t('inProgress') : t('playersCount', { n: entry.t.players.length })}</span>
          )}
          {entry.online && (
            <RoleBadge role={entry.online} />
          )}
        </span>
        {phase === 'live' && (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-well" aria-hidden>
            <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
          </span>
        )}
      </span>
      <ChevronRight size={20} className="shrink-0 text-mute" aria-hidden />
    </a>
  )
}

function OpenLink() {
  const { t } = useLang()
  const [value, setValue] = useState('')
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold text-mute">{t('openLink')}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const link = parseCode(value)
          if (!link) return toast(t('badLink'))
          go({ page: 'online', ...link })
        }}
        className="mt-3 flex gap-2"
      >
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('openLinkHint')} aria-label={t('openLinkHint')} autoCapitalize="off" autoCorrect="off" spellCheck={false} className={`${field} min-w-0`} />
        <button disabled={!value.trim()} className={`${outline} shrink-0`}>
          {t('open')}
        </button>
      </form>
    </section>
  )
}

// Installable PWA on the web; the native apps don't need this.
type InstallPrompt = Event & { prompt: () => Promise<void> }
let installPrompt: InstallPrompt | null = null
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  installPrompt = e as InstallPrompt
  dispatchEvent(new Event('installable'))
})

function InstallCard() {
  const { t } = useLang()
  const [prompt, setPrompt] = useState(installPrompt)
  useEffect(() => {
    const ready = () => setPrompt(installPrompt)
    addEventListener('installable', ready)
    return () => removeEventListener('installable', ready)
  }, [])
  const installed = Capacitor.isNativePlatform() || matchMedia('(display-mode: standalone)').matches || 'standalone' in navigator
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  if (installed || (!prompt && !ios)) return null
  const [before, after] = t('installIos').split('{share}')

  return (
    <section className="mt-10 flex items-center gap-4 rounded-2xl border-2 border-dashed border-line p-4">
      <img src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" className="size-12 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t('installTitle')}</p>
        <p className="mt-0.5 text-sm text-mute">
          {prompt ? (
            t('installHint')
          ) : (
            <>
              {before}
              <Share size={14} className="inline align-[-2px]" aria-label="Share" />
              {after}
            </>
          )}
        </p>
      </div>
      {prompt && (
        <button
          onClick={async () => {
            await prompt.prompt()
            installPrompt = null
            setPrompt(null)
          }}
          className={`${pill} h-9 px-4 text-sm`}
        >
          {t('install')}
        </button>
      )}
    </section>
  )
}
