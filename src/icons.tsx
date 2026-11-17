import type { CSSProperties } from 'react'

// Icons from Iconify, bundled at build time by @iconify/tailwind4 (so they work offline and in the apps).
// UI icons are Pixelarticons, drawn on a 24px pixel grid; pictures (trophies, medals, sports) are Fluent Emoji
// Flat shrunk to 16x16 pixel sprites by scripts/pixel-emoji.mjs (src/pixels.json), so they look the same on
// every phone instead of each system's own emoji font.
// Class names must stay literal strings here: Tailwind only generates the icons it can find in the source.
import pixels from './pixels.json'

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

// The Fluent Emoji Flat picture behind each sprite: scripts/pixel-emoji.mjs reads this list.
export const fluent: Record<string, string> = {
  '🏆': 'trophy',
  '🥇': '1st-place-medal',
  '🥈': '2nd-place-medal',
  '🥉': '3rd-place-medal',
  '👑': 'crown',
  '⚽': 'soccer-ball',
  '🏀': 'basketball',
  '🎾': 'tennis',
  '🏓': 'ping-pong',
  '🏸': 'badminton',
  '🏐': 'volleyball',
  '🥊': 'boxing-glove',
  '🎳': 'bowling',
  '🎱': 'pool-8-ball',
  '⛳': 'flag-in-hole',
  '🎯': 'bullseye',
  '🏎': 'racing-car',
  '🎮': 'video-game',
  '🎲': 'game-die',
  '♟': 'chess-pawn',
  '🃏': 'joker',
  '🧩': 'puzzle-piece',
  '🍵': 'teacup-without-handle',
  '⚔': 'crossed-swords',
  '💕': 'two-hearts',
  '🎡': 'ferris-wheel',
  '📱': 'mobile-phone',
  '☁': 'cloud',
  '🤝': 'handshake',
  '🎉': 'party-popper',
  '🎊': 'confetti-ball',
  '✨': 'sparkles',
  '🌟': 'glowing-star',
  '🌱': 'seedling',
  '🎈': 'balloon',
  '🥳': 'partying-face',
  '🍂': 'fallen-leaf',
  '👀': 'eyes',
  '👆': 'backhand-index-pointing-up',
  '🫖': 'teapot',
  '💤': 'zzz',
  '🔀': 'shuffle-tracks-button',
  '📈': 'chart-increasing',
}

const sprites: Record<string, string> = pixels

/** The pixel sprite (a PNG data URL) for an emoji, if we have it. Variation selectors don't matter. */
export const spriteOf = (e: string): string | undefined => sprites[e.replace(/️/g, '')]

/**
 * An emoji drawn as a pixel sprite, 1em wide so it sizes like text. Unknown emoji (an old tournament,
 * say) fall back to the system font.
 */
export function Emoji({ e, className = '', label, style }: { e: string; className?: string; label?: string; style?: CSSProperties }) {
  const src = spriteOf(e)
  if (!src) return <span className={`inline-block leading-none ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={style}>{e}</span>
  // the black pawn would vanish on the black ground: make it a white one
  const invert = e.startsWith('♟') ? 'invert' : ''
  return <img src={src} alt={label ?? ''} aria-hidden={label ? undefined : true} draggable={false} className={`sprite inline-block size-[1em] shrink-0 align-[-0.15em] ${invert} ${className}`} style={style} />
}
