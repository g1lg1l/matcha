import { EmojiPicker } from './EmojiPicker'
import { Icon } from './icons'
import { useEffect, useState } from 'react'
import { prune, started, type Tournament } from './engine'
import { setLang, useLang } from './i18n'
import { errorText, refereeCode, resetRefereeCode, shareUrl } from './online'
import { PlayersEditor } from './Players'
import { duplicate } from './Create'
import { nextRound } from './party'
import { go } from './router'
import { PartyEditor, PointsEditor } from './Scoring'
import type { Source } from './TournamentPage'
import { btn, danger, field, ghost, outline, Segmented, shareLink, Sheet, toast, Toggle } from './ui'

export function SettingsSheet({ source, onClose, onShare, onPublish, onRemove }: { source: Source; onClose: () => void; onShare: () => void; onPublish: () => Promise<void>; onRemove: () => void }) {
  const { t, lang } = useLang()
  const tour = source.t
  const { save, canEdit, online } = source
  const locked = started(tour)
  const [publishing, setPublishing] = useState(false)
  const h = 'mb-2.5 text-sm font-semibold text-mute'

  return (
    <Sheet label={t('settings')} onClose={onClose} header={<p className="font-display font-semibold">{t('settings')}</p>}>
      <div className="grid grid-cols-1 gap-8">
        {canEdit && (
          <section>
            <h3 className={h}>{t('rename')}</h3>
            <input
              key={tour.name}
              defaultValue={tour.name}
              maxLength={60}
              aria-label={t('rename')}
              onBlur={(e) => {
                const name = e.target.value.trim()
                if (name && name !== tour.name) save({ ...tour, name })
                else e.target.value = tour.name
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={`${field} font-display font-semibold`}
            />
            <div className="mt-1.5">
              <EmojiPicker compact value={tour.emoji} onChange={(emoji) => save({ ...tour, emoji })} label={t('emoji')} />
            </div>
          </section>
        )}

        {online && (
          <section>
            <h3 className={h}>{t('share')}</h3>
            <div className="flex items-center gap-2 rounded-xl bg-raised py-1.5 pr-1.5 pl-3.5">
              <span className="min-w-0 flex-1 truncate font-mono text-sm">{shareUrl(online.code)}</span>
              <button
                onClick={() => navigator.clipboard.writeText(shareUrl(online.code)).then(() => toast(t('linkCopied')))}
                className={`${outline} h-9 shrink-0 bg-sheet px-3.5 text-sm`}
              >
                <Icon name="copy" size={15} /> {t('copyLink')}
              </button>
            </div>
            <button onClick={onShare} className={`${btn} mt-3 w-full`}>
              <Icon name="share" size={18} /> {t('share')}
            </button>
          </section>
        )}

        {online?.role === 'owner' && !online.stale && <RefereeLink id={tour.id} code={online.code} name={tour.name} />}

        {!online && (
          <section>
            <h3 className={h}>{t('online')}</h3>
            <p className="mb-3 text-sm text-mute">{t('publishHint')}</p>
            <button
              disabled={publishing}
              onClick={async () => {
                setPublishing(true)
                await onPublish()
                setPublishing(false)
              }}
              className={`${btn} w-full`}
            >
              <Icon name="cloud" size={18} /> {publishing ? t('publishing') : t('publish')}
            </button>
          </section>
        )}

        {canEdit && (tour.format === 'single' || tour.format === 'double') && (
          <section className="grid gap-4">
            <h3 className={`${h} mb-0`}>{t('options')}</h3>
            {tour.format === 'single' && (
              <Toggle label={t('thirdPlace')} hint={t('thirdPlaceHint')} checked={!!tour.options.thirdPlace} onChange={(v) => save(prune({ ...tour, options: { ...tour.options, thirdPlace: v } }))} />
            )}
            {tour.format === 'double' && (
              <Toggle label={t('bracketReset')} hint={t('bracketResetHint')} checked={!!tour.options.bracketReset} onChange={(v) => save(prune({ ...tour, options: { ...tour.options, bracketReset: v } }))} />
            )}
          </section>
        )}
        {canEdit && tour.format === 'roundrobin' && (
          <section className="grid grid-cols-1 gap-5">
            <h3 className={`${h} mb-0`}>{t('options')}</h3>
            <Toggle label={t('legs')} hint={t('legsHint')} disabled={locked} checked={tour.options.legs === 2} onChange={(v) => save({ ...tour, options: { ...tour.options, legs: v ? 2 : 1 } })} />
            <PointsEditor value={tour.options.points} onChange={(points) => save({ ...tour, options: { ...tour.options, points } })} />
          </section>
        )}
        {canEdit && tour.format === 'party' && (
          <section className="grid grid-cols-1">
            <h3 className={h}>{t('scoring')}</h3>
            <PartyEditor
              value={tour.options.party}
              minRounds={tour.tables?.length ?? 1}
              onChange={(party) => {
                const next = { ...tour, options: { ...tour.options, party } }
                // before anyone has played, a new table size reseats the first round
                save(!locked && party.tableSize !== tour.options.party?.tableSize ? reseat(next) : next)
              }}
            />
          </section>
        )}

        {canEdit && (
          <section>
            <h3 className={h}>
              {t('players')} · {tour.players.length}
            </h3>
            <PlayersEditor
              players={tour.players}
              locked={locked}
              onChange={(players) => {
                if (players.length < 2 && !locked) return toast(t('tooFew'))
                const next = { ...tour, players }
                // new or removed players before the first result: seat the first round again
                save(tour.format === 'party' && !locked && players.length !== tour.players.length ? reseat(next) : next)
              }}
            />
          </section>
        )}

        <section>
          <h3 className={h}>{t('language')}</h3>
          <Segmented
            label={t('language')}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'it', label: '🇮🇹 Italiano' },
              { value: 'en', label: '🇬🇧 English' },
            ]}
          />
        </section>

        <section className="grid gap-1 border-t border-line pt-4">
          <button
            onClick={() => {
              duplicate(tour)
              go({ page: 'new' })
            }}
            className={`${ghost} -mx-3 justify-self-start text-ink`}
          >
            <Icon name="copy" size={16} /> {t('duplicate_t')}
          </button>
          {canEdit && locked && (
            <button
              onClick={() => {
                if (confirm(t('restartConfirm', { name: tour.name }))) save({ ...tour, results: {} })
              }}
              className={danger}
            >
              {t('restart')}
            </button>
          )}
          {!online || online.role === 'owner' ? (
            <button onClick={onRemove} className={danger}>
              {t('remove_t')}
            </button>
          ) : (
            <button onClick={onRemove} className={danger}>
              {t('unfollow')}
            </button>
          )}
        </section>
      </div>
    </Sheet>
  )
}

function RefereeLink({ id, code, name }: { id: string; code: string; name: string }) {
  const { t } = useLang()
  const [referee, setReferee] = useState<string>()
  useEffect(() => {
    refereeCode(id).then(setReferee, (e) => toast(errorText(e)))
  }, [id])
  const url = referee ? shareUrl(code, referee) : ''
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-mute">
        <Icon name="flag" size={14} /> {t('refereeLink')}
      </h3>
      <p className="mb-3 text-sm text-mute">{t('refereeHint')}</p>
      <div className="flex gap-2">
        <button
          disabled={!referee}
          onClick={() => shareLink(name, t('refereeShareText', { name }), url)}
          className={`${outline} flex-1`}
        >
          <Icon name="share" size={17} /> {t('shareReferee')}
        </button>
        <button
          disabled={!referee}
          aria-label={t('copyLink')}
          onClick={() => navigator.clipboard.writeText(url).then(() => toast(t('linkCopied')))}
          className={`${outline} px-3.5`}
        >
          <Icon name="copy" size={17} />
        </button>
      </div>
      <button
        disabled={!referee}
        onClick={async () => {
          if (!confirm(t('resetRefereeConfirm'))) return
          try {
            setReferee(await resetRefereeCode(id))
            toast(t('refereeWasReset'))
          } catch (e) {
            toast(errorText(e))
          }
        }}
        className={`${danger} mt-2`}
      >
        {t('resetReferee')}
      </button>
    </section>
  )
}

const reseat = (t: Tournament): Tournament => {
  const fresh = { ...t, tables: [] }
  return { ...fresh, results: {}, tables: [nextRound(fresh)] }
}
