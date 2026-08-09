import type { Api } from './types'

declare global {
  interface Window {
    api: Api
  }
}

export {}
