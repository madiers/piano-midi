/**
 * Auto-update via electron-updater against public GitHub Releases.
 *
 * What actually works, honestly:
 *
 *   Windows  Silent update works even UNSIGNED. electron-updater's
 *            NsisUpdater skips the Authenticode check when no `publisherName`
 *            is configured ("fail-open"). Users still see a SmartScreen
 *            warning on first install. This is current behaviour with no
 *            announced end date, but it is not a contract — if a future
 *            electron-updater fails closed, signing becomes mandatory.
 *
 *   Linux    AppImage updates work unsigned.
 *
 *   macOS    Silent update does NOT work unsigned. Squirrel.Mac validates the
 *            code signature of the downloaded app and refuses to swap in a
 *            build whose signature is missing or doesn't match. So on an
 *            unsigned mac build we deliberately do not attempt to download.
 *            We still CHECK for updates (reading latest-mac.yml needs no
 *            signature) and tell the user a new version exists, linking them
 *            to the release page. Setting a real Developer ID turns this into
 *            true silent updating with no other code change.
 *
 * Note also that mac.target must include `zip` alongside `dmg`: electron-updater
 * looks for a zip and explicitly excludes dmg and pkg, throwing
 * ERR_UPDATER_ZIP_FILE_NOT_FOUND otherwise. See electron-builder.yml.
 */

import { app, shell, type BrowserWindow } from 'electron'
import log from 'electron-log'
import electronUpdater, { type UpdateInfo } from 'electron-updater'
import { IPC, type UpdateState } from '@shared/ipc'

const { autoUpdater } = electronUpdater

const RELEASES_URL = 'https://github.com/madiers/piano-midi/releases/latest'

/**
 * Flipped on by the build when a Developer ID signing identity is configured.
 * Until then, macOS gets check-and-notify instead of silent install.
 */
const MAC_SIGNED_BUILD = process.env.PIANO_MIDI_MAC_SIGNED === '1'

export class UpdaterService {
  private window: BrowserWindow | null = null
  private state: UpdateState

  constructor() {
    this.state = {
      phase: 'idle',
      currentVersion: app.getVersion(),
      autoUpdateSupported: this.autoUpdateSupported()
    }

    autoUpdater.logger = log
    // We drive downloads explicitly so the UI can show a real progress bar and
    // so macOS can opt out cleanly.
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    this.wireEvents()
  }

  attach(window: BrowserWindow): void {
    this.window = window
    this.push()
  }

  getState(): UpdateState {
    return this.state
  }

  private autoUpdateSupported(): boolean {
    if (!app.isPackaged) return false
    if (process.platform === 'darwin') return MAC_SIGNED_BUILD
    return true
  }

  private wireEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.set({ phase: 'checking', error: undefined })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.set({
        phase: this.autoUpdateSupported() ? 'available' : 'manual-required',
        availableVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        releaseUrl: RELEASES_URL
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.set({ phase: 'not-available' })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.set({
        phase: 'downloading',
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond
      })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.set({ phase: 'downloaded', availableVersion: info.version, percent: 100 })
    })

    autoUpdater.on('error', (err) => {
      const message = err?.message ?? String(err)

      // A repository with no releases yet is the normal state before the first
      // tag, not a fault. Reporting it as an error trains people to ignore
      // updater errors, which is exactly when a real one gets missed.
      if (/No published versions/i.test(message)) {
        log.info('[updater] no releases published yet')
        this.set({ phase: 'not-available', error: undefined })
        return
      }

      log.error('[updater]', err)
      this.set({ phase: 'error', error: message })
    })
  }

  /**
   * Check for a newer release.
   *
   * Safe to call on an unsigned mac build — reading the release metadata needs
   * no signature; only *applying* an update does.
   */
  async check(): Promise<UpdateState> {
    if (!app.isPackaged) {
      this.set({
        phase: 'not-available',
        error: undefined
      })
      log.info('[updater] skipped: running unpackaged')
      return this.state
    }

    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      log.error('[updater] check failed', err)
      this.set({ phase: 'error', error: err instanceof Error ? err.message : String(err) })
    }
    return this.state
  }

  async download(): Promise<void> {
    if (!this.autoUpdateSupported()) {
      // On an unsigned mac build, send them to the download page instead of
      // pretending to install something Squirrel.Mac will reject.
      await shell.openExternal(this.state.releaseUrl ?? RELEASES_URL)
      return
    }
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      log.error('[updater] download failed', err)
      this.set({ phase: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  install(): void {
    if (!this.autoUpdateSupported()) {
      void shell.openExternal(this.state.releaseUrl ?? RELEASES_URL)
      return
    }
    autoUpdater.quitAndInstall()
  }

  private set(patch: Partial<UpdateState>): void {
    this.state = {
      ...this.state,
      ...patch,
      currentVersion: app.getVersion(),
      autoUpdateSupported: this.autoUpdateSupported()
    }
    this.push()
  }

  private push(): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send(IPC.updateState, this.state)
  }
}
