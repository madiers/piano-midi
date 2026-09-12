import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC, type AppInfo, type AudioManifest, type RendererApi, type UpdateState } from '@shared/ipc'
import type { AppSettings, UserProgress } from '@shared/types'

/**
 * The renderer gets exactly this surface and nothing else — no ipcRenderer, no
 * Node. Every method is a named call, so the renderer can never reach a channel
 * the main process did not intend to expose.
 */
const api: RendererApi = {
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<AppSettings>,
  setSettings: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch) as Promise<AppSettings>,

  getProgress: () => ipcRenderer.invoke(IPC.progressGet) as Promise<UserProgress>,
  setProgress: (progress) => ipcRenderer.invoke(IPC.progressSet, progress) as Promise<UserProgress>,
  resetProgress: () => ipcRenderer.invoke(IPC.progressReset) as Promise<UserProgress>,

  getAudioManifest: () => ipcRenderer.invoke(IPC.audioManifest) as Promise<AudioManifest | null>,
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo) as Promise<AppInfo>,
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url) as Promise<void>,

  checkForUpdates: () => ipcRenderer.invoke(IPC.updateCheck) as Promise<UpdateState>,
  downloadUpdate: () => ipcRenderer.invoke(IPC.updateDownload) as Promise<void>,
  installUpdate: () => ipcRenderer.invoke(IPC.updateInstall) as Promise<void>,

  onUpdateState: (listener) => {
    const handler = (_event: unknown, state: UpdateState): void => listener(state)
    ipcRenderer.on(IPC.updateState, handler)
    return () => {
      ipcRenderer.removeListener(IPC.updateState, handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[preload] failed to expose API:', error)
  }
} else {
  // contextIsolation is on in this app; this branch exists only so a
  // misconfiguration fails loudly in development rather than silently.
  // @ts-expect-error -- assigning to window in the non-isolated case
  window.electron = electronAPI
  // @ts-expect-error -- see above
  window.api = api
}
