import { useSyncExternalStore } from 'react'

export type Lang = 'it' | 'en'

const en = {
  tagline: 'Tournaments with friends. Knockout, double elimination or round robin. Make the bracket, share the link, play.',
  yourTournaments: 'Your tournaments',
  newTournament: 'New tournament',
  firstTournament: 'Start your first tournament',
  openLink: 'Got a link from a friend?',
  openLinkHint: 'Paste the link or the code',
  open: 'Open',
  badLink: "That link doesn't look right.",
  installTitle: 'Put Matcha on your home screen',
  installHint: 'It opens full screen, like an app.',
  installIos: 'Tap {share} then “Add to Home Screen”.',
  install: 'Install',
  language: 'Language',

  // formats
  single: 'Knockout',
  singleHint: 'Lose once and you’re out.',
  double: 'Double elimination',
  doubleHint: 'Lose once and drop to the losers bracket. Lose twice and you’re out.',
  roundrobin: 'Round robin',
  roundrobinHint: 'Everyone plays everyone. Most points wins.',

  // create
  back: 'Back',
  name: 'Name',
  namePlaceholder: 'e.g. Friday FIFA night',
  format: 'Format',
  options: 'Options',
  thirdPlace: '3rd place match',
  thirdPlaceHint: 'The semi-final losers play for bronze.',
  bracketReset: 'Grand final reset',
  bracketResetHint: 'If the losers-bracket player wins the final, play it once more: they both have one loss.',
  legs: 'Home and away',
  legsHint: 'Everyone plays everyone twice.',
  players: 'Players',
  playersCount: '{n} players',
  addPlayer: 'Add a player or team',
  addPlayerHint: 'Paste a list to add many at once.',
  add: 'Add',
  shuffle: 'Shuffle',
  seedHint: 'Order is the seeding: #1 and #2 only meet in the final.',
  moveUp: 'Move up',
  moveDown: 'Move down',
  remove: 'Remove',
  duplicate: '“{name}” is already in.',
  tooFew: 'Add at least 2 players.',
  tooMany: 'That’s the maximum: {n} players.',
  where: 'Where to keep it',
  local: 'On this device',
  localHint: 'Works offline. Only you see it.',
  online: 'Online',
  onlineHint: 'Share a link: friends follow the results live.',
  create: 'Create tournament',
  creating: 'Creating…',

  // tournament
  bracket: 'Bracket',
  matches: 'Matches',
  standings: 'Standings',
  winners: 'Winners bracket',
  losers: 'Losers bracket',
  finals: 'Finals',
  final: 'Final',
  semis: 'Semi-finals',
  quarters: 'Quarter-finals',
  roundN: 'Round {n}',
  grandFinal: 'Grand final',
  resetFinal: 'Grand final, again',
  thirdPlaceMatch: '3rd place',
  upNext: 'Up next',
  waiting: 'Waiting for',
  played: 'Played',
  nothingYet: 'No results yet.',
  allDone: 'All matches played!',
  bye: 'bye',
  tbd: 'TBD',
  winnerOf: 'Winner {m}',
  champion: 'Champion',
  wins: '{name} wins!',
  inProgress: 'In progress',
  notStarted: 'Not started',
  finishedShort: 'Finished',
  onlineBadge: 'Online',
  viewing: 'Watching',
  viewOnly: 'Only the organiser can enter results.',
  share: 'Share',
  linkCopied: 'Link copied',
  shareText: 'Follow “{name}” live on Matcha',
  settings: 'Settings',
  pos: '#',
  pts: 'Pts',
  pl: 'P',
  w: 'W',
  d: 'D',
  l: 'L',
  diff: '+/-',

  // result sheet
  result: 'Result',
  tapWinner: 'Tap the winner, scores are optional.',
  draw: 'Draw',
  winner: 'Winner',
  saveResult: 'Save result',
  clearResult: 'Clear result',
  needWinner: 'Pick a winner: a knockout match can’t end in a draw.',
  correctionWarn: 'Changing this result resets the later matches it affects.',
  score: 'Score of {name}',
  more: 'One more',
  less: 'One less',

  // settings
  rename: 'Tournament name',
  editPlayers: 'Edit players',
  playersLocked: 'Results are in, so players can only be renamed.',
  save: 'Save',
  publish: 'Put it online',
  publishHint: 'Get a link so friends can follow live. It moves from this device to the cloud.',
  publishing: 'Publishing…',
  published: 'It’s online! Share the link.',
  copyLink: 'Copy link',
  remove_t: 'Delete tournament',
  removeConfirm: 'Delete “{name}”? This can’t be undone.',
  unfollow: 'Remove from my list',
  deleted: 'Tournament deleted',
  close: 'Close',
  restart: 'Clear all results',
  restartConfirm: 'Clear every result of “{name}”?',

  // errors
  offline: "Can't reach the server. Check your connection.",
  notFound: "This tournament doesn't exist anymore, or the link is wrong.",
  goHome: 'Go to your tournaments',
  genericError: 'Something went wrong. Try again.',
  denied: "You don't have permission to do that.",
  tooBig: 'This tournament is too big to save online.',
  loading: 'Loading…',
}

type Dict = typeof en

const it: Dict = {
  tagline: 'Tornei con gli amici. Eliminazione diretta, doppia eliminazione o girone all’italiana. Crea il tabellone, condividi il link, si gioca.',
  yourTournaments: 'I tuoi tornei',
  newTournament: 'Nuovo torneo',
  firstTournament: 'Crea il tuo primo torneo',
  openLink: 'Un amico ti ha mandato un link?',
  openLinkHint: 'Incolla il link o il codice',
  open: 'Apri',
  badLink: 'Quel link non sembra giusto.',
  installTitle: 'Metti Matcha nella schermata Home',
  installHint: 'Si apre a schermo intero, come un’app.',
  installIos: 'Tocca {share} e poi “Aggiungi alla schermata Home”.',
  install: 'Installa',
  language: 'Lingua',

  single: 'Eliminazione diretta',
  singleHint: 'Perdi una volta e sei fuori.',
  double: 'Doppia eliminazione',
  doubleHint: 'Alla prima sconfitta scendi nel tabellone perdenti. Alla seconda sei fuori.',
  roundrobin: 'Girone all’italiana',
  roundrobinHint: 'Tutti contro tutti. Vince chi fa più punti.',

  back: 'Indietro',
  name: 'Nome',
  namePlaceholder: 'es. FIFA del venerdì',
  format: 'Formato',
  options: 'Opzioni',
  thirdPlace: 'Finale 3° posto',
  thirdPlaceHint: 'Chi perde in semifinale si gioca il bronzo.',
  bracketReset: 'Finalissima con rivincita',
  bracketResetHint: 'Se vince chi arriva dal tabellone perdenti, si rigioca: ora hanno una sconfitta a testa.',
  legs: 'Andata e ritorno',
  legsHint: 'Ognuno affronta tutti gli altri due volte.',
  players: 'Giocatori',
  playersCount: '{n} giocatori',
  addPlayer: 'Aggiungi un giocatore o una squadra',
  addPlayerHint: 'Incolla una lista per aggiungerne tanti insieme.',
  add: 'Aggiungi',
  shuffle: 'Mescola',
  seedHint: 'L’ordine è il seeding: #1 e #2 si incontrano solo in finale.',
  moveUp: 'Sposta su',
  moveDown: 'Sposta giù',
  remove: 'Rimuovi',
  duplicate: '“{name}” c’è già.',
  tooFew: 'Aggiungi almeno 2 giocatori.',
  tooMany: 'Massimo {n} giocatori.',
  where: 'Dove salvarlo',
  local: 'Su questo dispositivo',
  localHint: 'Funziona offline. Lo vedi solo tu.',
  online: 'Online',
  onlineHint: 'Condividi un link: gli amici seguono i risultati in diretta.',
  create: 'Crea torneo',
  creating: 'Creo…',

  bracket: 'Tabellone',
  matches: 'Partite',
  standings: 'Classifica',
  winners: 'Tabellone vincenti',
  losers: 'Tabellone perdenti',
  finals: 'Finali',
  final: 'Finale',
  semis: 'Semifinali',
  quarters: 'Quarti',
  roundN: 'Turno {n}',
  grandFinal: 'Finalissima',
  resetFinal: 'Finalissima, rivincita',
  thirdPlaceMatch: '3° posto',
  upNext: 'Da giocare',
  waiting: 'In attesa',
  played: 'Giocate',
  nothingYet: 'Ancora nessun risultato.',
  allDone: 'Tutte le partite giocate!',
  bye: 'bye',
  tbd: 'Da definire',
  winnerOf: 'Vincente {m}',
  champion: 'Campione',
  wins: 'Vince {name}!',
  inProgress: 'In corso',
  notStarted: 'Da iniziare',
  finishedShort: 'Concluso',
  onlineBadge: 'Online',
  viewing: 'Spettatore',
  viewOnly: 'Solo l’organizzatore può inserire i risultati.',
  share: 'Condividi',
  linkCopied: 'Link copiato',
  shareText: 'Segui “{name}” in diretta su Matcha',
  settings: 'Impostazioni',
  pos: '#',
  pts: 'Pt',
  pl: 'G',
  w: 'V',
  d: 'N',
  l: 'P',
  diff: '+/-',

  result: 'Risultato',
  tapWinner: 'Tocca il vincitore, il punteggio è facoltativo.',
  draw: 'Pareggio',
  winner: 'Vincitore',
  saveResult: 'Salva risultato',
  clearResult: 'Cancella risultato',
  needWinner: 'Scegli un vincitore: a eliminazione non si può pareggiare.',
  correctionWarn: 'Se cambi questo risultato, le partite successive che dipendono da lui si azzerano.',
  score: 'Punteggio di {name}',
  more: 'Uno in più',
  less: 'Uno in meno',

  rename: 'Nome del torneo',
  editPlayers: 'Modifica giocatori',
  playersLocked: 'Ci sono già risultati: i giocatori si possono solo rinominare.',
  save: 'Salva',
  publish: 'Metti online',
  publishHint: 'Ottieni un link per farlo seguire agli amici in diretta. Si sposta da questo dispositivo al cloud.',
  publishing: 'Pubblico…',
  published: 'È online! Condividi il link.',
  copyLink: 'Copia link',
  remove_t: 'Elimina torneo',
  removeConfirm: 'Eliminare “{name}”? Non si può annullare.',
  unfollow: 'Togli dalla mia lista',
  deleted: 'Torneo eliminato',
  close: 'Chiudi',
  restart: 'Cancella tutti i risultati',
  restartConfirm: 'Cancellare tutti i risultati di “{name}”?',

  offline: 'Non riesco a raggiungere il server. Controlla la connessione.',
  notFound: 'Questo torneo non esiste più, oppure il link è sbagliato.',
  goHome: 'Vai ai tuoi tornei',
  genericError: 'Qualcosa è andato storto. Riprova.',
  denied: 'Non hai il permesso di farlo.',
  tooBig: 'Questo torneo è troppo grande per salvarlo online.',
  loading: 'Carico…',
}

export type Key = keyof Dict
const dicts: Record<Lang, Dict> = { it, en }

const KEY = 'matcha:lang'
function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'it' || saved === 'en') return saved
  } catch {
    /* storage blocked */
  }
  return navigator.languages?.some((l) => l.toLowerCase().startsWith('it')) ? 'it' : 'en'
}

let lang: Lang = initial()
const listeners = new Set<() => void>()
document.documentElement.lang = lang

export function setLang(next: Lang) {
  lang = next
  document.documentElement.lang = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* fine, just not remembered */
  }
  listeners.forEach((l) => l())
}

export const getLang = () => lang

export function t(key: Key, vars: Record<string, string | number> = {}) {
  return dicts[lang][key].replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? `{${v}}`))
}

/** Re-renders the caller when the language changes; returns t for convenience. */
export function useLang() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => lang,
  )
  return { t, lang }
}

export const dictionaries = dicts
