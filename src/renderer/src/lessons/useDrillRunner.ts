/**
 * Runner for prompt-and-answer drills.
 *
 * These are a different shape from timed performances: there is no transport
 * and no beat. The app asks something, waits for the student to answer on the
 * keyboard, marks it, and moves on. Timing is irrelevant — what is being
 * trained is recognition, and putting a clock on recognition just adds panic.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChordBuildExercise,
  Exercise,
  FindNoteExercise,
  IntervalEarExercise,
  NoteNameExercise
} from '@shared/types'
import { useAppStore } from '../store/appStore'
import { makeRng, randomSeed } from './generator'
import { pitchClass } from '../music/pitch'
import { CHORD_INTERVALS, chordNotes, type Chord, type ChordQuality } from '../music/chords'
import { classifyError, ERROR_HINTS, type ErrorKind } from './grading'

export type DrillExercise =
  | NoteNameExercise
  | FindNoteExercise
  | ChordBuildExercise
  | IntervalEarExercise

export interface DrillPrompt {
  index: number
  /** Notes that constitute a correct answer, in the expected voicing. */
  expected: number[]
  /** For chord prompts. */
  chord?: Chord
  /** For interval prompts: the two notes played to the student. */
  heard?: [number, number]
  semitones?: number
}

export type DrillStatus = 'idle' | 'prompting' | 'correct' | 'wrong' | 'finished'

export interface DrillRunner {
  status: DrillStatus
  prompt: DrillPrompt | null
  round: number
  totalRounds: number
  correct: number
  wrong: number
  /** Notes the student has offered for the current prompt. */
  attempt: number[]
  hint: string | null
  score: number
  start: () => void
  skip: () => void
  replay: () => void
  reset: () => void
}

export function isDrillExercise(exercise: Exercise | undefined): exercise is DrillExercise {
  return (
    exercise?.kind === 'noteName' ||
    exercise?.kind === 'findNote' ||
    exercise?.kind === 'chordBuild' ||
    exercise?.kind === 'intervalEar'
  )
}

/** How many distinct notes a correct answer needs. */
function answerSize(exercise: DrillExercise, prompt: DrillPrompt): number {
  if (exercise.kind === 'chordBuild') return prompt.expected.length
  if (exercise.kind === 'intervalEar') return 2
  return 1
}

export function useDrillRunner(
  exercise: DrillExercise,
  onComplete?: (score: number) => void
): DrillRunner {
  const audio = useAppStore((s) => s.audio)
  const addMidiTap = useAppStore((s) => s.addMidiTap)

  const totalRounds = exercise.rounds ?? 8

  const [status, setStatus] = useState<DrillStatus>('idle')
  const [round, setRound] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [prompt, setPrompt] = useState<DrillPrompt | null>(null)
  const [attempt, setAttempt] = useState<number[]>([])
  const [hint, setHint] = useState<string | null>(null)

  const seedRef = useRef(randomSeed())
  const rngRef = useRef(makeRng(seedRef.current))
  const statusRef = useRef<DrillStatus>('idle')
  statusRef.current = status
  const promptRef = useRef<DrillPrompt | null>(null)
  promptRef.current = prompt
  const attemptRef = useRef<number[]>([])
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pick = useCallback(<T,>(items: readonly T[]): T => {
    return items[Math.floor(rngRef.current() * items.length)]!
  }, [])

  /** Build the next prompt for this exercise kind. */
  const makePrompt = useCallback(
    (index: number): DrillPrompt => {
      switch (exercise.kind) {
        case 'noteName':
        case 'findNote': {
          const midi = pick(exercise.pool)
          return { index, expected: [midi] }
        }

        case 'chordBuild': {
          const rootMidi = pick(exercise.roots)
          const quality = pick(exercise.qualities) as ChordQuality
          const inversion = pick(exercise.inversions)
          const chord: Chord = { rootMidi, quality, inversion }
          return { index, expected: chordNotes(chord), chord }
        }

        case 'intervalEar': {
          const semitones = pick(exercise.semitones)
          const [low, high] = exercise.rootRange
          const root = low + Math.floor(rngRef.current() * Math.max(1, high - semitones - low))
          return {
            index,
            expected: [root, root + semitones],
            heard: [root, root + semitones],
            semitones
          }
        }
      }
    },
    [exercise, pick]
  )

  /** Play an ear-training prompt aloud. */
  const playPrompt = useCallback(
    (current: DrillPrompt) => {
      if (exercise.kind === 'intervalEar' && current.heard) {
        void audio.resume()
        const [a, b] = current.heard
        const harmonic = exercise.direction === 'harmonic'
        audio.noteOn(a, 80)
        window.setTimeout(() => audio.noteOff(a), harmonic ? 1200 : 600)
        window.setTimeout(
          () => {
            audio.noteOn(b, 80)
            window.setTimeout(() => audio.noteOff(b), 900)
          },
          harmonic ? 0 : 700
        )
      }

      if (exercise.kind === 'chordBuild' && exercise.byEar) {
        void audio.resume()
        for (const midi of current.expected) {
          audio.noteOn(midi, 78)
          window.setTimeout(() => audio.noteOff(midi), 1400)
        }
      }
    },
    [audio, exercise]
  )

  const nextRound = useCallback(
    (index: number) => {
      if (index >= totalRounds) {
        setStatus('finished')
        return
      }
      const next = makePrompt(index)
      setPrompt(next)
      setRound(index)
      setAttempt([])
      attemptRef.current = []
      setHint(null)
      setStatus('prompting')
      // Let the UI paint before the audio prompt sounds.
      window.setTimeout(() => playPrompt(next), 250)
    },
    [makePrompt, playPrompt, totalRounds]
  )

  const start = useCallback(() => {
    setCorrect(0)
    setWrong(0)
    nextRound(0)
  }, [nextRound])

  const reset = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    seedRef.current = randomSeed()
    rngRef.current = makeRng(seedRef.current)
    setStatus('idle')
    setPrompt(null)
    setRound(0)
    setCorrect(0)
    setWrong(0)
    setAttempt([])
    setHint(null)
  }, [])

  const skip = useCallback(() => {
    setWrong((n) => n + 1)
    nextRound(round + 1)
  }, [nextRound, round])

  const replay = useCallback(() => {
    if (prompt) playPrompt(prompt)
  }, [playPrompt, prompt])

  /** Is this set of notes an acceptable answer? */
  const judge = useCallback(
    (played: number[], current: DrillPrompt): boolean => {
      switch (exercise.kind) {
        case 'noteName':
        case 'findNote': {
          const target = current.expected[0]!
          if (exercise.acceptAnyOctave) return pitchClass(played[0]!) === pitchClass(target)
          return played[0] === target
        }

        case 'chordBuild': {
          const expected = current.expected
          switch (exercise.inversionPolicy) {
            case 'exact':
              return (
                played.length === expected.length &&
                played.every((n, i) => n === expected[i])
              )
            case 'any-inversion':
            case 'any-voicing': {
              const a = new Set(played.map(pitchClass))
              const b = new Set(expected.map(pitchClass))
              if (a.size !== b.size) return false
              for (const x of b) if (!a.has(x)) return false
              return true
            }
          }
          return false
        }

        case 'intervalEar': {
          // Any starting note is fine — what is being trained is the distance.
          if (played.length !== 2) return false
          return Math.abs(played[1]! - played[0]!) === current.semitones
        }
      }
    },
    [exercise]
  )

  // Collect answers from the keyboard.
  useEffect(() => {
    return addMidiTap((event) => {
      if (event.type !== 'noteon') return
      if (statusRef.current !== 'prompting') return
      const current = promptRef.current
      if (!current) return

      const next = [...attemptRef.current, event.note]
      attemptRef.current = next
      setAttempt(next)

      const needed = answerSize(exercise, current)
      if (next.length < needed) return

      // Take the most recent `needed` notes, so a stray key does not poison
      // the rest of the attempt.
      const candidate = next.slice(-needed)
      const sorted = [...candidate].sort((a, b) => a - b)

      const ok = judge(
        exercise.kind === 'chordBuild' || exercise.kind === 'intervalEar' ? sorted : candidate,
        current
      )

      if (ok) {
        setCorrect((n) => n + 1)
        setStatus('correct')
        advanceTimer.current = setTimeout(() => nextRound(current.index + 1), 700)
      } else {
        setWrong((n) => n + 1)
        setStatus('wrong')
        let kind: ErrorKind = 'unrelated'
        if (needed === 1) kind = classifyError(candidate[0]!, current.expected[0]!)
        setHint(needed === 1 ? ERROR_HINTS[kind] : 'Not quite — listen again and try once more.')
        // Let them see the mistake, then re-ask the SAME prompt.
        advanceTimer.current = setTimeout(() => {
          attemptRef.current = []
          setAttempt([])
          setStatus('prompting')
        }, 1400)
      }
    })
  }, [addMidiTap, exercise, judge, nextRound])

  useEffect(() => {
    if (status === 'finished') {
      const total = correct + wrong
      onComplete?.(total === 0 ? 0 : correct / total)
    }
    // Only fire once, when the drill ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    }
  }, [])

  const score = useMemo(() => {
    const total = correct + wrong
    return total === 0 ? 0 : correct / total
  }, [correct, wrong])

  return {
    status,
    prompt,
    round,
    totalRounds,
    correct,
    wrong,
    attempt,
    hint,
    score,
    start,
    skip,
    replay,
    reset
  }
}

/** Human-readable description of what a chord prompt is asking for. */
export function chordPromptLabel(quality: ChordQuality): string {
  return quality
}

export { CHORD_INTERVALS }
