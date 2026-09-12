import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { noteName } from '../music/pitch'
import { GRADING_PROFILES, appliedInputOffset } from '../lessons/grading'

type Stage = 'idle' | 'range-low' | 'range-high' | 'latency' | 'done'

const LATENCY_BPM = 100
const LATENCY_BEATS = 20
/** The first few taps are the student finding the pulse, not timing data. */
const LATENCY_WARMUP = 4

export function CalibrationPanel(): React.JSX.Element {
  const { settings, updateSettings, addMidiTap, audio, devices, activeDeviceId } = useAppStore()

  const [stage, setStage] = useState<Stage>('idle')
  const [low, setLow] = useState<number | null>(null)
  const [high, setHigh] = useState<number | null>(null)
  const [taps, setTaps] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  const errorsRef = useRef<number[]>([])
  const clickTimesRef = useRef<number[]>([])
  const stageRef = useRef<Stage>('idle')
  stageRef.current = stage

  const finishLatency = useCallback(() => {
    audio.metronome.stop()
    audio.metronome.onTick = null

    const errors = errorsRef.current
    if (errors.length < 6) {
      setMessage('Not enough taps to measure — try again and tap on every click.')
      setStage('idle')
      return
    }

    const sorted = [...errors].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]!
    const deviations = sorted.map((e) => Math.abs(e - median)).sort((a, b) => a - b)
    const mad = deviations[Math.floor(deviations.length / 2)]!

    // Too scattered to be a measurement of anything.
    if (mad > 80) {
      setMessage(
        `Your taps varied a lot (±${Math.round(mad)} ms), so this measurement would not be reliable. Try again, listening to the click rather than playing along with it.`
      )
      setStage('idle')
      return
    }

    const clamped = Math.max(-120, Math.min(120, median))
    const profile = GRADING_PROFILES[settings.practice.gradingProfile]
    const { applied, residual } = appliedInputOffset(clamped, profile)

    void updateSettings({
      calibration: {
        deviceId: activeDeviceId,
        deviceName: devices.find((d) => d.id === activeDeviceId)?.name ?? null,
        deviceLow: low ?? 48,
        deviceHigh: high ?? 72,
        keyCount: (high ?? 72) - (low ?? 48) + 1,
        inputOffsetMs: clamped,
        calibratedAt: new Date().toISOString()
      }
    })

    setStage('done')
    setMessage(
      residual === 0
        ? `Measured ${Math.round(clamped)} ms. Applied in full on the beginner profile.`
        : `Measured ${Math.round(clamped)} ms. ${Math.abs(Math.round(applied))} ms of that looks like hardware and is corrected; the remaining ${Math.abs(Math.round(residual))} ms is you playing ${residual < 0 ? 'ahead of' : 'behind'} the beat, which is normal and worth knowing about.`
    )
  }, [activeDeviceId, audio, devices, high, low, settings.practice.gradingProfile, updateSettings])

  // Capture MIDI for whichever calibration stage is active.
  useEffect(() => {
    return addMidiTap((event) => {
      if (event.type !== 'noteon') return
      const current = stageRef.current

      if (current === 'range-low') {
        setLow(event.note)
        setStage('range-high')
        return
      }

      if (current === 'range-high') {
        setHigh(event.note)
        setStage('idle')
        setMessage('Range captured. Now run the timing test.')
        return
      }

      if (current === 'latency') {
        const clicks = clickTimesRef.current
        if (clicks.length === 0) return
        // Which click was this tap aiming at? The nearest one.
        let nearest = clicks[0]!
        for (const t of clicks) {
          if (Math.abs(event.time - t) < Math.abs(event.time - nearest)) nearest = t
        }
        errorsRef.current.push(event.time - nearest)
        setTaps(errorsRef.current.length)
      }
    })
  }, [addMidiTap])

  const startLatency = useCallback(() => {
    errorsRef.current = []
    clickTimesRef.current = []
    setTaps(0)
    setMessage(null)
    setStage('latency')

    void audio.resume()
    audio.metronome.setTempo(LATENCY_BPM)
    audio.metronome.setTimeSignature(4)

    let beat = 0
    audio.metronome.onTick = (tick) => {
      beat += 1
      // Convert the scheduled audio time onto the performance clock, which is
      // what MIDI event timestamps use.
      if (beat > LATENCY_WARMUP) {
        clickTimesRef.current.push(audio.contextToPerformanceMs(tick.time))
      }
      if (beat >= LATENCY_BEATS) {
        setTimeout(finishLatency, 600)
      }
    }
    audio.metronome.start()
  }, [audio, finishLatency])

  const calibration = settings.calibration

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-850 p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink-100">Calibration</h2>
      <p className="mb-4 text-xs text-ink-400">
        Teaches the app how much keyboard you have and how long your setup takes to respond, so
        timing scores reflect your playing rather than your hardware.
      </p>

      {calibration && stage === 'idle' && (
        <div className="mb-4 rounded-lg border border-ink-700 bg-ink-800 p-3 text-xs text-ink-300">
          <div>
            Range: {noteName(calibration.deviceLow)} – {noteName(calibration.deviceHigh)} (
            {calibration.keyCount} keys)
          </div>
          <div>Input offset: {Math.round(calibration.inputOffsetMs)} ms</div>
        </div>
      )}

      {stage === 'range-low' && (
        <Prompt>Play your <strong>lowest</strong> key.</Prompt>
      )}
      {stage === 'range-high' && (
        <Prompt>
          Got {low !== null ? noteName(low) : ''}. Now play your <strong>highest</strong> key.
        </Prompt>
      )}
      {stage === 'latency' && (
        <Prompt>
          Tap any key on every click — {taps} of about {LATENCY_BEATS - LATENCY_WARMUP} recorded.
        </Prompt>
      )}

      {message && <p className="mb-4 text-xs text-ink-300">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setLow(null)
            setHigh(null)
            setMessage(null)
            setStage('range-low')
          }}
          className="rounded border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-700"
        >
          Measure key range
        </button>
        <button
          onClick={startLatency}
          disabled={stage === 'latency'}
          className="rounded border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-700 disabled:opacity-50"
        >
          Measure timing
        </button>
        {stage !== 'idle' && stage !== 'done' && (
          <button
            onClick={() => {
              audio.metronome.stop()
              audio.metronome.onTick = null
              setStage('idle')
              setMessage(null)
            }}
            className="rounded border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-ink-400 hover:bg-ink-700"
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  )
}

function Prompt({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mb-4 rounded-lg border border-brand-600/40 bg-brand-600/10 p-4 text-sm text-ink-100">
      {children}
    </div>
  )
}
