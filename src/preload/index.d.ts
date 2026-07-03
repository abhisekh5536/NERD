import type { WordCloneApi } from './index'

declare global {
  interface Window {
    api: WordCloneApi
  }
}

export {}
