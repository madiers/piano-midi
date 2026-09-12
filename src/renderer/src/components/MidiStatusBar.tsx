import { useState } from 'react'
import { useAppStore } from '../store/appStore'

/**
 * Top bar: connection state, device picker, octave shift.
 *
 * The empty state matters more than it looks. "No devices" is ambiguous —
 * a Bluetooth keyboard that the user believes is connected will not appear
 * until it is paired at the OS level (macOS surfaces BLE MIDI only after
 * pairing in Audio MIDI Setup), and on Linux a missing ALSA stack looks
 * identical to an unplugged cable. So we say what to actually check.
 */
export function MidiStatusBar(): React.JSX.Element {
  const {
    midiStatus,
    midiStatusDetail,
    devices,
    activeDeviceId,
    selectDevice,
    settings,
    setTranspose,
    audioStatus,
    audioProgress,
    audioError,
    audio
  } = useAppStore()

  const [showHelp, setShowHelp] = useState(false)

  const connected = devices.filter((d) => d.state === 'connected')
  const active = devices.find((d) => d.id === activeDeviceId)

  const statusColor =
    midiStatus === 'ready' && active
      ? 'bg-good-500'
      : midiStatus === 'ready'
        ? 'bg-warn-500'
        : midiStatus === 'requesting'
          ? 'bg-brand-500'
          : 'bg-bad-500'

  const statusText =
    midiStatus === 'requesting'
      ? 'Requesting MIDI access…'
      : midiStatus === 'denied'
        ? 'MIDI access denied'
        : midiStatus === 'unsupported'
          ? 'Web MIDI unavailable'
          : midiStatus === 'error'
            ? `MIDI error: ${midiStatusDetail ?? 'unknown'}`
            : active
              ? active.name
              : connected.length > 0
                ? 'No device selected'
                : 'No MIDI keyboard found'

  return (
    <header className="drag-region border-b border-ink-700 bg-ink-850">
      <div className="flex items-center gap-4 px-6 py-3 pl-20">
        <div className="no-drag flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusColor}`} />
          <span className="text-sm font-medium text-ink-100">{statusText}</span>
        </div>

        {connected.length > 0 && (
          <select
            className="no-drag rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-xs text-ink-200"
            value={settings.midi.preferredDeviceId ?? ''}
            onChange={(e) => selectDevice(e.target.value || null)}
          >
            <option value="">Auto-detect</option>
            {connected.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}

        <div className="no-drag flex items-center gap-1">
          <span className="text-xs text-ink-400">Octave</span>
          <button
            className="rounded border border-ink-600 bg-ink-800 px-2 py-0.5 text-xs text-ink-200 hover:bg-ink-700"
            onClick={() => setTranspose(settings.midi.transpose - 12)}
            aria-label="Shift down one octave"
          >
            −
          </button>
          <span className="w-8 text-center font-mono text-xs text-ink-200">
            {settings.midi.transpose === 0
              ? '0'
              : `${settings.midi.transpose > 0 ? '+' : ''}${settings.midi.transpose / 12}`}
          </span>
          <button
            className="rounded border border-ink-600 bg-ink-800 px-2 py-0.5 text-xs text-ink-200 hover:bg-ink-700"
            onClick={() => setTranspose(settings.midi.transpose + 12)}
            aria-label="Shift up one octave"
          >
            +
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-ink-400">
            {audioStatus === 'loading' && audioProgress
              ? `Loading piano ${audioProgress.loaded}/${audioProgress.total}`
              : audioStatus === 'ready-samples'
                ? `Piano ready · ${audio.getLatencyMs()} ms`
                : audioStatus === 'ready-synth'
                  ? 'Synth tone'
                  : ''}
          </span>
          {connected.length === 0 && midiStatus === 'ready' && (
            <button
              className="no-drag rounded border border-ink-600 bg-ink-800 px-2 py-1 text-xs text-brand-400 hover:bg-ink-700"
              onClick={() => setShowHelp((v) => !v)}
            >
              No keyboard?
            </button>
          )}
        </div>
      </div>

      {audioError && (
        <div className="border-t border-ink-700 bg-ink-800 px-6 py-2 text-xs text-warn-500">
          {audioError}
        </div>
      )}

      {showHelp && connected.length === 0 && (
        <div className="no-drag border-t border-ink-700 bg-ink-800 px-6 py-4 text-xs leading-relaxed text-ink-300">
          <p className="mb-2 font-semibold text-ink-100">
            Your keyboard isn&apos;t showing up. Things to check:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-ink-200">USB:</strong> make sure the cable is a data cable,
              not charge-only, and try a different port. Some controllers need to be plugged in
              before the app starts — the app will pick it up either way, but the keyboard itself
              may not power on mid-session.
            </li>
            <li>
              <strong className="text-ink-200">Bluetooth:</strong> macOS only shows a Bluetooth MIDI
              keyboard after you pair it in{' '}
              <em>Audio MIDI Setup → Window → Show MIDI Studio → Bluetooth</em>. Pairing it in
              System Settings alone is not enough.
            </li>
            <li>
              <strong className="text-ink-200">In use elsewhere:</strong> a DAW or another music app
              may be holding the port open. Quit it and the keyboard should appear here.
            </li>
          </ul>
          <p className="mt-3">
            The app watches for keyboards continuously, so plugging one in now will connect it
            automatically — no restart needed.
          </p>
        </div>
      )}
    </header>
  )
}
