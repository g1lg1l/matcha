import type { CSSProperties } from 'react'

// Icons from Iconify, bundled at build time by @iconify/tailwind4 (so they work offline and in the apps).
// Everything is a real icon, never an emoji: Pixelarticons and Streamline Pixel for the pixel-art look, and
// Material Design Icons for the sports no pixel set draws. Medals are drawn here, as pixel badges.
// Class names must stay literal strings here: Tailwind only generates the icons it can find in the source.

const ui = {
  add: 'icon-[pixelarticons--plus]',
  minus: 'icon-[pixelarticons--minus]',
  close: 'icon-[pixelarticons--close]',
  crown: 'icon-[pixelarticons--crown]',
  cloud: 'icon-[pixelarticons--cloud]',
  offline: 'icon-[pixelarticons--cloud-moon]',
  share: 'icon-[pixelarticons--share]',
  iosShare: 'icon-[pixelarticons--upload]',
  flag: 'icon-[pixelarticons--flag]',
  check: 'icon-[pixelarticons--check]',
  back: 'icon-[pixelarticons--arrow-left]',
  next: 'icon-[pixelarticons--chevron-right]',
  up: 'icon-[pixelarticons--chevron-up]',
  down: 'icon-[pixelarticons--chevron-down]',
  stars: 'icon-[pixelarticons--sparkles]',
  phone: 'icon-[pixelarticons--device-phone]',
  shuffle: 'icon-[pixelarticons--shuffle]',
  settings: 'icon-[pixelarticons--settings-cog]',
  restart: 'icon-[pixelarticons--reload]',
  link: 'icon-[pixelarticons--link]',
  eye: 'icon-[pixelarticons--eye]',
  copy: 'icon-[pixelarticons--copy]',
  github: 'icon-[pixelarticons--github]',
  bug: 'icon-[pixelarticons--bug]',
  external: 'icon-[pixelarticons--external-link]',
  trash: 'icon-[pixelarticons--trash]',
  save: 'icon-[pixelarticons--save]',
  play: 'icon-[pixelarticons--play]',
  pause: 'icon-[pixelarticons--pause]',
  search: 'icon-[pixelarticons--search]',
  list: 'icon-[pixelarticons--list]',
  trophy: 'icon-[pixelarticons--trophy]',
  bracket: 'icon-[pixelarticons--git-branch]',
  users: 'icon-[pixelarticons--users]',
  userPlus: 'icon-[pixelarticons--user-plus]',
  userX: 'icon-[pixelarticons--user-x]',
  undo: 'icon-[pixelarticons--undo]',
  home: 'icon-[pixelarticons--home]',
  edit: 'icon-[pixelarticons--edit]',
  go: 'icon-[pixelarticons--arrow-right]',
  download: 'icon-[pixelarticons--download]',
  sliders: 'icon-[pixelarticons--sliders]',
  clock: 'icon-[pixelarticons--clock]',
  globe: 'icon-[pixelarticons--globe]',
  info: 'icon-[pixelarticons--info-box]',
  gamepad: 'icon-[pixelarticons--gamepad]',
  vibrate: 'icon-[pixelarticons--device-vibrate]',
} as const

export type IconName = keyof typeof ui

/** A UI icon in the current text colour. Decorative unless it gets a label. */
export function Icon({ name, size = 20, className = '', label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`${ui[name]} shrink-0 ${className}`}
      style={{ width: px(size), height: px(size) }}
    />
  )
}

// a 24-grid icon is crisp at 24 and 48; small ones go to 18 (three quarters) rather than blur at 20
const px = (size: number) => (size >= 21 ? Math.round(size / 24) * 24 || 24 : size >= 16 ? 18 : size)

// Pictures, keyed by the emoji a tournament stores (its picture, its format, little decorations).
// The keys are only names: what shows is the icon, in its own colour.
const GOLD = '#ffc83d'
const LIME = '#c6f24e'
const WHITE = '#f2f2f2'
const RED = '#ff5a4f'
const ORANGE = '#ff8a3d'
const SKY = '#5cc8ff'
const PINK = '#ff6fae'
const pictures: Record<string, [string, string]> = {
  '🏆': ['icon-[streamline-pixel--interface-essential-trophy]', GOLD],
  '👑': ['icon-[pixelarticons--crown]', GOLD],
  '⚽': ['icon-[mdi--soccer]', WHITE],
  '🏀': ['icon-[mdi--basketball]', ORANGE],
  '🎾': ['icon-[mdi--tennis-ball]', LIME],
  '🏓': ['icon-[mdi--table-tennis]', RED],
  '🏸': ['icon-[mdi--badminton]', WHITE],
  '🏐': ['icon-[mdi--volleyball]', GOLD],
  '🥊': ['icon-[mdi--boxing-glove]', RED],
  '🎳': ['icon-[mdi--bowling]', WHITE],
  '🎱': ['icon-[streamline-pixel--entertainment-events-hobbies-game-pool-snooker-ball]', WHITE],
  '⛳': ['icon-[mdi--golf]', LIME],
  '🎯': ['icon-[pixelarticons--bullseye]', RED],
  '🏎': ['icon-[pixelarticons--car]', RED],
  '🎮': ['icon-[pixelarticons--gamepad]', SKY],
  '🎲': ['icon-[pixelarticons--dice]', WHITE],
  '♟': ['icon-[streamline-pixel--entertainment-events-hobbies-chess-pawn]', WHITE],
  '🃏': ['icon-[streamline-pixel--entertainment-events-hobbies-card-game-card-club]', WHITE],
  '🧩': ['icon-[mdi--puzzle]', LIME],
  '🍵': ['icon-[pixelarticons--tea]', LIME],
  '⚔': ['icon-[pixelarticons--sword]', WHITE],
  '💕': ['icon-[pixelarticons--heart]', PINK],
  '🎡': ['icon-[pixelarticons--reload]', SKY],
  '📱': ['icon-[pixelarticons--device-phone]', WHITE],
  '☁': ['icon-[pixelarticons--cloud]', SKY],
  '🤝': ['icon-[streamline-pixel--business-products-deal-handshake]', GOLD],
  '🎉': ['icon-[pixelarticons--party-popper]', PINK],
  '🎊': ['icon-[pixelarticons--sparkles]', GOLD],
  '✨': ['icon-[pixelarticons--sparkle]', GOLD],
  '🌟': ['icon-[pixelarticons--star]', GOLD],
  '🌱': ['icon-[streamline-pixel--ecology-growth-plant]', LIME],
  '🎈': ['icon-[pixelarticons--balloon]', RED],
  '🥳': ['icon-[pixelarticons--mood-happy]', GOLD],
  '🍂': ['icon-[pixelarticons--leaf]', ORANGE],
  '👀': ['icon-[pixelarticons--eye]', WHITE],
  '👆': ['icon-[streamline-pixel--hand-point]', WHITE],
  '🫖': ['icon-[pixelarticons--tea]', LIME],
  '💤': ['icon-[pixelarticons--moon-stars]', SKY],
  '🔀': ['icon-[pixelarticons--shuffle]', SKY],
  '📈': ['icon-[pixelarticons--chart-line]', LIME],
  // more pictures for tournaments, under their Iconify names (see "any pixel icon" below): bundled, so they work offline
  'pixelarticons:goal': ['icon-[pixelarticons--goal]', WHITE],
  'pixelarticons:joystick': ['icon-[pixelarticons--joystick]', RED],
  'pixelarticons:human-run': ['icon-[pixelarticons--human-run]', ORANGE],
  'pixelarticons:flag': ['icon-[pixelarticons--flag]', RED],
  'pixelarticons:coins': ['icon-[pixelarticons--coins]', GOLD],
  'pixelarticons:fish': ['icon-[pixelarticons--fish]', SKY],
  'pixelarticons:star': ['icon-[pixelarticons--star]', GOLD],
}

// Any pixel icon: a tournament's picture can be any icon of Iconify's pixel-art sets, kept as "prefix:name".
// The ones above are bundled; the others are fetched once and remembered on this device, so they show offline too.
export const PIXEL_SETS = 'pixelarticons,streamline-pixel,memory,pixel'
const ICONS = 'matcha:icons'
const isIconName = (e: string) => /^[a-z0-9-]+:[a-z0-9-]+$/.test(e)
const remote = (name: string) => `https://api.iconify.design/${name.replace(':', '/')}.svg`
const fetched: Record<string, string> = (() => {
  try {
    return JSON.parse(localStorage.getItem(ICONS) ?? '{}')
  } catch {
    return {}
  }
})()
const asked = new Set<string>()
/** Keeps an icon from the network on this device, so that it shows offline. Asked for once per name. */
export async function rememberIcon(name: string) {
  if (!isIconName(name) || fetched[name] || pictures[name] || asked.has(name)) return
  asked.add(name)
  try {
    const svg = await (await fetch(remote(name))).text()
    if (!svg.startsWith('<svg')) return
    fetched[name] = `data:image/svg+xml,${encodeURIComponent(svg)}`
    localStorage.setItem(ICONS, JSON.stringify(fetched))
  } catch {
    /* offline: it comes from the network the next time it is shown */
  }
}
const medals: Record<string, [number, string]> = { '🥇': [1, GOLD], '🥈': [2, '#cfd6dd'], '🥉': [3, '#e0894a'] }

const key = (e: string) => e.replace(/\uFE0F/g, '')
/** The icon class and colour for a picture key; unknown ones (an old tournament, say) get the trophy. */
export const pictureOf = (e: string): [string, string] => pictures[key(e)] ?? pictures['🏆']

/** A picture as an icon, 1em wide so it sizes like text. Decorative unless it gets a label. `preview` is for one that is only offered, not chosen: it is not kept on the device. */
export function Emoji({ e, className = '', label, style, preview }: { e: string; className?: string; label?: string; style?: CSSProperties; preview?: boolean }) {
  const a11y = { role: label ? 'img' : undefined, 'aria-label': label, 'aria-hidden': label ? undefined : true }
  const medal = medals[key(e)]
  if (medal)
    return (
      <span {...a11y} className={`pixel inline-grid size-[1em] shrink-0 place-items-center align-[-0.15em] ${className}`} style={{ background: medal[1], ...style }}>
        <span className="font-display text-[0.6em] leading-none text-black">{medal[0]}</span>
      </span>
    )
  if (isIconName(e) && !pictures[e]) {
    if (!preview) void rememberIcon(e)
    const mask = `url("${fetched[e] ?? remote(e)}") center / 100% 100% no-repeat`
    return <span {...a11y} className={`inline-block size-[1em] shrink-0 align-[-0.15em] ${className}`} style={{ backgroundColor: LIME, mask, WebkitMask: mask, ...style }} />
  }
  const [cls, color] = pictureOf(e)
  return <span {...a11y} className={`${cls} inline-block size-[1em] shrink-0 align-[-0.15em] ${className}`} style={{ color, ...style }} />
}
