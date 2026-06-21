import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from './app/store'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { LanguageProvider, getInitialLang } from './i18n'
import { applyTheme, getInitialTheme } from './theme'
import '@fontsource-variable/inter/index.css'
import './index.css'

// Apply the persisted/system theme before first paint to avoid a flash.
applyTheme(getInitialTheme())
document.documentElement.lang = getInitialLang()

// Register the service worker for PWA install + offline app shell. Production
// only, so dev never serves stale cached assets. Same worker also powers push.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <LanguageProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </LanguageProvider>
    </Provider>
  </StrictMode>,
)
