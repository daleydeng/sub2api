import type { PublicSettings } from '.'

declare global {
  interface Window {
    __APP_CONFIG__?: PublicSettings
  }
}

export {}
