import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { I18nProvider } from './lib/i18n'
import './styles/global.css'

if ('serviceWorker' in navigator && !import.meta.env.PROD) {
  // Dev: tear down any stale service worker and clear its caches so the
  // phone never keeps running cached old modules after a refresh. In prod the
  // vite-plugin-pwa virtual module registers the generated service worker.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  })
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
