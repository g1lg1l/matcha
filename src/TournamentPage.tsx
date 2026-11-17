import { Emoji, Icon } from './icons'
import { useEffect, useRef, useState } from 'react'
import { BracketView, MatchList, Standings, type Ctx } from './Bracket'
import { build, progress, withResult, type Match, type Result, type Tournament } from './engine'
import { t as translate, useLang } from './i18n'
import { MatchSheet } from './MatchSheet'
import type { TableResult } from './party'
import { PartyStandings, RoundsView, TableSheet, withNextRound } from './PartyView'
import { Podium } from './Podium'
import { createOnline, deleteOnline, errorText, openByCode, saveOnline, setResultOnline, shareUrl, subscribe, unfollow } from './online'
import { go } from './router'
import { SettingsSheet } from './SettingsSheet'
import { forgetOnline, getOnline, rememberOnline, removeLocal, saveLocal, updateOnlineSnapshot, useStore, type Role } from './store'
import { btn, burst, haptic, iconBtn, Logo, Segmented, shareLink, Splash, toast } from './ui'
import { formatEmoji } from './view'

export interface Source {
  t: Tournament
  canEdit: boolean
  /** whole-document changes: name, players, options */
  save: (t: Tournament) => void
  /** one result, or null to clear it */
  setResult: (matchId: string, result: Result | TableResult | null) => void
  online?: { code: string; role: Role; stale: boolean }
}

export function LocalTournament({ id }: { id: string }) {
  const { local } = useStore()
  const t = local.find((x) => x.id === id)
  if (!t) return <Missing />
  return <TournamentPage source={{ t, canEdit: true, save: saveLocal, setResult: (m, r) => saveLocal(withResult(t, m, r)) }} />
}

export function OnlineTournament({ code, referee }: { code: string; referee?: string }) {
  const { t: tr } = useLang()
  const cached = getOnline(code)
  const [t, setT] = useState<Tournament | undefined>(cached?.t)
  const [role, setRole] = useState<Role>(cached?.role ?? 'viewer')
  const [state, setState] = useState<'loading' | 'live' | 'offline' | 'missing'>('loading')
  const server = useRef<Tournament | undefined>(undefined) // last version the server confirmed
  const firstReferee = useRef(referee) // only the first open uses it; then it leaves the URL

  useEffect(() => {
    let stop = () => {}
    let alive = true
    const ref = firstReferee.current
    openByCode(code, ref)
      .then((found) => {
        if (!alive) return
        if (!found) {
          forgetOnline(code)
          return setState('missing')
        }
        const { row, role } = found
        server.current = row.data
        setT(row.data)
        setRole(role)
        setState('live')
        rememberOnline({ code, role, t: row.data })
        if (ref) {
          // the referee code has done its job; keep it out of the address bar and history
          go({ page: 'online', code }, true)
          toast(role === 'viewer' ? translate('refereeExpired') : translate('nowReferee'))
        }
        stop = subscribe(row.id, (next) => {
          if (!next) {
            forgetOnline(code)
            return setState('missing')
          }
          server.current = next.data
          setT(next.data)
        })
      })
      .catch(() => alive && setState('offline'))
    return () => {
      alive = false
      stop()
    }
    // referee only matters on the first open
  }, [code])

  useEffect(() => {
    if (t) updateOnlineSnapshot(code, t)
  }, [code, t])

  if (state === 'missing') return <Missing />
  if (!t) return state === 'offline' ? <Offline /> : <Splash />

  const failed = (e: unknown) => {
    toast(errorText(e))
    setT(server.current)
  }
  const save = (next: Tournament) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    setT(stamped) // optimistic
    saveOnline(t, stamped).catch(failed)
  }
  // functional update, so two quick results in a row both land
  const setResult = (matchId: string, result: Result | TableResult | null) => {
    setT((prev) => (prev ? withResult(prev, matchId, result) : prev))
    setResultOnline(t.id, matchId, result).catch(failed)
  }
  const canEdit = role !== 'viewer' && state === 'live'
  return (
    <>
      {state === 'offline' && (
        <div className="flex items-center justify-center gap-2 bg-c-peach px-4 py-2 text-sm font-medium">
          <Icon name="offline" size={15} /> {tr('offline')}
        </div>
      )}
      <TournamentPage source={{ t, canEdit, save, setResult, online: { code, role, stale: state !== 'live' } }} />
    </>
  )
}

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useLang()
  return (
    <span className="inline-flex items-center gap-1 pixel bg-raised px-2 py-0.5 text-xs font-semibold">
      <Icon name={role === 'owner' ? 'cloud' : role === 'editor' ? 'flag' : 'eye'} size={13} />
      {role === 'owner' ? t('onlineBadge') : role === 'editor' ? t('referee') : t('viewing')}
    </span>
  )
}

type Tab = 'bracket' | 'matches' | 'standings'

function TournamentPage({ source }: { source: Source }) {
  const { t } = useLang()
  const tour = source.t
  const b = build(tour)
  const knockout = tour.format === 'single' || tour.format === 'double'
  const party = tour.format === 'party'
  const [tab, setTab] = useState<Tab>(knockout ? 'bracket' : 'matches')
  const [open, setOpen] = useState<string>()
  const [settings, setSettings] = useState(false)
  const champion = b.champion ? tour.players.find((p) => p.id === b.champion) : undefined
  const ctx: Ctx = { t: tour, b, canEdit: source.canEdit, onOpen: (m: Match) => setOpen(m.id) }
  const openMatch = open ? b.byId.get(open) : undefined
  const openTable = open ? b.tables.find((x) => x.id === open) : undefined
  const prog = progress(b, tour)

  // every result can be taken back for a few seconds, including the later results it reset
  const record = (id: string, r: Result | TableResult | null) => {
    const before = tour
    source.setResult(id, r)
    haptic()
    toast(r ? t('resultSaved') : t('deleted'), { label: t('undo'), run: () => source.save(before) })
  }

  const share = async () => {
    if (!source.online) return setSettings(true)
    await shareLink(tour.name, t('shareText', { name: tour.name }), shareUrl(source.online.code))
  }

  async function publish() {
    try {
      const row = await createOnline(tour)
      rememberOnline({ code: row.share_code, role: 'owner', t: row.data })
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
      else if (source.online.role === 'owner') {
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
    <main className="fade-in mx-auto max-w-5xl px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <header className="-ml-2 flex items-center gap-1">
        <a href="#/" aria-label={t('back')} className={iconBtn}>
          <Icon name="back" size={22} />
        </a>
        <Emoji e={tour.emoji} className="bob ml-1 text-[30px]" />
        <h1 className="ml-1.5 line-clamp-2 min-w-0 flex-1 font-display text-[clamp(20px,5vw,28px)] leading-tight font-bold break-words">{tour.name}</h1>
        {source.online && (
          <button onClick={share} aria-label={t('share')} className={iconBtn}>
            <Icon name="share" size={20} />
          </button>
        )}
        <button onClick={() => setSettings(true)} aria-label={t('settings')} className={iconBtn}>
          <Icon name="settings" size={20} />
        </button>
      </header>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mute">
        <span className="inline-flex items-center gap-1.5">
          <Emoji e={formatEmoji[tour.format]} /> {t(tour.format)}
        </span>
        <span aria-hidden>·</span>
        <span>{t('playersCount', { n: tour.players.length })}</span>
        {source.online && <RoleBadge role={source.online.role} />}
      </p>

      {prog.total > 0 && !b.finished && <ProgressBar done={prog.done} total={prog.total} />}

      {champion && <ChampionBanner name={champion.name} id={tour.id} />}

      {source.online?.role === 'viewer' && <p className="mt-4 rounded-xl bg-well px-3.5 py-2.5 text-sm text-mute"><Emoji e="👀" className="mr-1" /> {t('viewOnly')}</p>}

      <div className="mt-6 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented
          label={t('bracket')}
          value={tab}
          onChange={setTab}
          options={[
            ...(knockout ? [{ value: 'bracket' as const, label: t('bracket') }] : []),
            { value: 'matches', label: party ? t('rounds') : t('matches') },
            { value: 'standings', label: t('standings') },
          ]}
        />
        {source.canEdit && prog.done === 0 && tab !== 'standings' && <p className="text-sm text-mute"><Emoji e="👆" className="bob mr-1" /> {party ? t('tapTable') : t('tapToPlay')}</p>}
      </div>

      <div key={tab} className="fade-in">
        {tab === 'bracket' && knockout && <BracketView ctx={ctx} />}
        {tab === 'matches' && !party && <MatchList ctx={ctx} />}
        {tab === 'matches' && party && (
          <RoundsView
            t={tour}
            b={b}
            canEdit={source.canEdit}
            onOpen={(x) => setOpen(x.id)}
            onNextRound={() => {
              source.save(withNextRound(tour))
              haptic()
            }}
          />
        )}
        {tab === 'standings' && (
          <>
            {b.finished && <Podium t={tour} b={b} />}
            {party ? <PartyStandings t={tour} b={b} /> : <Standings ctx={ctx} />}
          </>
        )}
      </div>

      {!source.online && (
        <button onClick={publish} className="mt-12 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line p-4 text-left transition hover:border-brand">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-c-sky">
            <Icon name="link" size={20} />
          </span>
          <span>
            <span className="block font-semibold">{t('publish')}</span>
            <span className="block text-sm text-mute">{t('publishHint')}</span>
          </span>
        </button>
      )}

      {openMatch && source.canEdit && <MatchSheet m={openMatch} tour={tour} b={b} onResult={record} onClose={() => setOpen(undefined)} />}
      {openTable && source.canEdit && <TableSheet table={openTable} tour={tour} b={b} onResult={record} onClose={() => setOpen(undefined)} />}
      {settings && <SettingsSheet source={source} onClose={() => setSettings(false)} onShare={share} onPublish={publish} onRemove={remove} />}
    </main>
  )
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const { t } = useLang()
  const pct = Math.round((done / total) * 100)
  return (
    <div className="mt-4 flex items-center gap-3" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={t('progress', { done, total })}>
      <div className="h-2.5 flex-1 overflow-hidden rounded-none bg-well">
        <div className="h-full rounded-none bg-brand transition-[width] duration-500 ease-out" style={{ width: `${Math.max(pct, done ? 4 : 0)}%` }} />
      </div>
      <span className="shrink-0 text-xs font-semibold text-mute tabular-nums">{t('progress', { done, total })}</span>
    </div>
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
    <button ref={ref} onClick={party} className="pop mt-5 flex w-full items-center gap-4 rounded-[10px] bg-c-lemon p-4 text-left active:scale-[0.99]">
      <Emoji e="🏆" className="wobble text-[52px]" />
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
      <h1 className="mt-8 font-display text-2xl font-bold"><Emoji e="🫖" className="bob mr-2" />{t('notFound')}</h1>
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
      <Icon name="offline" size={36} className="mx-auto text-mute" />
      <p className="mt-6 font-semibold">{t('offline')}</p>
      <a href="#/" className={`${btn} mt-8 justify-self-center`}>
        {t('goHome')}
      </a>
    </main>
  )
}
