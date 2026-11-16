// Hash routing: works the same on GitHub Pages and inside the native app's web view.
//   #/            home
//   #/new         new tournament
//   #/t/<id>      a tournament kept on this device
//   #/s/<code>    an online tournament (its share link)
import { useSyncExternalStore } from 'react'

export type Route = { page: 'home' } | { page: 'new' } | { page: 'local'; id: string } | { page: 'online'; code: string }

export function parse(hash: string): Route {
  const [a, b] = hash.replace(/^#\/?/, '').split('/')
  if (a === 'new') return { page: 'new' }
  if (a === 't' && b) return { page: 'local', id: decodeURIComponent(b) }
  if (a === 's' && b) return { page: 'online', code: decodeURIComponent(b) }
  return { page: 'home' }
}

export const href = (r: Route) =>
  r.page === 'home' ? '#/' : r.page === 'new' ? '#/new' : r.page === 'local' ? `#/t/${encodeURIComponent(r.id)}` : `#/s/${encodeURIComponent(r.code)}`

export function go(r: Route, replace = false) {
  if (replace) {
    history.replaceState(null, '', href(r))
    dispatchEvent(new HashChangeEvent('hashchange'))
  } else location.hash = href(r)
}

export function useRoute() {
  const hash = useSyncExternalStore(
    (l) => {
      addEventListener('hashchange', l)
      return () => removeEventListener('hashchange', l)
    },
    () => location.hash,
  )
  return parse(hash)
}
