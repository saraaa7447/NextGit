import type { Api, Platform } from './types'

declare global {
  interface Window {
    api: Api
    platform?: Platform
  }
}

export {}
