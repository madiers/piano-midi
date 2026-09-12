/**
 * Drives a timed exercise: count-in, transport, MIDI capture, grading, result.
 *
 * The transport runs on the AudioContext clock rather than on timers or on
 * accumulated requestAnimationFrame deltas. Both of those drift, and a student
 * being graded against a drifting clock is being graded unfairly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GradingProfileId, Phrase } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { PerformanceGrader, type FeedbackEvent, type PerformanceResult } from './PerformanceGrader'
import type { NoteOutcome } from './grading'

export type RunnerPhase = 'idle' | 'counting-in' | 'playing' | 'finished'

export interface UseExerciseRunnerOptions {
  phrase: Phrase
  profile: GradingProfileId
  /** 'wait' disables timing entirely; a number is a percentage of target tempo. */
  tempo: 'wait' | number
  countInBars?: number
  metronome?: boolean
  /** Rhythm exercises grade timing only; any key counts. */
  ignorePitch?: boolean
  onComplete?: (result: PerformanceResult) => void
}

export interface ExerciseRunner {
  phase: RunnerPhase
  /** Current transport position, in beats. Read from an animation frame. */
  getPositionBeats: () => number
  outcomes: Map<string, NoteOutcome>
  currentNoteId: string | null
  result: PerformanceResult | null
  countInBeat: number
  effectiveBpm: number
  start: () => void
  stop: () => void
  reset: () => void
}

export function useExerciseRunner(options: UseExerciseRunnerOptions): ExerciseRunner {
  const audio = useAppStore((s) => s.audio)
  const addMidiTap = useAppStore((s) => s.addMidiTap)
  const calibration = useAppStore((s) => s.settings.calibration)

  const [phase, setPhase] = useState<RunnerPhase>('idle')
  const [outcomes, setOutcomes] = useState<Map<string, NoteOutcome>>(new Map())
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)
  const [result, setResult] = useState<PerformanceResult | null>(null)
  const [countInBeat, setCountInBeat] = useState(0)

  const graderRef = useRef<PerformanceGrader | null>(null)
  const startContextTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)
  /**
   * Guards the animation loop. `step` reschedules itself at the top of the
   * frame, so cancelling the pending id is not enough — a frame already in
   * flight would queue another one and the loop would outlive the exercise.
   */
  const loopingRef = useRef(false)
  const phaseRef = useRef<RunnerPhase>('idle')
  phaseRef.current = phase

  const waitMode = options.tempo === 'wait'
  // Compared against options.tempo directly so TypeScript narrows the union;
  // going through `waitMode` leaves it as number | 'wait'.
  const tempoPercent = options.tempo === 'wait' ? 100 : options.tempo
  const effectiveBpm = useMemo(
    () => (waitMode ? options.phrase.tempoBpm : (options.phrase.tempoBpm * tempoPercent) / 100),
    [options.phrase.tempoBpm, tempoPercent, waitMode]
  )

  const countInBars = options.countInBars ?? 1
  const beatsPerBar = options.phrase.timeSignature[0]

  /** Position in beats since the phrase started. Negative during count-in. */
  const getPositionBeats = useCallback((): number => {
    if (startContextTimeRef.current === null) return 0
    const elapsed = audio.context.currentTime - startContextTimeRef.current
    return (elapsed * effectiveBpm) / 60
  }, [audio, effectiveBpm])

  const stop = useCallback(() => {
    loopingRef.current = false
    cancelAnimationFrame(rafRef.current)
    audio.metronome.stop()
    audio.allNotesOff()
    startContextTimeRef.current = null
  }, [audio])

  const reset = useCallback(() => {
    stop()
    graderRef.current = null
    setPhase('idle')
    setOutcomes(new Map())
    setCurrentNoteId(null)
    setResult(null)
    setCountInBeat(0)
  }, [stop])

  const start = useCallback(() => {
    void audio.resume()

    const events = PerformanceGrader.fromPhrase(options.phrase, effectiveBpm)

    const grader = new PerformanceGrader(events, {
      profile: options.profile,
      bpm: effectiveBpm,
      inputOffsetMs: calibration?.inputOffsetMs ?? 0,
      waitMode,
      ignorePitch: options.ignorePitch ?? false,
      tempoPercent,
      onFeedback: (event: FeedbackEvent) => {
        setOutcomes((previous) => {
          const next = new Map(previous)
          switch (event.type) {
            case 'hit':
              next.set(event.eventId, event.judgement as NoteOutcome)
              break
            case 'wrong':
              next.set(event.eventId, 'wrong-pitch')
              break
            case 'missed':
              next.set(event.eventId, 'missed')
              break
            default:
              break
          }
          return next
        })

        if (event.type === 'complete') {
          setResult(event.result)
          setPhase('finished')
          options.onComplete?.(event.result)
          loopingRef.current = false
          cancelAnimationFrame(rafRef.current)
          audio.metronome.stop()
        }
      }
    })

    graderRef.current = grader
    setOutcomes(new Map())
    setResult(null)

    if (waitMode) {
      // No transport at all — the student advances by playing the right note.
      setPhase('playing')
      setCurrentNoteId(grader.nextEvent?.id ?? null)
      return
    }

    // Count-in, then start the phrase exactly on the downbeat.
    const secondsPerBeat = 60 / effectiveBpm
    const countInBeats = countInBars * beatsPerBar
    const now = audio.context.currentTime + 0.15

    audio.metronome.setTempo(effectiveBpm)
    audio.metronome.setTimeSignature(beatsPerBar)

    let ticks = 0
    audio.metronome.onTick = (tick) => {
      ticks += 1
      if (ticks <= countInBeats) {
        setCountInBeat(countInBeats - ticks + 1)
      } else if (!options.metronome) {
        // Count-in only: silence the click once the phrase begins.
        audio.metronome.stop()
      }
      void tick
    }
    audio.metronome.start(now)

    const phraseStart = now + countInBeats * secondsPerBeat
    startContextTimeRef.current = phraseStart
    setPhase('counting-in')
    setCountInBeat(countInBeats)

    // Grader timestamps are on the performance clock, so convert once.
    grader.start(audio.contextToPerformanceMs(phraseStart))

    const step = (): void => {
      if (!loopingRef.current) return
      rafRef.current = requestAnimationFrame(step)
      const position = getPositionBeats()

      if (position >= 0 && phaseRef.current === 'counting-in') {
        setPhase('playing')
      }

      grader.tick(performance.now())
      const next = grader.nextEvent
      setCurrentNoteId((previous) => (previous === (next?.id ?? null) ? previous : next?.id ?? null))
    }
    loopingRef.current = true
    rafRef.current = requestAnimationFrame(step)
  }, [
    audio,
    beatsPerBar,
    calibration,
    countInBars,
    effectiveBpm,
    getPositionBeats,
    options,
    tempoPercent,
    waitMode
  ])

  // Feed MIDI into the grader while an exercise is running.
  useEffect(() => {
    return addMidiTap((event) => {
      const grader = graderRef.current
      if (!grader) return
      if (phaseRef.current !== 'playing' && phaseRef.current !== 'counting-in') return

      if (event.type === 'noteon') {
        grader.noteOn(event.note, event.time, event.velocity)
        if (waitMode) {
          setCurrentNoteId(grader.nextEvent?.id ?? null)
        }
      } else if (event.type === 'noteoff') {
        grader.noteOff(event.note, event.time)
      }
    })
  }, [addMidiTap, waitMode])

  useEffect(() => stop, [stop])

  return {
    phase,
    getPositionBeats,
    outcomes,
    currentNoteId,
    result,
    countInBeat,
    effectiveBpm,
    start,
    stop,
    reset
  }
}
