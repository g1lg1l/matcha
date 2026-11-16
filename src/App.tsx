import { Create } from './Create'
import { Home } from './Home'
import { useLang } from './i18n'
import { useRoute } from './router'
import { LocalTournament, OnlineTournament } from './TournamentPage'
import { Toaster } from './ui'

export default function App() {
  useLang() // re-render everything when the language changes
  const route = useRoute()
  return (
    <>
      {route.page === 'new' ? (
        <Create />
      ) : route.page === 'local' ? (
        <LocalTournament key={route.id} id={route.id} />
      ) : route.page === 'online' ? (
        <OnlineTournament key={route.code} code={route.code} />
      ) : (
        <Home />
      )}
      <Toaster />
    </>
  )
}
