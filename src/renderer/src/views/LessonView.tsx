import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lesson, Phrase, TempoStep } from '@shared/types'
import { ANCHORS } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { PianoKeyboard, type KeyMark } from '../components/PianoKeyboard'
import { StaffView } from '../components/StaffView'
import { FallingNotes } from '../components/FallingNotes'
import { ConceptBlocks } from '../components/ConceptBlocks'
import { ResultPanel } from '../components/ResultPanel'
import { AnchorCheck } from '../components/AnchorCheck'
import { DrillPanel } from './DrillPanel'
import { CalibrationLessonPanel } from './CalibrationLessonPanel'
import { isDrillExercise } from '../lessons/exerciseKinds'
import { useExerciseRunner } from '../lessons/useExerciseRunner'
import { generatePhrase, generateRhythm, phraseFromNotes, randomSeed } from '../lessons/generator'
import { scaleNotes, LH_MAJOR_SCALE_FINGERING, RH_MAJOR_SCALE_FINGERING } from '../music/scales'
import { nextLesson } from '../lessons/curriculum'
import type { PerformanceResult } from '../lessons/PerformanceGrader'
import { recordPractice } from '../lessons/practiceStats'

export interface LessonViewProps {
  lesson: Lesson
  onExit: () => void
  onAdvance: (lessonId: string) => void
}

/** Build the phrase an exercise needs, for a given attempt seed. */
function buildPhrase(lesson: Lesson, seed: number): Phrase | null {
  const exercise = lesson.exercise
  if (!exercise) return null

  switch (exercise.kind) {
    case 'sightRead':
      return generatePhrase(exercise.generator, seed)
    case 'rhythmTap':
      return generateRhythm(exercise.generator, seed)
    case 'playAlong':
      return exercise.phrase
    case 'scaleRun': {
      const notes = scaleNotes(exercise.tonicMidi, exercise.scaleType, exercise.octaves)
      const hand = exercise.hands === 'left' ? 'left' : 'right'
      const fingering =
        hand === 'right' ? [...RH_MAJOR_SCALE_FINGERING] : [...LH_MAJOR_SCALE_FINGERING]
      return phraseFromNotes(notes, {
        tempoBpm: exercise.tempoBpm,
        hand,
        durationBeats: 1,
        fingers: fingering
      })
    }
    default:
      return null
  }
}

export function LessonView({ lesson, onExit, onAdvance }: LessonViewProps): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const held = useAppStore((s) => s.heldNotes)
  const audio = useAppStore((s) => s.audio)
  const saveProgress = useAppStore((s) => s.saveProgress)
  const updateSettings = useAppStore((s) => s.updateSettings)

  // A fresh seed per attempt. Reusing it would turn sight-reading into
  // memorisation, which is the one thing the exercise must not become.
  const [seed, setSeed] = useState(() => randomSeed())
  const [started, setStarted] = useState(false)
  // Practice time counts from opening the lesson, not from launching the app:
  // rewarding time-with-the-app-open is how a streak stops meaning practice.
  const openedAt = useRef(performance.now())

  const phrase = useMemo(() => buildPhrase(lesson, seed), [lesson, seed])
  const tempo: TempoStep = settings.practice.tempoStep

  // What the keyboard and falling-note lane DISPLAY. This is the whole anchor,
  // not the lesson's requiredRange: requiredRange says which notes the exercise
  // may ask for (and is what the curriculum test validates), but drawing only
  // those would show a three-key stub with no context for where the hand sits.
  const displayRange: [number, number] = lesson.anchor
    ? [ANCHORS[lesson.anchor].low, ANCHORS[lesson.anchor].high]
    : [48, 72]

  const recordResult = useCallback(
    (result: PerformanceResult) => {
      const tempoPercent = tempo === 'wait' ? 0 : tempo
      const passed =
        result.final >= lesson.mastery.minScore && tempoPercent >= lesson.mastery.minTempoPercent

      void saveProgress((previous) => {
        const existing = previous.lessons[lesson.id]
        return {
        ...previous,
        lessons: {
          ...previous.lessons,
          [lesson.id]: {
            lessonId: lesson.id,
            stars: Math.max(existing?.stars ?? 0, result.stars) as 0 | 1 | 2 | 3,
            bestScore: Math.max(existing?.bestScore ?? 0, result.final),
            bestPitchAccuracy: Math.max(existing?.bestPitchAccuracy ?? 0, result.pitchAccuracy),
            attempts: (existing?.attempts ?? 0) + 1,
            bestTempoPercent: Math.max(existing?.bestTempoPercent ?? 0, tempoPercent),
            completed: existing?.completed || passed,
            lastPlayedAt: new Date().toISOString()
          }
        },
        stats: recordPractice(
          previous.stats,
          performance.now() - openedAt.current,
          result.correct
        ).stats
        }
      })
    },
    [lesson, saveProgress, tempo]
  )

  const runner = useExerciseRunner({
    phrase: phrase ?? { timeSignature: [4, 4], keySignatureFifths: 0, tempoBpm: 72, bars: 1, notes: [], gradedHands: 'either' },
    profile: settings.practice.gradingProfile,
    tempo,
    countInBars: settings.practice.countInBars,
    metronome: settings.practice.metronomeEnabled,
    // "Tap any key" has to mean it.
    ignorePitch: lesson.exercise?.kind === 'rhythmTap',
    onComplete: recordResult
  })

  // A concept lesson is complete once it has been read.
  useEffect(() => {
    if (lesson.kind !== 'concept') return
    void saveProgress((previous) => {
      if (previous.lessons[lesson.id]?.completed) return previous
      return {
        ...previous,
        lessons: {
          ...previous.lessons,
          [lesson.id]: {
            lessonId: lesson.id,
            stars: 0,
            bestScore: 0,
            bestPitchAccuracy: 0,
            attempts: 1,
            bestTempoPercent: 0,
            completed: true,
            lastPlayedAt: new Date().toISOString()
          }
        }
      }
    })
  }, [lesson.id, lesson.kind, saveProgress])

  /** Drills score as a simple proportion correct; there is no timing to grade. */
  const recordDrillResult = useCallback(
    (score: number) => {
      const passed = score >= lesson.mastery.minScore
      const stars: 0 | 1 | 2 | 3 = score >= 0.93 ? 3 : score >= 0.8 ? 2 : score >= 0.6 ? 1 : 0

      void saveProgress((previous) => {
        const existing = previous.lessons[lesson.id]
        return {
        ...previous,
        lessons: {
          ...previous.lessons,
          [lesson.id]: {
            lessonId: lesson.id,
            stars: Math.max(existing?.stars ?? 0, stars) as 0 | 1 | 2 | 3,
            bestScore: Math.max(existing?.bestScore ?? 0, score),
            bestPitchAccuracy: Math.max(existing?.bestPitchAccuracy ?? 0, score),
            attempts: (existing?.attempts ?? 0) + 1,
            // Drills have no tempo, so passing one satisfies its tempo gate.
            bestTempoPercent: 100,
            completed: existing?.completed || passed,
            lastPlayedAt: new Date().toISOString()
          }
        },
        stats: recordPractice(previous.stats, performance.now() - openedAt.current, 0).stats
        }
      })
    },
    [lesson, saveProgress]
  )

  /** Marks a lesson complete that has nothing to score — setup steps, sandboxes. */
  const markComplete = useCallback(() => {
    void saveProgress((previous) => {
      if (previous.lessons[lesson.id]?.completed) return previous
      return {
        ...previous,
        lessons: {
          ...previous.lessons,
          [lesson.id]: {
            lessonId: lesson.id,
            stars: 0,
            bestScore: 1,
            bestPitchAccuracy: 1,
            attempts: 1,
            bestTempoPercent: 100,
            completed: true,
            lastPlayedAt: new Date().toISOString()
          }
        }
      }
    })
  }, [lesson.id, saveProgress])

  const retry = useCallback(() => {
    setSeed(randomSeed())
    runner.reset()
    setStarted(false)
  }, [runner])

  const marks = useMemo(() => {
    const map = new Map<number, KeyMark>()
    if (!phrase || !runner.currentNoteId) return map
    const note = phrase.notes.find((n) => n.id === runner.currentNoteId)
    for (const midi of note?.midi ?? []) map.set(midi, 'target')
    return map
  }, [phrase, runner.currentNoteId])

  const fingers = useMemo(() => {
    const map = new Map<number, number>()
    if (!phrase || !settings.practice.showFingerNumbers) return map
    for (const note of phrase.notes) {
      note.fingers?.forEach((finger, index) => {
        const midi = note.midi[index]
        if (midi !== undefined && finger) map.set(midi, finger)
      })
    }
    return map
  }, [phrase, settings.practice.showFingerNumbers])

  const next = nextLesson(lesson.id)
  const showFalling =
    settings.practice.showFallingNotes &&
    !(lesson.exercise?.kind === 'sightRead' && lesson.exercise.staffOnly)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-ink-900">
      <header className="drag-region flex items-center gap-3 border-b border-ink-700 bg-ink-850 px-6 py-3 pl-20">
        <button
          onClick={onExit}
          className="no-drag rounded-md border border-ink-600 bg-ink-800 px-3 py-1 text-xs text-ink-200 hover:bg-ink-700"
        >
          ← Lessons
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-ink-100">{lesson.title}</h1>
          <p className="text-[11px] uppercase tracking-wide text-ink-400">
            {lesson.kind} · {lesson.id}
          </p>
        </div>

        {/* Tempo only applies to timed performances. Drills, calibration steps
            and the sandbox have no beat, so the control would be meaningless. */}
        {lesson.exercise &&
          lesson.exercise.kind !== 'freePlay' &&
          lesson.exercise.kind !== 'calibration' &&
          !isDrillExercise(lesson.exercise) && (
          <div className="no-drag ml-auto flex items-center gap-2">
            <span className="text-xs text-ink-400">Tempo</span>
            {(['wait', 60, 80, 100] as TempoStep[]).map((step) => (
              <button
                key={String(step)}
                onClick={() => void updateSettings({ practice: { tempoStep: step } })}
                className={`rounded px-2 py-1 text-xs ${
                  tempo === step
                    ? 'bg-brand-600 text-white'
                    : 'border border-ink-600 bg-ink-800 text-ink-300 hover:bg-ink-700'
                }`}
              >
                {step === 'wait' ? 'Wait' : `${step}%`}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-6">
          {lesson.anchor && <AnchorCheck anchor={lesson.anchor} />}

          {lesson.blocks.length > 0 && <ConceptBlocks blocks={lesson.blocks} />}

          {runner.result && (
            <ResultPanel
              result={runner.result}
              lesson={lesson}
              tempo={tempo}
              onRetry={retry}
              onNext={next ? () => onAdvance(next.id) : undefined}
            />
          )}

          {lesson.exercise?.kind === 'calibration' && (
            <CalibrationLessonPanel exercise={lesson.exercise} onComplete={markComplete} />
          )}

          {lesson.exercise?.kind === 'freePlay' && (
            <section className="mt-6 rounded-xl border border-ink-700 bg-ink-850 p-6 text-center">
              <p className="text-sm text-ink-300">
                Play freely on the keyboard below. Continue when you are ready.
              </p>
            </section>
          )}

          {isDrillExercise(lesson.exercise) && (
            <DrillPanel
              lesson={lesson}
              exercise={lesson.exercise}
              onComplete={recordDrillResult}
            />
          )}

          {phrase && !runner.result && (
            <section className="mt-6 rounded-xl border border-ink-700 bg-ink-850 p-5">
              {runner.phase === 'counting-in' && (
                <p className="mb-3 text-center text-3xl font-bold text-brand-400">
                  {runner.countInBeat}
                </p>
              )}

              <StaffView
                phrase={phrase}
                outcomes={runner.outcomes}
                currentNoteId={runner.currentNoteId}
                showFingers={settings.practice.showFingerNumbers}
                width={760}
                className="overflow-x-auto rounded-lg bg-ink-100 p-2"
              />

              {!started && (
                <button
                  onClick={() => {
                    setStarted(true)
                    runner.start()
                  }}
                  className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-500"
                >
                  {tempo === 'wait'
                    ? 'Start — play each note when you are ready'
                    : `Start at ${runner.effectiveBpm.toFixed(0)} BPM`}
                </button>
              )}
            </section>
          )}

          {/*
            Anything without a graded result needs its own way forward. Leaving
            a kind out of this condition strands the lesson with no Continue
            button and no completion — which is exactly what happened to the
            Unit 0 calibration steps.
          */}
          {(lesson.kind === 'concept' ||
            isDrillExercise(lesson.exercise) ||
            lesson.exercise?.kind === 'calibration' ||
            lesson.exercise?.kind === 'freePlay') && (
            <div className="mt-8 flex justify-end">
              {next && (
                <button
                  onClick={() => {
                    if (lesson.exercise?.kind === 'freePlay') markComplete()
                    onAdvance(next.id)
                  }}
                  className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
                >
                  Continue →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-ink-700 bg-ink-850 px-6 pb-6 pt-4">
        {showFalling && phrase && started && !runner.result && (
          <FallingNotes
            phrase={phrase}
            low={displayRange[0]}
            high={displayRange[1]}
            getPositionBeats={runner.getPositionBeats}
            outcomes={runner.outcomes}
            height={180}
            className="mb-1 rounded-t-lg bg-ink-950"
          />
        )}
        <PianoKeyboard
          low={displayRange[0]}
          high={displayRange[1]}
          held={held}
          marks={marks}
          fingers={fingers}
          showNames={settings.practice.showNoteNames}
          height={140}
          onKeyDown={(midi) => {
            void audio.resume()
            audio.noteOn(midi, 90)
          }}
          onKeyUp={(midi) => audio.noteOff(midi)}
        />
      </footer>
    </div>
  )
}
