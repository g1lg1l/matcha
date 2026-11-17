// Hash routing: works the same on GitHub Pages and inside the native app's web view.
//   #/            home
//   #/new         new tournament
//   #/settings    the app's settings
//   #/t/<id>      a tournament kept on this device
//   #/s/<code>    an online tournament (its share link)
//   #/s/<code>/<referee>   the same, opened with the referee link
import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

export type Route = { page: 'home' } | { page: 'new' } | { page: 'settings' } | { page: 'local'; id: string } | { page: 'online'; code: string; referee?: string }

export function parse(hash: string): Route {
  const [a, b, c] = hash.replace(/^#\/?/, '').split('/')
  if (a === 'new') return { page: 'new' }
  if (a === 'settings') return { page: 'settings' }
  if (a === 't' && b) return { page: 'local', id: decodeURIComponent(b) }
  if (a === 's' && b) return { page: 'online', code: decodeURIComponent(b), referee: c ? decodeURIComponent(c) : undefined }
  return { page: 'home' }
}

export const href = (r: Route) =>
  r.page === 'home' ? '#/' : r.page === 'new' ? '#/new' : r.page === 'settings' ? '#/settings' : r.page === 'local' ? `#/t/${encodeURIComponent(r.id)}` : `#/s/${encodeURIComponent(r.code)}${r.referee ? `/${encodeURIComponent(r.referee)}` : ''}`

export function go(r: Route, replace = false) {
  if (replace) {
    history.replaceState(null, '', href(r))
    dispatchEvent(new HashChangeEvent('hashchange'))
  } else location.hash = href(r)
}

const depth = (hash: string) => (parse(hash).page === 'home' ? 0 : 1)

export function useRoute() {
  const hash = useSyncExternalStore(
    (l) => {
      // screens move like a native stack: a deeper one comes in from the right, going back from the left
      let from = location.hash
      const change = () => {
        const back = depth(location.hash) < depth(from)
        from = location.hash
        const swap = () => {
          flushSync(l)
          scrollTo(0, 0)
        }
        if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return swap()
        document.documentElement.dataset.nav = back ? 'back' : 'forward'
        // a hidden tab skips the animation and rejects: the swap itself has still run
        document.startViewTransition(swap).ready.catch(() => {})
      }
      addEventListener('hashchange', change)
      return () => removeEventListener('hashchange', change)
    },
    () => location.hash,
  )
  return parse(hash)
}
