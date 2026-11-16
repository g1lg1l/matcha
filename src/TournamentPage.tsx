import { Capacitor } from '@capacitor/core'
import { ArrowLeft, Cloud, Eye, Link2, Settings, Share2, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BracketView, MatchList, Standings, type Ctx } from './Bracket'
import { build, type Match, type Tournament } from './engine'
import { useLang } from './i18n'
import { MatchSheet } from './MatchSheet'
import { createOnline, deleteOnline, errorText, me, openByCode, saveOnline, shareUrl, subscribe, unfollow } from './online'
import { go } from './router'
import { SettingsSheet } from './SettingsSheet'
import { forgetOnline, getOnline, rememberOnline, removeLocal, saveLocal, updateOnlineSnapshot, useStore } from './store'
import { btn, burst, iconBtn, Logo, Segmented, Splash, toast } from './ui'
import { formatEmoji } from './view'

export interface Source {
  t: Tournament
  canEdit: boolean
  save: (t: Tournament) => void
  online?: { code: string; owner: boolean; stale: boolean }
}

export function LocalTournament({ id }: { id: string }) {
  const { local } = useStore()
  const t = local.find((x) => x.id === id)
  if (!t) return <Missing />
  return <TournamentPage source={{ t, canEdit: true, save: saveLocal }} />
}

export function OnlineTournament({ code }: { code: string }) {
  const { t: tr } = useLang()
  const cached = getOnline(code)
  const [t, setT] = useState<Tournament | undefined>(cached?.t)
  const [owner, setOwner] = useState(cached?.owner ?? false)
  const [state, setState] = useState<'loading' | 'live' | 'offline' | 'missing'>('loading')
  const server = useRef<Tournament | undefined>(undefined) // last version the server confirmed

  useEffect(() => {
    let stop = () => {}
    let alive = true
    Promise.all([openByCode(code), me()])
      .then(([row, uid]) => {
        if (!alive) return
        if (!row) {
          forgetOnline(code)
          return setState('missing')
        }
        const isOwner = row.owner_id === uid
        server.current = row.data
        setT(row.data)
        setOwner(isOwner)
        setState('live')
        rememberOnline({ code, owner: isOwner, t: row.data })
        stop = subscribe(row.id, (next) => {
          if (!next) {
            forgetOnline(code)
            return setState('missing')
          }
          server.current = next.data
          setT(next.data)
          updateOnlineSnapshot(code, next.data)
        })
      })
      .catch(() => alive && setState('offline'))
    return () => {
      alive = false
      stop()
    }
  }, [code])

  if (state === 'missing') return <Missing />
  if (!t) return state === 'offline' ? <Offline /> : <Splash />

  const save = (next: Tournament) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    setT(stamped) // optimistic
    updateOnlineSnapshot(code, stamped)
    saveOnline(stamped).catch((e) => {
      toast(errorText(e))
      setT(server.current)
    })
  }
  return (
    <>
      {state === 'offline' && (
        <div className="flex items-center justify-center gap-2 bg-c-peach px-4 py-2 text-sm font-medium">
          <WifiOff size={15} aria-hidden /> {tr('offline')}
        </div>
      )}
      <TournamentPage source={{ t, canEdit: owner && state === 'live', save, online: { code, owner, stale: state !== 'live' } }} />
    </>
  )
}

type Tab = 'bracket' | 'matches' | 'standings'

function TournamentPage({ source }: { source: Source }) {
  const { t } = useLang()
  const tour = source.t
  const b = build(tour)
  const knockout = tour.format !== 'roundrobin'
  const [tab, setTab] = useState<Tab>(knockout ? 'bracket' : 'matches')
  const [open, setOpen] = useState<string>()
  const [settings, setSettings] = useState(false)
  const champion = b.champion ? tour.players.find((p) => p.id === b.champion) : undefined
  const ctx: Ctx = { t: tour, b, canEdit: source.canEdit, onOpen: (m: Match) => setOpen(m.id) }
  const openMatch = open ? b.byId.get(open) : undefined

  const share = async () => {
    if (!source.online) return setSettings(true)
    const url = shareUrl(source.online.code)
    const text = t('shareText', { name: tour.name })
    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: tour.name, text, url })
      } else if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: tour.name, text, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast(t('linkCopied'))
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  async function publish() {
    try {
      const row = await createOnline(tour)
      rememberOnline({ code: row.share_code, owner: true, t: row.data })
      removeLocal(tour.id)
      go({ page: 'online', code: row.share_code }, true)
      toast(t('published'))
    } catch (e) {
      toast(errorText(e))
    }
  }

  async function remove() {
    if (!confirm(t('removeConfirm', { name: tour.name }))) return
    try {
      if (!source.online) removeLocal(tour.id)
      else if (source.online.owner) {
        await deleteOnline(tour.id)
        forgetOnline(source.online.code)
      } else {
        await unfollow(tour.id).catch(() => {})
        forgetOnline(source.online.code)
      }
      go({ page: 'home' }, true)
      toast(t('deleted'))
    } catch (e) {
      toast(errorText(e))
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <header className="-ml-2 flex items-center gap-1">
        <a href="#/" aria-label={t('back')} className={iconBtn}>
          <ArrowLeft size={22} />
        </a>
        <span className="ml-1 text-[26px]" aria-hidden>
          {tour.emoji}
        </span>
        <h1 className="ml-1.5 line-clamp-2 min-w-0 flex-1 font-display text-[clamp(20px,5vw,28px)] leading-tight font-bold break-words">{tour.name}</h1>
        {source.online && (
          <button onClick={share} aria-label={t('share')} className={iconBtn}>
            <Share2 size={20} />
          </button>
        )}
        <button onClick={() => setSettings(true)} aria-label={t('settings')} className={iconBtn}>
          <Settings size={20} />
        </button>
      </header>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mute">
        <span>
          {formatEmoji[tour.format]} {t(tour.format)}
        </span>
        <span aria-hidden>·</span>
        <span>{t('playersCount', { n: tour.players.length })}</span>
        {source.online && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sheet px-2 py-0.5 text-xs font-semibold">
            {source.online.owner ? <Cloud size={12} aria-hidden /> : <Eye size={12} aria-hidden />}
            {source.online.owner ? t('onlineBadge') : t('viewing')}
          </span>
        )}
      </p>

      {champion && <ChampionBanner name={champion.name} id={tour.id} />}

      {!source.canEdit && source.online && !source.online.owner && <p className="mt-4 rounded-xl bg-well px-3.5 py-2.5 text-sm text-mute">👀 {t('viewOnly')}</p>}

      <div className="mt-6 mb-5">
        <Segmented
          label={t('bracket')}
          value={tab}
          onChange={setTab}
          options={[
            ...(knockout ? [{ value: 'bracket' as const, label: t('bracket') }] : []),
            { value: 'matches', label: t('matches') },
            { value: 'standings', label: t('standings') },
          ]}
        />
      </div>

      {tab === 'bracket' && knockout && <BracketView ctx={ctx} />}
      {tab === 'matches' && <MatchList ctx={ctx} />}
      {tab === 'standings' && <Standings ctx={ctx} />}

      {!source.online && (
        <button onClick={publish} className="mt-12 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line p-4 text-left transition hover:border-brand">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-c-sky">
            <Link2 size={20} aria-hidden />
          </span>
          <span>
            <span className="block font-semibold">{t('publish')}</span>
            <span className="block text-sm text-mute">{t('publishHint')}</span>
          </span>
        </button>
      )}

      {openMatch && source.canEdit && <MatchSheet m={openMatch} tour={tour} b={b} onSave={source.save} onClose={() => setOpen(undefined)} />}
      {settings && <SettingsSheet source={source} onClose={() => setSettings(false)} onShare={share} onPublish={publish} onRemove={remove} />}
    </main>
  )
}

function ChampionBanner({ name, id }: { name: string; id: string }) {
  const { t } = useLang()
  const ref = useRef<HTMLButtonElement>(null)
  const party = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) burst(r.left + r.width / 2, r.top + r.height / 2, '🏆', 28)
  }
  // celebrate once per device when we first see the champion
  useEffect(() => {
    const key = `matcha:party:${id}:${name}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      return
    }
    const timer = setTimeout(party, 250)
    return () => clearTimeout(timer)
  }, [id, name])
  return (
    <button ref={ref} onClick={party} className="pop mt-5 flex w-full items-center gap-4 rounded-[22px] bg-c-lemon p-4 text-left active:scale-[0.99]">
      <span className="wobble text-[44px] leading-none" aria-hidden>
        🏆
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-mute">{t('champion')}</span>
        <span className="block truncate font-display text-[clamp(22px,6vw,30px)] font-bold">{name}</span>
      </span>
    </button>
  )
}

function Missing() {
  const { t } = useLang()
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center px-5 py-10">
      <Logo className="size-12" />
      <h1 className="mt-8 font-display text-2xl font-bold">🫖 {t('notFound')}</h1>
      <a href="#/" className={`${btn} mt-8 justify-self-start`}>
        {t('goHome')}
      </a>
    </main>
  )
}

function Offline() {
  const { t } = useLang()
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center px-5 py-10 text-center">
      <WifiOff size={36} className="mx-auto text-mute" />
      <p className="mt-6 font-semibold">{t('offline')}</p>
      <a href="#/" className={`${btn} mt-8 justify-self-center`}>
        {t('goHome')}
      </a>
    </main>
  )
}
