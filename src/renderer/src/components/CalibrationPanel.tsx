import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { noteName } from '../music/pitch'
import { CalibrationLessonPanel } from '../views/CalibrationLessonPanel'

type Mode = 'range' | 'octave' | 'latency'

/**
 * Re-run calibration from Settings.
 *
 * This deliberately reuses the Unit 0 lesson panels rather than reimplementing
 * them. The previous version was a separate copy that only wrote to settings at
 * the END of the latency test, so measuring your key range here and stopping
 * silently discarded it.
 */
export function CalibrationPanel(): React.JSX.Element {
  const calibration = useAppStore((s) => s.settings.calibration)
  const [mode, setMode] = useState<Mode | null>(null)

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-850 p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink-100">Calibration</h2>
      <p className="mb-4 text-xs text-ink-400">
        Teaches the app how much keyboard you have and how long your setup takes to respond, so
        timing scores reflect your playing rather than your hardware.
      </p>

      {calibration ? (
        <div className="mb-4 rounded-lg border border-ink-700 bg-ink-800 p-3 text-xs text-ink-300">
          <div>
            Range: {noteName(calibration.deviceLow)} – {noteName(calibration.deviceHigh)} (
            {calibration.keyCount} keys)
          </div>
          <div>Input offset: {Math.round(calibration.inputOffsetMs)} ms</div>
        </div>
      ) : (
        <p className="mb-4 text-xs text-warn-500">
          Not calibrated yet. Unit 0 walks through this, or run it here.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['range', 'Measure key range'],
            ['octave', 'Check octave'],
            ['latency', 'Measure timing']
          ] as Array<[Mode, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(mode === id ? null : id)}
            className={`rounded border px-3 py-1.5 text-xs ${
              mode === id
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-ink-600 bg-ink-800 text-ink-200 hover:bg-ink-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode && (
        <CalibrationLessonPanel
          exercise={{ kind: 'calibration', mode, targetLowNote: 48 }}
          onComplete={() => setMode(null)}
        />
      )}
    </section>
  )
}
