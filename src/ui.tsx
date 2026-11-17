// Shared bits of UI, borrowed from Midori so both apps feel like siblings.
import { Capacitor } from '@capacitor/core'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from './i18n'
import { Icon, spriteOf } from './icons'

export const fieldBare = 'w-full rounded-xl border border-line px-3.5 py-2.5 placeholder:text-mute/80 focus:border-brand focus:outline-none'
export const field = `${fieldBare} bg-raised text-[15px]`
export const pill =
  'pixel inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-display font-semibold disabled:opacity-50 hover:bg-white active:translate-y-0.5 transition'
export const btn = `${pill} h-11 px-5`
export const outline =
  'pixel inline-flex h-11 items-center justify-center gap-2 bg-raised px-5 font-display font-semibold transition hover:bg-line active:translate-y-0.5 disabled:opacity-50'
const ghostBare = 'inline-flex items-center gap-1.5 rounded-lg h-9 text-sm font-medium transition active:scale-95'
export const ghost = `${ghostBare} px-3 text-mute hover:text-ink hover:bg-raised`
export const danger = `${ghostBare} justify-self-start px-3 -mx-3 text-danger hover:opacity-75`
export const iconBtn =
  'inline-grid place-items-center size-9 shrink-0 rounded-lg text-mute hover:text-ink hover:bg-raised active:scale-90 transition disabled:opacity-30 disabled:pointer-events-none'

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export const Logo = ({ className = '' }: { className?: string }) => <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className={className} />

type ToastAction = { label: string; run: () => void }
export const toast = (message: string, action?: ToastAction) => dispatchEvent(new CustomEvent('toast', { detail: { message, action } }))

/** A light tap on phones that support it. */
export function haptic() {
  if (Capacitor.isNativePlatform()) import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })).catch(() => {})
  else navigator.vibrate?.(12)
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
  return (
    <dialog
      ref={ref}
      aria-label={label}
      tabIndex={-1}
      onClose={() => setTimeout(onClose, reducedMotion() ? 0 : 220)}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="sheet m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[10px] bg-sheet p-0 text-ink outline-none open:flex open:flex-col sm:m-auto sm:max-h-[86dvh] sm:w-[min(100%-2rem,32rem)] sm:rounded-[10px]"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-line py-2.5 pr-2.5 pl-5">
        <div className="min-w-0 flex-1">{header}</div>
        <button onClick={close} aria-label={t('close')} className={iconBtn}>
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 ${footer ? 'pb-5' : 'pb-[max(1.5rem,env(safe-area-inset-bottom))]'}`}>{children}</div>
      {footer && <div className="shrink-0 border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </dialog>
  )
}

/** Closes the nearest sheet, playing its exit animation. */
export const closeSheet = (el: Element | null) => el?.closest('dialog')?.close()

export function Toaster() {
  const ref = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('')
  const [action, setAction] = useState<ToastAction>()
  useEffect(() => {
    let timer = 0
    const show = (e: Event) => {
      const { message, action } = (e as CustomEvent<{ message: string; action?: ToastAction }>).detail
      setMessage(message)
      setAction(action)
      ref.current?.hidePopover()
      ref.current?.showPopover()
      clearTimeout(timer)
      timer = setTimeout(() => ref.current?.hidePopover(), action ? 5000 : 3500)
    }
    addEventListener('toast', show)
    return () => removeEventListener('toast', show)
  }, [])
  return (
    <div
      ref={ref}
      popover="manual"
      role="status"
      className="toast inset-x-0 top-[max(1rem,env(safe-area-inset-top))] bottom-auto pixel mx-auto w-fit max-w-[calc(100%-2rem)] border-0 bg-white py-2.5 pr-2 pl-4 text-sm font-medium text-black shadow-lg"
    >
      <span className="flex items-center gap-3 pr-2">
        {message}
        {action && (
          <button
            onClick={() => {
              action.run()
              ref.current?.hidePopover()
            }}
            className="-my-1 -mr-2 rounded-md bg-black/10 px-3 py-1 font-semibold transition hover:bg-black/20 active:scale-95"
          >
            {action.label}
          </button>
        )}
      </span>
    </div>
  )
}

// A little emoji confetti pop at (x, y), drawn in the top layer above everything.
export function burst(x: number, y: number, emoji: string, count = 14) {
  if (reducedMotion()) return
  const host = document.createElement('div')
  host.className = 'burst'
  host.popover = 'manual'
  host.style.left = `${x}px`
  host.style.top = `${y}px`
  for (let i = 0; i < count; i++) {
    const e = i % 3 ? emoji : '✨'
    const src = spriteOf(e)
    const s = document.createElement(src ? 'img' : 'span')
    if (s instanceof HTMLImageElement && src) {
      s.src = src
      s.className = 'sprite'
    } else s.textContent = e
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
    const dist = 50 + Math.random() * (count > 14 ? 140 : 70)
    s.style.setProperty('--x', `${Math.cos(angle) * dist}px`)
    s.style.setProperty('--y', `${Math.sin(angle) * dist - 30}px`)
    s.style.setProperty('--r', `${Math.random() * 360 - 180}deg`)
    host.append(s)
  }
  document.body.append(host)
  host.showPopover()
  setTimeout(() => host.remove(), 1000)
}

export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-sm text-mute">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-10 shrink-0 rounded-[5px] bg-line transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-[3px] after:bg-white after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  )
}

export function Splash() {
  return (
    <div className="grid h-dvh place-items-center">
      <Logo className="size-14 animate-pulse motion-reduce:animate-none" />
    </div>
  )
}

/** Segmented control, used for tabs and either/or choices. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg bg-well p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition active:scale-95 ${
            o.value === value ? 'bg-line text-ink' : 'text-mute hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
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

export function Avatar({ name, color, size = 26 }: { name: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="pixel inline-grid shrink-0 place-items-center font-display font-semibold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.46, background: color }}
    >
      {initials(name) || '?'}
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
