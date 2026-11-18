import { Capacitor } from '@capacitor/core'
import { Emoji, Icon } from './icons'
import { useEffect, useRef, useState } from 'react'
import LogoLoop from './bits/LogoLoop'
import PixelCard from './bits/PixelCard'
import RotatingText from './bits/RotatingText'
import SwipeRow from './bits/SwipeRow'
import type { Tournament } from './engine'
import { useLang } from './i18n'
import { parseCode } from './online'
import { go } from './router'
import { removeLocal, saveLocal, useStore, type Role } from './store'
import { timers } from './timers'
import { RoleBadge } from './TournamentPage'
import { field, iconBtn, Logo, outline, pill, Scramble, toast, warn } from './ui'
import { EMOJIS, formatEmoji, newTournament, summary } from './view'

type Entry = { key: string; href: string; t: Tournament; online?: Role }

export function Home() {
  const { t, lang } = useLang()
  const { local, online } = useStore()
  const entries: Entry[] = [
    ...local.map((x) => ({ key: x.id, href: `#/t/${x.id}`, t: x })),
    ...online.map((r) => ({ key: r.code, href: `#/s/${r.code}`, t: r.t, online: r.role })),
  ].sort((a, b) => b.t.updatedAt.localeCompare(a.t.updatedAt))

  return (
    <main className="fade-in mx-auto max-w-xl px-5 pt-[max(2.5rem,calc(env(safe-area-inset-top)_+_1rem))] pb-16">
      <header className="flex items-center gap-3">
        <Logo className="size-11" />
        <h1 className="font-display text-[28px] font-bold tracking-tight"><Scramble text="matcha" once /></h1>
        <a href="#/settings" aria-label={t('settings')} className={`${iconBtn} twist -mr-2 ml-auto`}>
          <Icon name="settings" size={22} />
        </a>
      </header>
      <p className="mt-5 max-w-[36ch] text-[17px] leading-relaxed text-mute">{t('tagline')}</p>
      <RotatingText
        key={lang}
        texts={[t('single'), t('double'), t('roundrobin'), t('rotating'), t('party'), t('counter')]}
        rotationInterval={2600}
        staggerDuration={0.02}
        mainClassName="mt-3 overflow-hidden font-display text-xl text-brand"
        splitLevelClassName="overflow-hidden"
      />
      {!entries.length && <Toys />}

      {/* two ways in: a tournament to set up, or just a scoreboard, open at once with two players to rename */}
      <div className="mt-8 grid grid-cols-2 gap-2">
        <a href="#/new" className={`${pill} ${entries.length ? '' : 'shine'} h-14 text-[15px]`}>
          <Icon name="add" size={20} /> {t('newTournament')}
        </a>
        <button
          onClick={() => {
            const board = newTournament({ name: t('counter'), emoji: '📈', format: 'counter', options: {}, players: [1, 2].map((n) => ({ id: crypto.randomUUID().slice(0, 8), name: t('playerN', { n }) })) })
            saveLocal(board)
            go({ page: 'local', id: board.id })
          }}
          className={`${outline} h-14 text-[15px]`}
        >
          <Emoji e="📈" className="text-[20px]" /> {t('counter')}
        </button>
      </div>

      {entries.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-mute">
            <Icon name="trophy" size={16} /> {t('yourTournaments')}
          </h2>
          <ul className="stagger mt-3 grid gap-2">
            {entries.map((e) => (
              <li key={e.key}>
                {e.online ? <Card entry={e} /> : <SwipeCard entry={e} />}
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

// A tournament kept on this device swipes away to delete (React Bits SwipeRow); the toast brings it back.
function SwipeCard({ entry }: { entry: Entry }) {
  const { t } = useLang()
  const inner = useRef<HTMLDivElement>(null)
  const downX = useRef(0)
  const [height, setHeight] = useState(78)
  useEffect(() => {
    const el = inner.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const remove = () => {
    removeLocal(entry.t.id)
    timers.forgetAll(entry.t.id)
    toast(t(entry.t.format === 'counter' ? 'boardDeleted' : 'deleted'), { label: t('undo'), run: () => saveLocal(entry.t) })
  }
  return (
    <SwipeRow
      label={entry.t.name}
      height={height}
      radius={8}
      rowColor="#111111"
      drawerColor="#1d1d1d"
      actionColor="#ff6b5e"
      actions={[{ id: 'delete', label: t('swipeDelete'), dismiss: true }]}
      onCommit={remove}
      onAction={remove}
    >
      {/* with a mouse, letting go after a swipe is also a click on the card: don't follow the link then */}
      <div
        ref={inner}
        className="w-full"
        onPointerDown={(e) => (downX.current = e.clientX)}
        onClickCapture={(e) => Math.abs(e.clientX - downX.current) > 10 && e.preventDefault()}
      >
        <Card entry={entry} />
      </div>
    </SwipeRow>
  )
}

const phaseTint = { new: 'bg-c-sky', live: 'bg-c-peach', done: 'bg-c-lemon' }

function Card({ entry }: { entry: Entry }) {
  const { t } = useLang()
  const { phase, champion, progress } = summary(entry.t)
  return (
    <a href={entry.href} draggable={false} className="hoppy flex items-center gap-4 rounded-2xl border border-line bg-sheet p-3.5 transition hover:border-brand active:scale-[0.98]">
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-[28px] ${phaseTint[phase]}`}>
        <Emoji e={entry.t.emoji} className="hop" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[16px] font-semibold">{entry.t.name}</span>
        <span className="dots mt-0.5 block text-sm text-mute">
          <span>
            <span className="inline-flex items-center gap-1">
              <Emoji e={formatEmoji[entry.t.format]} /> {t(entry.t.format)}
            </span>
            {phase === 'done' ? (
              <span className="inline-flex min-w-0 items-center gap-1 font-medium text-ink">
                <Emoji e="👑" /> <span className="truncate">{champion}</span>
              </span>
            ) : (
              <span>{phase === 'live' ? t('inProgress') : t('playersCount', { n: entry.t.players.length })}</span>
            )}
            {entry.online && (
              <span>
                <RoleBadge role={entry.online} />
              </span>
            )}
          </span>
        </span>
        {phase === 'live' && (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-none bg-well" aria-hidden>
            <span className="block h-full rounded-none bg-brand" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
          </span>
        )}
      </span>
      <Icon name="next" size={20} className="shrink-0 text-mute" />
    </a>
  )
}

function OpenLink() {
  const { t } = useLang()
  const [value, setValue] = useState('')
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-mute">
        <Icon name="link" size={16} /> {t('openLink')}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const link = parseCode(value)
          if (!link) return warn(t('badLink'))
          go({ page: 'online', ...link })
        }}
        className="mt-3 flex gap-2"
      >
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('openLinkHint')} aria-label={t('openLinkHint')} autoCapitalize="off" autoCorrect="off" spellCheck={false} className={`${field} min-w-0`} />
        <button disabled={!value.trim()} className={`${outline} shrink-0`}>
          {t('open')} <Icon name="go" size={18} />
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
  const installed = Capacitor.isNativePlatform() || matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
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
              <Icon name="iosShare" size={14} className="inline align-[-2px]" label="Share" />
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
          <Icon name="download" size={16} /> {t('install')}
        </button>
      )}
    </section>
  )
}

// Something to look at before the first tournament: every game you could play, drifting past over twinkling pixels
// (React Bits PixelCard and LogoLoop).
function Toys() {
  return (
    <PixelCard trigger="always" colors={['#26300d', '#3d4f12', '#c6f24e']} gap={7} pixelSize={3} speed={40} radius={10} noFocus className="mt-8 h-auto! w-full! bg-none! bg-c-mint! py-7 shadow-none!">
      <LogoLoop
        ariaLabel=""
        logos={EMOJIS.map((e) => ({ node: <Emoji e={e} className="text-[44px]" /> }))}
        speed={38}
        logoHeight={44}
        gap={28}
        pauseOnHover={false}
        fadeOut
        fadeOutColor="#1b240a"
        width="100%"
      />
    </PixelCard>
  )
}
