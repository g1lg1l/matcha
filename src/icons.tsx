import type { CSSProperties } from 'react'

// Icons from Iconify, bundled at build time by @iconify/tailwind4 (so they work offline and in the apps).
// UI icons are Solar's two-tone set; pictures (trophies, medals, sports) are Fluent Emoji Flat, so they
// look the same on every phone instead of each system's own emoji font.
// Class names must stay literal strings here: Tailwind only generates the icons it can find in the source.

const ui = {
  add: 'icon-[solar--add-bold]',
  minus: 'icon-[solar--minus-bold]',
  close: 'icon-[solar--close-bold]',
  crown: 'icon-[solar--crown-bold-duotone]',
  cloud: 'icon-[solar--cloud-bold-duotone]',
  offline: 'icon-[solar--cloud-cross-bold-duotone]',
  share: 'icon-[solar--share-bold-duotone]',
  iosShare: 'icon-[solar--square-share-line-bold-duotone]',
  flag: 'icon-[solar--flag-bold-duotone]',
  check: 'icon-[solar--check-circle-bold]',
  back: 'icon-[solar--round-arrow-left-bold-duotone]',
  next: 'icon-[solar--alt-arrow-right-bold]',
  up: 'icon-[solar--round-alt-arrow-up-bold-duotone]',
  down: 'icon-[solar--round-alt-arrow-down-bold-duotone]',
  stars: 'icon-[solar--stars-bold-duotone]',
  phone: 'icon-[solar--smartphone-bold-duotone]',
  shuffle: 'icon-[solar--shuffle-bold-duotone]',
  settings: 'icon-[solar--settings-bold-duotone]',
  restart: 'icon-[solar--restart-bold-duotone]',
  link: 'icon-[solar--link-round-bold-duotone]',
  eye: 'icon-[solar--eye-bold-duotone]',
  copy: 'icon-[solar--copy-bold-duotone]',
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
      style={{ width: size, height: size }}
    />
  )
}

const fluent: Record<string, string> = {
  '🏆': 'icon-[fluent-emoji-flat--trophy]',
  '🥇': 'icon-[fluent-emoji-flat--1st-place-medal]',
  '🥈': 'icon-[fluent-emoji-flat--2nd-place-medal]',
  '🥉': 'icon-[fluent-emoji-flat--3rd-place-medal]',
  '👑': 'icon-[fluent-emoji-flat--crown]',
  '⚽': 'icon-[fluent-emoji-flat--soccer-ball]',
  '🏀': 'icon-[fluent-emoji-flat--basketball]',
  '🎾': 'icon-[fluent-emoji-flat--tennis]',
  '🏓': 'icon-[fluent-emoji-flat--ping-pong]',
  '🏸': 'icon-[fluent-emoji-flat--badminton]',
  '🏐': 'icon-[fluent-emoji-flat--volleyball]',
  '🥊': 'icon-[fluent-emoji-flat--boxing-glove]',
  '🎳': 'icon-[fluent-emoji-flat--bowling]',
  '🎱': 'icon-[fluent-emoji-flat--pool-8-ball]',
  '⛳': 'icon-[fluent-emoji-flat--flag-in-hole]',
  '🎯': 'icon-[fluent-emoji-flat--bullseye]',
  '🏎': 'icon-[fluent-emoji-flat--racing-car]',
  '🎮': 'icon-[fluent-emoji-flat--video-game]',
  '🎲': 'icon-[fluent-emoji-flat--game-die]',
  '♟': 'icon-[fluent-emoji-flat--chess-pawn]',
  '🃏': 'icon-[fluent-emoji-flat--joker]',
  '🧩': 'icon-[fluent-emoji-flat--puzzle-piece]',
  '🍵': 'icon-[fluent-emoji-flat--teacup-without-handle]',
  '⚔': 'icon-[fluent-emoji-flat--crossed-swords]',
  '💕': 'icon-[fluent-emoji-flat--two-hearts]',
  '🎡': 'icon-[fluent-emoji-flat--ferris-wheel]',
  '📱': 'icon-[fluent-emoji-flat--mobile-phone]',
  '☁': 'icon-[fluent-emoji-flat--cloud]',
  '🤝': 'icon-[fluent-emoji-flat--handshake]',
  '🎉': 'icon-[fluent-emoji-flat--party-popper]',
  '🎊': 'icon-[fluent-emoji-flat--confetti-ball]',
  '✨': 'icon-[fluent-emoji-flat--sparkles]',
  '🌟': 'icon-[fluent-emoji-flat--glowing-star]',
  '🌱': 'icon-[fluent-emoji-flat--seedling]',
  '🎈': 'icon-[fluent-emoji-flat--balloon]',
  '🥳': 'icon-[fluent-emoji-flat--partying-face]',
  '🍂': 'icon-[fluent-emoji-flat--fallen-leaf]',
  '👀': 'icon-[fluent-emoji-flat--eyes]',
  '👆': 'icon-[fluent-emoji-flat--backhand-index-pointing-up]',
  '🫖': 'icon-[fluent-emoji-flat--teapot]',
  '💤': 'icon-[fluent-emoji-flat--zzz]',
  '🔀': 'icon-[fluent-emoji-flat--shuffle-tracks-button]',
  '📈': 'icon-[fluent-emoji-flat--chart-increasing]',
}

/** The Fluent class for an emoji, if we have it. Variation selectors don't matter. */
export const emojiClass = (e: string): string | undefined => fluent[e.replace(/️/g, '')]

/**
 * An emoji drawn as a Fluent picture, 1em wide so it sizes like text. Unknown emoji (an old tournament,
 * say) fall back to the system font.
 */
export function Emoji({ e, className = '', label, style }: { e: string; className?: string; label?: string; style?: CSSProperties }) {
  const c = emojiClass(e)
  if (!c) return <span className={`inline-block leading-none ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={style}>{e}</span>
  return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`${c} inline-block shrink-0 align-[-0.15em] ${className}`} style={style} />
}
