import { App as Native } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Android's back button: close an open sheet first, then go back, then leave the app from home.
if (Capacitor.isNativePlatform()) {
  Native.addListener('backButton', () => {
    const sheet = document.querySelector<HTMLDialogElement>('dialog[open]')
    if (sheet) sheet.close()
    else if (!location.hash || location.hash === '#/') Native.exitApp()
    else if (history.length > 1) history.back()
    else location.hash = '#/'
  })
}

window.scrollTo(0, 0)
addEventListener('hashchange', () => window.scrollTo(0, 0))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
