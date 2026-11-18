// The app's own settings, apart from any tournament: language, vibration, and what Matcha is.
import { Capacitor } from '@capacitor/core'
import { useState } from 'react'
import { version } from '../package.json'
import { Icon, type IconName } from './icons'
import { setLang, useLang } from './i18n'
import { WEB_URL } from './online'
import { hapticsOn, iconBtn, Logo, Segmented, setHaptics, shareLink, Toggle } from './ui'

const REPO = 'https://github.com/g1lg1l/matcha'
const credits = [
  ['React Bits', 'https://reactbits.dev'],
  ['bot-avatars', 'https://libraries.dev'],
  ['Sileo', 'https://www.npmjs.com/package/sileo'],
  ['Motion', 'https://motion.dev'],
  ['Pixelarticons', 'https://github.com/halfmage/pixelarticons'],
  ['Streamline Pixel', 'https://icon-sets.iconify.design/streamline-pixel/'],
  ['Pixel Icon Library', 'https://icon-sets.iconify.design/pixel/'],
  ['Memory Icons', 'https://icon-sets.iconify.design/memory/'],
  ['Iconify', 'https://iconify.design'],
] as const
const row = 'flex min-h-13 w-full items-center gap-3 px-4 text-left font-medium transition-colors active:bg-raised'

export function AppSettings() {
  const { t, lang } = useLang()
  const [haptics, setOn] = useState(hapticsOn)
  // only where the device can actually buzz
  const canBuzz = Capacitor.isNativePlatform() || 'vibrate' in navigator
  const h = 'mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-mute'

  return (
    <main className="fade-in mx-auto max-w-xl px-5 pt-[max(1.25rem,calc(env(safe-area-inset-top)_+_0.5rem))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="-ml-2 flex items-center gap-1">
        <a href="#/" aria-label={t('back')} className={iconBtn}>
          <Icon name="back" size={22} />
        </a>
        <h1 className="font-display text-xl font-bold">{t('settings')}</h1>
      </header>

      <section className="mt-7">
        <h2 className={h}>
          <Icon name="globe" size={16} /> {t('language')}
        </h2>
        <Segmented
          label={t('language')}
          value={lang}
          onChange={setLang}
          options={[
            { value: 'it', label: 'Italiano' },
            { value: 'en', label: 'English' },
          ]}
        />
      </section>

      {canBuzz && (
        <section className="mt-8 rounded-2xl bg-sheet p-4">
          <Toggle
            label={t('haptics')}
            hint={t('hapticsHint')}
            checked={haptics}
            onChange={(on) => {
              setHaptics(on)
              setOn(on)
            }}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className={h}>
          <Icon name="info" size={16} /> {t('about')}
        </h2>
        <div className="flex items-center gap-4 rounded-2xl bg-sheet p-4">
          <Logo className="size-12" />
          <div className="min-w-0">
            <p className="font-display text-lg">Matcha</p>
            <p className="text-sm text-mute tabular-nums">
              {t('version')} {version}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-mute">{t('aboutText')}</p>
        <p className="mt-1 text-sm text-mute">
          {t('credits')}{' '}
          {credits.map(([name, href], i) => (
            <span key={name}>
              {i > 0 && ', '}
              <a href={href} target="_blank" rel="noreferrer" className="text-ink underline decoration-line underline-offset-4">
                {name}
              </a>
            </span>
          ))}
          .
        </p>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-sheet">
          <li>
            <Link icon="github" href={REPO} label={t('sourceCode')} />
          </li>
          <li>
            <Link icon="bug" href={`${REPO}/issues/new`} label={t('reportBug')} />
          </li>
          <li>
            <button onClick={() => shareLink('Matcha', t('shareAppText'), WEB_URL)} className={row}>
              <Icon name="share" size={20} className="text-mute" />
              <span className="flex-1">{t('shareApp')}</span>
            </button>
          </li>
        </ul>
      </section>
    </main>
  )
}

function Link({ icon, href, label }: { icon: IconName; href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={row}>
      <Icon name={icon} size={20} className="text-mute" />
      <span className="flex-1">{label}</span>
      <Icon name="external" size={16} className="text-mute" />
    </a>
  )
}
