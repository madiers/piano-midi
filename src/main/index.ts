import { app, BrowserWindow, ipcMain, protocol, session, shell, net } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import log from 'electron-log'

import { IPC, type AppInfo, type AudioManifest } from '@shared/ipc'
import {
  DEFAULT_SETTINGS,
  createEmptyProgress,
  SETTINGS_SCHEMA_VERSION,
  PROGRESS_SCHEMA_VERSION,
  type AppSettings,
  type UserProgress
} from '@shared/types'
import { JsonStore, type DeepPartial } from './store'
import { UpdaterService } from './updater'

log.initialize()
log.transports.file.level = 'info'

/**
 * Samples are served over a custom `asset://` scheme rather than file://.
 *
 * Chromium blocks fetch() against file:// URLs from a file:// page, and the
 * samples are several megabytes of binary that we do not want to marshal
 * through IPC. A custom scheme gives us plain fetch() plus streaming, and
 * keeps everything local — the app makes no network requests for audio.
 */
const ASSET_SCHEME = 'asset'

protocol.registerSchemesAsPrivileged([
  {
    scheme: ASSET_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: false,
      // Without this, Chromium refuses to fetch asset:// from the renderer's
      // origin (file:// when packaged, http://localhost in dev) because a
      // custom scheme is not in its default cross-origin allowlist.
      corsEnabled: true
    }
  }
])

let settingsStore: JsonStore<AppSettings>
let progressStore: JsonStore<UserProgress>
let updater: UpdaterService
let mainWindow: BrowserWindow | null = null

/** Where bundled resources live, in dev and when packaged. */
function resourcesRoot(): string {
  // electron-builder copies `resources/audio` to `<resources>/audio`.
  return app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
}

function audioRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'audio') : join(resourcesRoot(), 'audio')
}

function registerAssetProtocol(): void {
  const root = audioRoot()

  protocol.handle(ASSET_SCHEME, async (request) => {
    // asset://audio/samples/v10/C4v10.mp3  ->  <audioRoot>/samples/v10/C4v10.mp3
    let pathname: string
    try {
      const url = new URL(request.url)
      pathname = decodeURIComponent(url.pathname)
      if (url.hostname && url.hostname !== 'audio') {
        return new Response('Not found', { status: 404 })
      }
    } catch {
      return new Response('Bad request', { status: 400 })
    }

    const relative = pathname.replace(/^\/+/, '')

    // Refuse anything that tries to climb out of the audio directory.
    const resolved = join(root, relative)
    if (!resolved.startsWith(root)) {
      log.warn('[asset] blocked traversal attempt:', request.url)
      return new Response('Forbidden', { status: 403 })
    }
    if (!existsSync(resolved)) {
      return new Response('Not found', { status: 404 })
    }

    const response = await net.fetch(pathToFileURL(resolved).toString())
    // The renderer's origin (file:// packaged, http://localhost in dev) is
    // cross-origin to asset://, so the response must opt in explicitly.
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return new Response(response.body, { status: response.status, headers })
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Piano MIDI',
    backgroundColor: '#0d1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Audio must be allowed to start without a click so the first key press
      // makes a sound. Electron defaults this to false already, but be explicit.
      autoplayPolicy: 'no-user-gesture-required',
      // Web MIDI lives only in the renderer, and Chromium throttles timers and
      // requestAnimationFrame in occluded windows. For a piano app that means
      // note handling degrades the moment the window loses focus.
      backgroundThrottling: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Renderer console goes to the main log too, so a user reporting a problem
  // can send one file instead of opening devtools.
  mainWindow.webContents.on('console-message', (event) => {
    log.info(`[renderer/${event.level}] ${event.message}`)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Dev utility: PIANO_MIDI_CAPTURE=<path> screenshots the window and exits.
  // Used to verify rendering without needing screen-recording permission.
  if (process.env.PIANO_MIDI_CAPTURE) {
    const target = process.env.PIANO_MIDI_CAPTURE
    const delay = Number(process.env.PIANO_MIDI_CAPTURE_DELAY ?? 6000)
    setTimeout(() => {
      void mainWindow?.webContents.capturePage().then(async (image) => {
        const { writeFile } = await import('node:fs/promises')
        await writeFile(target, image.toPNG())
        log.info('[capture] wrote', target)
        app.quit()
      })
    }, delay)
  }

  updater.attach(mainWindow)
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * Permissions.
 *
 * This is an explicit allowlist, NOT a "grant midi, deny everything else"
 * handler — that shape silently breaks fullscreen, clipboard and external
 * links, and the failure is invisible until a user hits it. Each entry here is
 * a deliberate decision; everything not listed is denied.
 */
const ALLOWED_PERMISSIONS = new Set([
  'midi',
  // 'midiSysex' is NOT optional, despite us calling requestMIDIAccess with
  // { sysex: false }. Electron routes the whole Web MIDI permission through
  // midiSysex, so denying it fails the request outright with
  // "NotAllowedError: Permission to use Web MIDI API was not granted" — and
  // the app then looks like it simply cannot see your keyboard. Verified by
  // launching the built app and watching the request fail.
  // We still never ask for sysex data, so no SysEx messages are delivered.
  'midiSysex',
  'fullscreen',
  'clipboard-sanitized-write'
])

function configureSession(): void {
  const ses = session.defaultSession

  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ALLOWED_PERMISSIONS.has(permission)
    if (!allowed) log.info(`[permissions] denied: ${permission}`)
    callback(allowed)
  })

  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))

  // A tight CSP. 'unsafe-inline' for styles is needed because Vite injects
  // style tags; scripts stay strict.
  ses.webRequest.onHeadersReceived((details, callback) => {
    if (is.dev) return callback({ responseHeaders: details.responseHeaders })
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            `img-src 'self' data: ${ASSET_SCHEME}:`,
            `media-src 'self' ${ASSET_SCHEME}: blob:`,
            `connect-src 'self' ${ASSET_SCHEME}:`,
            "font-src 'self' data:",
            "object-src 'none'",
            "base-uri 'none'",
            "form-action 'none'"
          ].join('; ')
        ]
      }
    })
  })
}

function readAudioManifest(): AudioManifest | null {
  const file = join(audioRoot(), 'manifest.json')
  if (!existsSync(file)) {
    log.warn('[audio] no manifest at', file, '- run `npm run assets`')
    return null
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as AudioManifest
  } catch (err) {
    log.error('[audio] manifest unreadable:', err)
    return null
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.settingsGet, () => settingsStore.read())

  ipcMain.handle(IPC.settingsSet, (_e, patch: DeepPartial<AppSettings>) =>
    settingsStore.patch(patch)
  )

  ipcMain.handle(IPC.progressGet, () => progressStore.read())

  ipcMain.handle(IPC.progressSet, (_e, progress: UserProgress) => progressStore.write(progress))

  ipcMain.handle(IPC.progressReset, () => progressStore.reset())

  ipcMain.handle(IPC.audioManifest, () => readAudioManifest())

  ipcMain.handle(IPC.appInfo, (): AppInfo => {
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
      audioBaseUrl: `${ASSET_SCHEME}://audio/`,
      userDataPath: app.getPath('userData')
    }
  })

  ipcMain.handle(IPC.openExternal, async (_e, url: string) => {
    // Only ever open http(s) — never file:// or a custom scheme from renderer input.
    if (!/^https?:\/\//i.test(url)) {
      log.warn('[openExternal] refused:', url)
      return
    }
    await shell.openExternal(url)
  })

  ipcMain.handle(IPC.updateCheck, () => updater.check())
  ipcMain.handle(IPC.updateDownload, () => updater.download())
  ipcMain.handle(IPC.updateInstall, () => updater.install())
}

// Only one instance — two copies fighting over the same MIDI port is a
// confusing failure for the user.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.madiers.pianomidi')

    settingsStore = new JsonStore<AppSettings>('settings.json', DEFAULT_SETTINGS, (raw) => {
      const value = raw as Partial<AppSettings>
      if (!value || typeof value !== 'object') return null
      if (value.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
        log.info('[store] migrating settings from version', value.schemaVersion)
      }
      return value as AppSettings
    })

    progressStore = new JsonStore<UserProgress>('progress.json', createEmptyProgress(), (raw) => {
      const value = raw as Partial<UserProgress>
      if (!value || typeof value !== 'object') return null
      if (value.schemaVersion !== PROGRESS_SCHEMA_VERSION) {
        log.info('[store] migrating progress from version', value.schemaVersion)
      }
      return value as UserProgress
    })

    updater = new UpdaterService()

    configureSession()
    registerAssetProtocol()
    registerIpc()

    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    // Give the window a moment to settle before doing network work.
    setTimeout(() => {
      if (settingsStore.read().updates.autoCheck) void updater.check()
    }, 4000)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
