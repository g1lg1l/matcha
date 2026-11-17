// Shared bits of UI, borrowed from Midori so both apps feel like siblings.
import { Capacitor } from '@capacitor/core'
import { BotAvatar, botAvatarTypes } from 'bot-avatars'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { sileo, Toaster as Sileo } from 'sileo'
import 'sileo/styles.css'
import ClickSpark from './bits/ClickSpark'
import Counter from './bits/Counter'
import DecryptedText from './bits/DecryptedText'
import RubberSegment from './bits/RubberSegment'
import SquishSwitch from './bits/SquishSwitch'
import StarBorder from './bits/StarBorder'
import { getLang, t } from './i18n'
import { Icon, pictureOf } from './icons'

export const fieldBare = 'w-full rounded-xl border border-line px-3.5 py-2.5 placeholder:text-mute/80 focus:border-brand focus:outline-none'
// 16px, never less: iOS zooms the page when a smaller field takes focus
export const field = `${fieldBare} bg-raised text-base`
export const pill =
  'pixel key inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-display font-semibold disabled:opacity-50 hover:bg-white'
export const btn = `${pill} h-11 px-5`
export const outline =
  'pixel key inline-flex h-11 items-center justify-center gap-2 bg-raised px-5 font-display font-semibold hover:bg-line disabled:opacity-50'
const ghostBare = 'inline-flex items-center gap-1.5 rounded-lg h-9 text-sm font-medium transition active:scale-95'
export const ghost = `${ghostBare} px-3 text-mute hover:text-ink hover:bg-raised`
export const danger = `${ghostBare} justify-self-start px-3 -mx-3 text-danger hover:opacity-75`
export const iconBtn =
  // 36px to look at, 44px to hit
  'relative inline-grid place-items-center size-9 shrink-0 rounded-lg text-mute hover:text-ink hover:bg-raised active:scale-90 transition disabled:opacity-30 disabled:pointer-events-none after:absolute after:-inset-1'

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export const Logo = ({ className = '' }: { className?: string }) => <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className={className} />

type ToastAction = { label: string; run: () => void }
/** A toast (Sileo). With an action it stays a little longer and carries the button, for undo. */
export const toast = (message: string, action?: ToastAction) => {
  dispatchEvent(new Event('toast'))
  if (!action) return void sileo.show({ title: message, duration: 3000 })
  // one line: the undo is a small key inside the pill, not Sileo's wide button under it
  const title = (
    <span className="inline-flex items-center gap-2.5">
      {message}
      <span
        role="button"
        tabIndex={0}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          action.run()
          sileo.dismiss(id)
        }}
        className="pixel inline-flex h-6 items-center gap-1 bg-brand px-2 font-sans text-xs font-semibold text-on-primary"
      >
        <Icon name="undo" size={14} /> {action.label}
      </span>
    </span>
  )
  // Sileo types the title as a string but renders it as a child, so a node is fine
  const id: string = sileo.show({ title: title as unknown as string, duration: 5000 })
}

const HAPTICS = 'matcha:haptics'
export const hapticsOn = () => {
  try {
    return localStorage.getItem(HAPTICS) !== '0'
  } catch {
    return true
  }
}
export const setHaptics = (on: boolean) => {
  try {
    localStorage.setItem(HAPTICS, on ? '1' : '0')
  } catch {
    /* fine, just not remembered */
  }
}

/** A light tap on phones that support it, unless turned off in the app's settings. */
export function haptic() {
  if (!hapticsOn()) return
  if (Capacitor.isNativePlatform()) import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })).catch(() => {})
  else navigator.vibrate?.(12)
}

// Every tap on a control gives a light tap back.
addEventListener('click', (e) => {
  const el = (e.target as Element).closest?.('button, a[href]')
  if (el && !el.matches(':disabled')) haptic()
})

/** Sparks under every tap (React Bits ClickSpark), in matcha lime. Wrap a screen or a sheet in it. */
export function Sparks({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ClickSpark sparkColor={['#c6f24e', '#e2ff94', '#ffffff']} sparkSize={9} sparkRadius={26} sparkCount={9} duration={420} className={className}>
      {children}
    </ClickSpark>
  )
}

// An empty box in the top layer at (x, y), above sheets and everything else.
function burstHost(x: number, y: number) {
  const host = document.createElement('div')
  host.className = 'burst'
  host.popover = 'manual'
  host.style.left = `${x}px`
  host.style.top = `${y}px`
  document.body.append(host)
  host.showPopover()
  return host
}

/** A quick bump on a value that just changed. */
export const tick = (el: Element | null | undefined, from = 1.25) => {
  if (!reducedMotion()) el?.animate([{ scale: from }, { scale: 1 }], { duration: 220, easing: 'ease-out' })
}

/** A card that is waiting for a result: a star of light runs round its edge (React Bits StarBorder). */
export function ReadyCard({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <StarBorder
      as="button"
      type="button"
      onClick={onClick}
      data-ready
      color="#c6f24e"
      duration={3.2}
      thickness={2}
      radius={8}
      trailLength={0.4}
      backgroundColor="#111111"
      textColor="#ffffff"
      className="block! w-full! p-0! text-left! leading-normal! font-normal! transition-[scale] active:scale-[0.98]"
    >
      {children}
    </StarBorder>
  )
}

/** A quick sideways shake: the control saying no. */
export const shake = (el: Element | null | undefined) => {
  if (!reducedMotion()) el?.animate({ translate: ['0', '-6px 0', '6px 0', '-4px 0', '0'] }, { duration: 280 })
}

/** For a list whose order changes: rows marked with data-flip glide to their new places (FLIP). */
export function useFlip<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const was = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const now = new Map<string, number>()
    for (const el of ref.current?.children ?? []) {
      const id = (el as HTMLElement).dataset.flip
      if (!id) continue
      const top = (el as HTMLElement).offsetTop
      const before = was.current.get(id)
      now.set(id, top)
      if (before != null && before !== top && !reducedMotion())
        el.animate({ translate: [`0 ${before - top}px`, '0 0'] }, { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
    }
    was.current = now
  })
  return ref
}

/** A number on an odometer: its digits roll to every new value (React Bits Counter). */
export function Count({ n }: { n: number }) {
  return <Counter value={n} locale={getLang()} format={{ maximumFractionDigits: 2 }} fontSize="1em" duration={0.6} />
}

const decoded = new Set<string>()
/** Text that decodes itself from arcade noise (React Bits DecryptedText). With `once`, only the first time it is shown. */
export function Scramble({ text, once }: { text: string; once?: boolean }) {
  const [plain] = useState(() => !!once && decoded.has(text))
  useEffect(() => {
    decoded.add(text)
  }, [text])
  if (plain) return <>{text}</>
  return <DecryptedText text={text} animateOn="view" sequential speed={55} characters="#%&$@*+=?<>/[]0123456789" encryptedClassName="text-brand" />
}

// Native <dialog>: focus trap, Esc and the top layer for free. Mounting it opens it.
export function Sheet({ label, header, footer, onClose, children }: { label: string; header: ReactNode; footer?: ReactNode; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (ref.current?.open) return
    ref.current?.showModal()
    ref.current?.focus()
  }, [])
  const close = () => ref.current?.close()

  // on phones the header drags the sheet down: let go past a third of a hand and it closes
  const from = useRef<number>(undefined)
  const pull = (e: PointerEvent) => Math.max(0, e.clientY - (from.current ?? e.clientY))
  const drag = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if ((e.target as Element).closest('button, input') || !matchMedia('(max-width: 40rem)').matches) return
      from.current = e.clientY
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: PointerEvent) => {
      if (from.current == null || !ref.current) return
      ref.current.style.transition = 'none'
      ref.current.style.translate = `0 ${pull(e)}px`
    },
    onPointerUp: (e: PointerEvent) => {
      if (from.current == null || !ref.current) return
      const far = pull(e) > 90
      from.current = undefined
      ref.current.style.transition = ''
      ref.current.style.translate = ''
      if (far) close()
    },
  }
  return (
    <dialog
      ref={ref}
      aria-label={label}
      tabIndex={-1}
      onClose={() => setTimeout(onClose, reducedMotion() ? 0 : 220)}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="sheet m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[10px] bg-sheet p-0 text-ink outline-none open:flex open:flex-col sm:m-auto sm:max-h-[86dvh] sm:w-[min(100%-2rem,32rem)] sm:rounded-[10px]"
    >
      <Sparks className="flex min-h-0 flex-1 flex-col">
      <div {...drag} onPointerCancel={drag.onPointerUp} className="relative flex shrink-0 touch-none items-center gap-1 border-b border-line px-5 pt-5 pb-4">
        <span aria-hidden className="absolute inset-x-0 top-1.5 mx-auto h-1 w-9 bg-line sm:hidden" />
        <div className="min-w-0 flex-1">{header}</div>
        <button onClick={close} aria-label={t('close')} className={`${iconBtn} -my-1 -mr-2`}>
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 ${footer ? 'pb-5' : 'pb-[max(1.5rem,env(safe-area-inset-bottom))]'}`}>{children}</div>
      {footer && <div className="shrink-0 border-t border-line bg-raised px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </Sparks>
    </dialog>
  )
}

/** Closes the nearest sheet, playing its exit animation. */
export const closeSheet = (el: Element | null) => el?.closest('dialog')?.close()

// Sileo draws the toasts; the box around it is a popover, so they can go above an open sheet (the top layer).
export function Toaster() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const raise = () => {
      if (ref.current?.matches(':popover-open') && !document.querySelector('dialog[open]')) return
      ref.current?.hidePopover()
      ref.current?.showPopover()
    }
    raise()
    addEventListener('toast', raise)
    return () => removeEventListener('toast', raise)
  }, [])
  return (
    <div ref={ref} popover="manual" className="toasts">
      <Sileo position="top-center" theme="dark" offset={{ top: 'max(0.75rem, env(safe-area-inset-top))' }} options={{ fill: '#1d1d1d', roundness: 8, styles: { title: 'text-white! normal-case! font-display', button: 'font-semibold normal-case!' } }} />
    </div>
  )
}

// A little confetti pop of pixel icons at (x, y), drawn in the top layer above everything.
export function burst(x: number, y: number, emoji: string, count = 14) {
  if (reducedMotion()) return
  const host = burstHost(x, y)
  for (let i = 0; i < count; i++) {
    const [cls, color] = pictureOf(i % 3 ? emoji : '✨')
    const s = document.createElement('span')
    s.className = cls
    s.style.color = color
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
    const dist = 50 + Math.random() * (count > 14 ? 140 : 70)
    s.style.setProperty('--x', `${Math.cos(angle) * dist}px`)
    s.style.setProperty('--y', `${Math.sin(angle) * dist - 30}px`)
    s.style.setProperty('--r', `${Math.random() * 360 - 180}deg`)
    host.append(s)
  }
  setTimeout(() => host.remove(), 1000)
}

export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-start gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <span className="flex-1" onClick={() => !disabled && onChange(!checked)}>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-sm text-mute">{hint}</span>
      </span>
      <SquishSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={label} width={46} height={28} radius={5} trackColor="#2a2a2a" trackOnColor="#c6f24e" thumbColor="#ffffff" thumbOnColor="#0d1300" className="mt-0.5 shrink-0" />
    </div>
  )
}

export function Splash() {
  return (
    <div className="grid h-dvh place-items-center">
      <Logo className="size-14 animate-pulse motion-reduce:animate-none" />
    </div>
  )
}

/** Segmented control, used for tabs and either/or choices: a rubber thumb that stretches to the pick (React Bits RubberSegment). Always full width. */
export function Segmented<T extends string>({ value, options, onChange, label, fit }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; /** slots as wide as their labels (long labels), not all equal */ fit?: boolean }) {
  return (
    <RubberSegment
      aria-label={label}
      items={options.map((o) => ({ value: o.value, label: o.label }))}
      value={value}
      onChange={(v) => onChange(v as T)}
      size={fit ? 'md' : 'lg'}
      equalSlots={!fit}
      radius={6}
      trackColor="#161616"
      thumbColor="#2a2a2a"
      textColor="#b4b4b4"
      activeTextColor="#ffffff"
      className={`w-full font-semibold ${fit ? 'text-[13px] [--rs-pad:8px]!' : ''}`}
    />
  )
}

// arcade player colours: bright enough to sit on black under white initials
const palette = ['#e5484d', '#f76b15', '#0090ff', '#a35829', '#12a594', '#d6409f', '#3e63dd', '#5c7c2f']
export const colorOf = (key: string) => {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0
  return palette[Math.abs(h) % palette.length]
}

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => [...w][0] ?? '')
    .join('')
    .toUpperCase()

const hash = (key: string) => {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** A player's face: a little bot drawn from their name, in their colour (bot-avatars). Small ones hold still. */
export function Avatar({ name, color, size = 26 }: { name: string; color: string; size?: number }) {
  const h = hash(name.trim().toLowerCase())
  return (
    <span aria-hidden className="inline-grid shrink-0 place-items-center select-none" style={{ width: size, height: size }}>
      <BotAvatar type={botAvatarTypes[h % botAvatarTypes.length]} seed={(h % 1000) / 1000} color={color} size={size} paused={size < 34 || reducedMotion()} role="presentation" />
    </span>
  )
}

/** Native share sheet on phones, clipboard on desktop. */
export async function shareLink(title: string, text: string, url: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title, text, url })
    } else if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title, text, url })
    } else {
      await navigator.clipboard.writeText(url)
      toast(t('linkCopied'))
    }
  } catch {
    /* share sheet dismissed */
  }
}
