import { useState } from 'react'
import { useAppStore } from '../store/appStore'

/**
 * Update UI.
 *
 * The honest part: on an unsigned macOS build, electron-updater cannot install
 * an update in place, because Squirrel.Mac validates the code signature of the
 * replacement app. Rather than pretending otherwise and failing silently, that
 * case shows a "download" button that opens the releases page.
 */
export function UpdatePanel(): React.JSX.Element {
  const updateState = useAppStore((s) => s.updateState)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const appInfo = useAppStore((s) => s.appInfo)
  const [checking, setChecking] = useState(false)

  const phase = updateState?.phase ?? 'idle'

  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      await window.api.checkForUpdates()
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-850 p-5">
      <h2 className="mb-4 text-sm font-semibold text-ink-100">Updates</h2>

      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-sm text-ink-200">Check for updates automatically</div>
          <div className="mt-0.5 text-xs text-ink-500">
            Looks at this project&apos;s GitHub releases on startup.
          </div>
        </div>
        <button
          role="switch"
          aria-checked={settings.updates.autoCheck}
          onClick={() => void updateSettings({ updates: { autoCheck: !settings.updates.autoCheck } })}
          className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
            settings.updates.autoCheck ? 'bg-brand-600' : 'bg-ink-600'
          }`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white transition-transform ${
              settings.updates.autoCheck ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-ink-700 bg-ink-800 p-3 text-xs">
        {phase === 'checking' && <span className="text-ink-300">Checking…</span>}

        {phase === 'not-available' && (
          <span className="text-ink-300">
            You are on the latest version ({updateState?.currentVersion}).
          </span>
        )}

        {(phase === 'available' || phase === 'manual-required') && (
          <div className="space-y-2">
            <div className="text-good-500">
              Version {updateState?.availableVersion} is available.
            </div>
            {phase === 'manual-required' ? (
              <>
                <p className="text-ink-400">
                  This build is not code-signed, so macOS will not let it replace itself
                  automatically. Download the new version and drag it over the old one.
                </p>
                <button
                  onClick={() => void window.api.downloadUpdate()}
                  className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500"
                >
                  Open download page
                </button>
              </>
            ) : (
              <button
                onClick={() => void window.api.downloadUpdate()}
                className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500"
              >
                Download update
              </button>
            )}
          </div>
        )}

        {phase === 'downloading' && (
          <div>
            <div className="mb-1 text-ink-300">Downloading… {updateState?.percent ?? 0}%</div>
            <div className="h-1 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full bg-brand-500"
                style={{ width: `${updateState?.percent ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {phase === 'downloaded' && (
          <div className="space-y-2">
            <div className="text-good-500">Update ready.</div>
            <button
              onClick={() => void window.api.installUpdate()}
              className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500"
            >
              Restart and install
            </button>
          </div>
        )}

        {phase === 'error' && <span className="text-bad-500">{updateState?.error}</span>}

        {phase === 'idle' && (
          <span className="text-ink-400">
            {appInfo?.isPackaged
              ? 'No check run yet.'
              : 'Updates are disabled in a development build.'}
          </span>
        )}
      </div>

      <button
        onClick={() => void check()}
        disabled={checking || !appInfo?.isPackaged}
        className="mt-3 rounded border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-700 disabled:opacity-50"
      >
        {checking ? 'Checking…' : 'Check now'}
      </button>
    </section>
  )
}
