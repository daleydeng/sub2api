import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initI18n } from '@/i18n'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import App from './App'
import './index.css'

async function bootstrap() {
  // Initialize settings from injected config (prevents flash)
  const appStore = useAppStore.getState()
  appStore.initFromInjectedConfig()

  // Set document title
  if (appStore.siteName && appStore.siteName !== 'Sub2API') {
    document.title = `${appStore.siteName} - AI API Gateway`
  }

  // Initialize i18n
  await initI18n()

  // Restore auth state from localStorage
  useAuthStore.getState().checkAuth()

  // Mount React app
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
