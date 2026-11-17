import { AppSettings } from './AppSettings'
import { Create } from './Create'
import { Home } from './Home'
import { useLang } from './i18n'
import { useRoute } from './router'
import { LocalTournament, OnlineTournament } from './TournamentPage'
import GradualBlur from './bits/GradualBlur'
import { Sparks, Toaster } from './ui'

export default function App() {
  useLang() // re-render everything when the language changes
  const route = useRoute()
  return (
    <>
      <Sparks>
      {route.page === 'new' ? (
        <Create />
      ) : route.page === 'settings' ? (
        <AppSettings />
      ) : route.page === 'local' ? (
        <LocalTournament key={route.id} id={route.id} />
      ) : route.page === 'online' ? (
        <OnlineTournament key={route.code} code={route.code} referee={route.referee} />
      ) : (
        <Home />
      )}
      </Sparks>
      <GradualBlur target="page" position="bottom" height="env(safe-area-inset-bottom)" strength={1.5} layers={4} />
      <Toaster />
    </>
  )
}
