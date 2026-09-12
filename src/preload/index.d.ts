import type { ElectronAPI } from '@electron-toolkit/preload'
import type { RendererApi } from '@shared/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    api: RendererApi
  }
}

export {}
