import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalibrationExercise } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { noteName } from '../music/pitch'
import { GRADING_PROFILES, appliedInputOffset } from '../lessons/grading'

export interface CalibrationLessonPanelProps {
  exercise: CalibrationExercise
  onComplete: () => void
}

const LATENCY_BPM = 100
const LATENCY_BEATS = 20
/** The first few taps are the student finding the pulse, not timing data. */
const LATENCY_WARMUP = 4

/**
 * Unit 0's setup steps.
 *
 * These write to settings, which is why they cannot be a generic exercise:
 * an earlier version used a freePlay exercise here, which rendered nothing,
 * saved nothing, and left the lesson with no way to complete — the course was
 * impassable from lesson two.
 */
export function CalibrationLessonPanel({
  exercise,
  onComplete
}: CalibrationLessonPanelProps): React.JSX.Element {
  const { settings, updateSettings, addMidiTap, audio, devices, activeDeviceId } = useAppStore()

  switch (exercise.mode) {
    case 'range':
      return (
        <RangeStep
          onSaved={onComplete}
          save={(low, high) =>
            updateSettings({
              calibration: {
                deviceId: activeDeviceId,
                deviceName: devices.find((d) => d.id === activeDeviceId)?.name ?? null,
                deviceLow: low,
                deviceHigh: high,
                keyCount: high - low + 1,
                inputOffsetMs: settings.calibration?.inputOffsetMs ?? 0,
                calibratedAt: new Date().toISOString()
              }
            })
          }
          addMidiTap={addMidiTap}
        />
      )

    case 'octave':
      return (
        <OctaveStep
          target={exercise.targetLowNote ?? 48}
          transpose={settings.midi.transpose}
          setTranspose={(semitones) => updateSettings({ midi: { transpose: semitones } })}
          addMidiTap={addMidiTap}
          onDone={onComplete}
        />
      )

    case 'latency':
      return (
        <LatencyStep
          profileId={settings.practice.gradingProfile}
          audio={audio}
          addMidiTap={addMidiTap}
          save={(offsetMs) =>
            updateSettings({
              calibration: {
                deviceId: activeDeviceId,
                deviceName: devices.find((d) => d.id === activeDeviceId)?.name ?? null,
                deviceLow: settings.calibration?.deviceLow ?? 48,
                deviceHigh: settings.calibration?.deviceHigh ?? 72,
                keyCount: settings.calibration?.keyCount ?? 25,
                inputOffsetMs: offsetMs,
                calibratedAt: new Date().toISOString()
              }
            })
          }
          onDone={onComplete}
        />
      )
  }
}

// ------------------------------------------------------------------ range

function RangeStep({
  save,
  onSaved,
  addMidiTap
}: {
  save: (low: number, high: number) => Promise<void>
  onSaved: () => void
  addMidiTap: (tap: (event: { type: string; note?: number }) => void) => () => void
}): React.JSX.Element {
  const [low, setLow] = useState<number | null>(null)
  const [high, setHigh] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const lowRef = useRef<number | null>(null)

  useEffect(() => {
    return addMidiTap((event) => {
      if (event.type !== 'noteon' || event.note === undefined) return
      if (lowRef.current === null) {
        lowRef.current = event.note
        setLow(event.note)
      } else {
        setHigh(event.note)
      }
    })
  }, [addMidiTap])

  const reset = (): void => {
    lowRef.current = null
    setLow(null)
    setHigh(null)
    setSaved(false)
  }

  // A keyboard can be played in any order; sort so it is always low-then-high.
  const lowest = low !== null && high !== null ? Math.min(low, high) : low
  const highest = low !== null && high !== null ? Math.max(low, high) : null

  const confirm = async (): Promise<void> => {
    if (lowest === null || highest === null) return
    await save(lowest, highest)
    setSaved(true)
    onSaved()
  }

  return (
    <Panel>
      <Step done={low !== null} label="Play your LOWEST key">
        {low !== null && <Big>{noteName(lowest!)}</Big>}
      </Step>

      <Step done={high !== null} label="Now play your HIGHEST key">
        {highest !== null && <Big>{noteName(highest)}</Big>}
      </Step>

      {lowest !== null && highest !== null && (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-800 p-4">
          <p className="text-sm text-ink-200">
            {highest - lowest + 1} keys, {noteName(lowest)} to {noteName(highest)}.
          </p>
          {highest - lowest < 11 && (
            <p className="mt-2 text-xs text-warn-500">
              That is a very narrow range. If you meant to press the two end keys, try again —
              otherwise carry on.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void confirm()}
              disabled={saved}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {saved ? 'Saved' : 'Looks right — save'}
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-ink-300 hover:bg-ink-700"
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}

// ----------------------------------------------------------------- octave

function OctaveStep({
  target,
  transpose,
  setTranspose,
  addMidiTap,
  onDone
}: {
  target: number
  transpose: number
  setTranspose: (semitones: number) => Promise<void>
  addMidiTap: (tap: (event: { type: string; note?: number }) => void) => () => void
  onDone: () => void
}): React.JSX.Element {
  const [lastNote, setLastNote] = useState<number | null>(null)

  useEffect(() => {
    return addMidiTap((event) => {
      if (event.type !== 'noteon' || event.note === undefined) return
      setLastNote(event.note)
    })
  }, [addMidiTap])

  const matches = lastNote === target
  // How many octaves off, so the instruction can be specific rather than vague.
  const octavesOff = lastNote === null ? 0 : Math.round((target - lastNote) / 12)

  return (
    <Panel>
      <Step done={matches} label={`Play your lowest key — it should be ${noteName(target)}`}>
        {lastNote !== null && (
          <Big className={matches ? 'text-good-500' : 'text-warn-500'}>{noteName(lastNote)}</Big>
        )}
      </Step>

      {lastNote !== null && !matches && (
        <div className="mt-4 rounded-lg border border-warn-500/40 bg-warn-500/10 p-4">
          <p className="text-sm text-ink-200">
            Your lowest key is sending {noteName(lastNote)}, not {noteName(target)}.
          </p>
          {octavesOff !== 0 ? (
            <p className="mt-2 text-sm text-ink-200">
              Press <strong>Octave {octavesOff > 0 ? '+' : '−'}</strong> on your keyboard{' '}
              {Math.abs(octavesOff)} time{Math.abs(octavesOff) === 1 ? '' : 's'}, then play the
              lowest key again. Or shift it here:
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-200">
              That is less than an octave away, so your keyboard may not start on a C. You can
              carry on — the app knows your real range either way.
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => void setTranspose(transpose - 12)}
              className="rounded border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-700"
            >
              Octave −
            </button>
            <span className="w-24 text-center font-mono text-xs text-ink-300">
              {transpose === 0 ? 'no shift' : `${transpose > 0 ? '+' : ''}${transpose / 12} oct`}
            </span>
            <button
              onClick={() => void setTranspose(transpose + 12)}
              className="rounded border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-700"
            >
              Octave +
            </button>
          </div>
        </div>
      )}

      {matches && (
        <p className="mt-4 rounded-lg bg-good-500/15 px-4 py-3 text-sm text-good-500">
          That is {noteName(target)}. Your keyboard is in the right octave.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={onDone}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          {matches ? 'Done' : 'Continue anyway'}
        </button>
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------- latency

function LatencyStep({
  profileId,
  audio,
  addMidiTap,
  save,
  onDone
}: {
  profileId: keyof typeof GRADING_PROFILES
  audio: ReturnType<typeof useAppStore.getState>['audio']
  addMidiTap: (tap: (event: { type: string; note?: number; time?: number }) => void) => () => void
  save: (offsetMs: number) => Promise<void>
  onDone: () => void
}): React.JSX.Element {
  const [running, setRunning] = useState(false)
  const [taps, setTaps] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const errorsRef = useRef<number[]>([])
  const clickTimesRef = useRef<number[]>([])
  const runningRef = useRef(false)

  const finish = useCallback(async () => {
    runningRef.current = false
    setRunning(false)
    audio.metronome.stop()
    audio.metronome.onTick = null

    const errors = errorsRef.current
    if (errors.length < 6) {
      setMessage('Not enough taps to measure. Try again, and tap on every click.')
      return
    }

    const sorted = [...errors].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]!
    const spread = sorted
      .map((e) => Math.abs(e - median))
      .sort((a, b) => a - b)[Math.floor(sorted.length / 2)]!

    if (spread > 80) {
      setMessage(
        `Your taps varied by about ±${Math.round(spread)} ms, which is too scattered to measure anything reliable. Try again — listen to the click rather than racing it.`
      )
      return
    }

    const clamped = Math.max(-120, Math.min(120, median))
    const { applied, residual } = appliedInputOffset(clamped, GRADING_PROFILES[profileId])
    await save(clamped)
    setDone(true)
    setMessage(
      residual === 0
        ? `Measured ${Math.round(clamped)} ms and saved.`
        : `Measured ${Math.round(clamped)} ms. About ${Math.abs(Math.round(applied))} ms of that looks like your hardware and is corrected for; the other ${Math.abs(Math.round(residual))} ms is you playing ${residual < 0 ? 'ahead of' : 'behind'} the beat, which is normal and worth knowing.`
    )
  }, [audio, profileId, save])

  useEffect(() => {
    return addMidiTap((event) => {
      if (event.type !== 'noteon' || !runningRef.current) return
      const clicks = clickTimesRef.current
      if (clicks.length === 0 || event.time === undefined) return
      let nearest = clicks[0]!
      for (const t of clicks) {
        if (Math.abs(event.time - t) < Math.abs(event.time - nearest)) nearest = t
      }
      errorsRef.current.push(event.time - nearest)
      setTaps(errorsRef.current.length)
    })
  }, [addMidiTap])

  useEffect(() => {
    return () => {
      runningRef.current = false
      audio.metronome.stop()
      audio.metronome.onTick = null
    }
  }, [audio])

  const start = (): void => {
    errorsRef.current = []
    clickTimesRef.current = []
    setTaps(0)
    setMessage(null)
    setDone(false)
    setRunning(true)
    runningRef.current = true

    void audio.resume()
    audio.metronome.setTempo(LATENCY_BPM)
    audio.metronome.setTimeSignature(4)

    let beat = 0
    audio.metronome.onTick = (tick) => {
      beat += 1
      if (beat > LATENCY_WARMUP) {
        clickTimesRef.current.push(audio.contextToPerformanceMs(tick.time))
      }
      if (beat >= LATENCY_BEATS) setTimeout(() => void finish(), 700)
    }
    audio.metronome.start()
  }

  return (
    <Panel>
      {running ? (
        <div className="py-6 text-center">
          <p className="text-sm text-ink-300">Tap any key on every click.</p>
          <p className="mt-3 font-mono text-4xl font-bold text-brand-400">
            {taps}
            <span className="text-lg text-ink-500"> / {LATENCY_BEATS - LATENCY_WARMUP}</span>
          </p>
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="mb-4 text-sm text-ink-300">
            A click plays at 100 BPM. Tap any key along with it.
          </p>
          <button
            onClick={start}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
          >
            {done ? 'Measure again' : 'Start the click'}
          </button>
        </div>
      )}

      {message && (
        <p
          className={`mt-2 rounded-lg px-4 py-3 text-sm ${
            done ? 'bg-good-500/15 text-good-500' : 'bg-warn-500/15 text-warn-500'
          }`}
        >
          {message}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={onDone}
          className="rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-ink-200 hover:bg-ink-700"
        >
          {done ? 'Done' : 'Skip this step'}
        </button>
      </div>
    </Panel>
  )
}

// ------------------------------------------------------------------ shared

function Panel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="mt-6 rounded-xl border border-ink-700 bg-ink-850 p-6">{children}</section>
  )
}

function Step({
  done,
  label,
  children
}: {
  done: boolean
  label: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-4 border-b border-ink-700 py-4 last:border-b-0">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-good-500 text-ink-900' : 'border border-ink-600 text-ink-500'
        }`}
      >
        {done ? '✓' : ''}
      </span>
      <span className="flex-1 text-sm text-ink-200">{label}</span>
      {children}
    </div>
  )
}

function Big({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return <span className={`font-mono text-2xl font-bold text-ink-100 ${className}`}>{children}</span>
}
