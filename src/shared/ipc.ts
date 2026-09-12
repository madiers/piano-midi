/**
 * The IPC contract between main and renderer.
 *
 * Kept in one file so both sides import the same names and types — a renamed
 * channel then fails at compile time instead of silently going nowhere.
 */

import type { AppSettings, UserProgress } from './types'

/** Recursive partial — settings are patched a few nested fields at a time. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export const IPC = {
  // Settings + progress persistence
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  progressGet: 'progress:get',
  progressSet: 'progress:set',
  progressReset: 'progress:reset',

  // Audio assets
  audioManifest: 'audio:manifest',

  // App / window
  appInfo: 'app:info',
  openExternal: 'app:openExternal',
  showItemInFolder: 'app:showItemInFolder',

  // Updates
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstall: 'update:install',
  updateState: 'update:state' // main -> renderer push
} as const

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  platform: NodeJS.Platform
  arch: string
  isPackaged: boolean
  /** Where the samples live, as an asset:// URL base. */
  audioBaseUrl: string
  userDataPath: string
}

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  /**
   * The build cannot update itself in place — currently this means an
   * unsigned macOS build. We still tell the user a release exists and send
   * them to the download page.
   */
  | 'manual-required'

export interface UpdateState {
  phase: UpdatePhase
  currentVersion: string
  /** Set once we know a newer version exists. */
  availableVersion?: string
  /** 0-100 while downloading. */
  percent?: number
  bytesPerSecond?: number
  releaseNotes?: string
  releaseUrl?: string
  error?: string
  /** True when auto-update is disabled for this build (dev, or unsigned mac). */
  autoUpdateSupported: boolean
}

export interface AudioSampleEntry {
  file: string
  midi: number
}

export interface AudioLayer {
  velocity: number
  dir: string
  samples: AudioSampleEntry[]
}

export interface AudioManifest {
  layers: AudioLayer[]
  attribution: {
    name: string
    author: string
    license: string
    licenseUrl: string
    source: string
    repackagedBy: string
  }
}

/** The surface the preload script exposes on `window.api`. */
export interface RendererApi {
  getSettings(): Promise<AppSettings>
  setSettings(patch: DeepPartial<AppSettings>): Promise<AppSettings>
  getProgress(): Promise<UserProgress>
  setProgress(progress: UserProgress): Promise<UserProgress>
  resetProgress(): Promise<UserProgress>

  getAudioManifest(): Promise<AudioManifest | null>
  getAppInfo(): Promise<AppInfo>
  openExternal(url: string): Promise<void>

  checkForUpdates(): Promise<UpdateState>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
  onUpdateState(listener: (state: UpdateState) => void): () => void
}
