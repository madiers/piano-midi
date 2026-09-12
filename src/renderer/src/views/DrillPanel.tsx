import { useMemo } from 'react'
import type { Lesson } from '@shared/types'
import { StaffView } from '../components/StaffView'
import { formatSpelled, noteName, pitchClassName } from '../music/pitch'
import { keySignature, spellInKey } from '../music/scales'
import { CHORD_LABEL, chordName, inversionLabel } from '../music/chords'
import { intervalName, intervalFromSemitones } from '../music/intervals'
import { useDrillRunner } from '../lessons/useDrillRunner'
import type { DrillExercise } from '../lessons/exerciseKinds'
import type { Phrase } from '@shared/types'

export interface DrillPanelProps {
  lesson: Lesson
  exercise: DrillExercise
  onComplete: (score: number) => void
}

/**
 * The prompt-and-answer drills: name this note, find this note, build this
 * chord, identify this interval.
 *
 * Every one of them is answered by PLAYING, never by clicking a multiple-choice
 * button. Recognising a note on a screen and finding it under your fingers are
 * different skills, and only the second one is piano playing.
 */
export function DrillPanel({ lesson, exercise, onComplete }: DrillPanelProps): React.JSX.Element {
  const drill = useDrillRunner(exercise, onComplete)
  const { prompt, status } = drill

  // A one-note phrase, so note-reading prompts use the same engraving as
  // everything else rather than a second, subtly different renderer.
  const promptPhrase: Phrase | null = useMemo(() => {
    if (!prompt || exercise.kind !== 'noteName') return null
    const midi = prompt.expected[0]!
    const hand = exercise.clef === 'bass' || midi < 60 ? 'left' : 'right'
    return {
      timeSignature: [4, 4],
      keySignatureFifths: 0,
      tempoBpm: 60,
      bars: 1,
      notes: [{ id: 'q', midi: [midi], startBeats: 0, durationBeats: 4, hand }],
      gradedHands: 'either'
    }
  }, [prompt, exercise])

  if (status === 'idle') {
    return (
      <section className="mt-6 rounded-xl border border-ink-700 bg-ink-850 p-6 text-center">
        <p className="mb-4 text-sm text-ink-300">{describe(exercise)}</p>
        <button
          onClick={drill.start}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
        >
          Start · {drill.totalRounds} questions
        </button>
      </section>
    )
  }

  if (status === 'finished') {
    const passed = drill.score >= lesson.mastery.minScore
    return (
      <section className="mt-6 rounded-xl border border-ink-700 bg-ink-850 p-6">
        <h2 className="text-base font-semibold text-ink-100">
          {passed ? 'Passed' : 'Keep going'}
        </h2>
        <p className="mt-1 text-sm text-ink-300">
          {drill.correct} right, {drill.wrong} wrong — {Math.round(drill.score * 100)}%
        </p>
        <button
          onClick={() => {
            drill.reset()
            drill.start()
          }}
          className="mt-4 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-ink-200 hover:bg-ink-700"
        >
          Go again
        </button>
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-xl border border-ink-700 bg-ink-850 p-6">
      <div className="mb-4 flex items-center justify-between text-xs text-ink-400">
        <span>
          Question {drill.round + 1} of {drill.totalRounds}
        </span>
        <span>
          <span className="text-good-500">{drill.correct} right</span>
          {drill.wrong > 0 && <span className="ml-2 text-bad-500">{drill.wrong} wrong</span>}
        </span>
      </div>

      <div className="min-h-[180px]">
        {/* --- Read this note --- */}
        {exercise.kind === 'noteName' && promptPhrase && (
          <div className="rounded-lg bg-ink-100 p-3">
            <StaffView phrase={promptPhrase} width={520} />
          </div>
        )}

        {/* --- Find a black-key GROUP (Unit 1, before sharps exist) --- */}
        {exercise.kind === 'findNote' && prompt?.group && (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-xs uppercase tracking-wide text-ink-400">Play a group of</p>
            <p className="mt-2 text-5xl font-bold text-ink-100">
              {prompt.group === 'two' ? 'TWO' : 'THREE'}
            </p>
            <p className="mt-1 text-lg text-ink-200">black keys</p>
            <div className="mt-4 flex items-end gap-1.5" aria-hidden>
              {(prompt.group === 'two' ? [0, 1] : [0, 1, 2]).map((i) => (
                <span key={i} className="h-12 w-5 rounded-b bg-ink-950 ring-1 ring-ink-600" />
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-400">Any octave — play them together.</p>
          </div>
        )}

        {/* --- Find this note by name --- */}
        {exercise.kind === 'findNote' && prompt && !prompt.group && (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-xs uppercase tracking-wide text-ink-400">Play this note</p>
            <p className="mt-2 font-mono text-5xl font-bold text-ink-100">
              {exercise.acceptAnyOctave
                ? pitchClassName(prompt.expected[0]!)
                : noteName(prompt.expected[0]!)}
            </p>
            {exercise.byPattern && (
              <p className="mt-3 max-w-sm text-center text-xs text-ink-400">
                {patternHint(prompt.expected[0]!)}
              </p>
            )}
          </div>
        )}

        {/* --- Build this chord --- */}
        {exercise.kind === 'chordBuild' && prompt?.chord && (
          <div className="flex flex-col items-center justify-center py-8">
            {exercise.byEar ? (
              <>
                <p className="text-xs uppercase tracking-wide text-ink-400">
                  Is it major or minor? Play it back
                </p>
                <button
                  onClick={drill.replay}
                  className="mt-4 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-ink-200 hover:bg-ink-700"
                >
                  Hear it again
                </button>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-wide text-ink-400">Build this chord</p>
                <p className="mt-2 font-mono text-5xl font-bold text-ink-100">
                  {chordName(prompt.chord)}
                </p>
                <p className="mt-2 text-sm text-brand-400">
                  {CHORD_LABEL[prompt.chord.quality]}
                  {prompt.chord.inversion > 0 && `, ${inversionLabel(prompt.chord.inversion)}`}
                </p>
                {exercise.inversionPolicy !== 'exact' && (
                  <p className="mt-2 text-xs text-ink-500">Any octave or order is fine.</p>
                )}
              </>
            )}
          </div>
        )}

        {/* --- Interval ear training --- */}
        {exercise.kind === 'intervalEar' && prompt && (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-xs uppercase tracking-wide text-ink-400">
              Play back the interval you hear
            </p>
            <p className="mt-2 text-sm text-ink-300">Start from any key you like.</p>
            <button
              onClick={drill.replay}
              className="mt-4 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-ink-200 hover:bg-ink-700"
            >
              Hear it again
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      <div className="mt-4 min-h-[56px]">
        {status === 'correct' && (
          <p className="rounded-lg bg-good-500/15 px-4 py-3 text-sm text-good-500">
            Correct
            {prompt && exercise.kind === 'intervalEar' && prompt.semitones !== undefined && (
              <> — that was {intervalName(intervalFromSemitones(prompt.semitones))}.</>
            )}
            {prompt && exercise.kind === 'noteName' && (
              <> — {formatSpelled(spellInKey(prompt.expected[0]!, keySignature(0)))}.</>
            )}
          </p>
        )}

        {status === 'wrong' && (
          <div className="rounded-lg bg-bad-500/15 px-4 py-3 text-sm text-bad-500">
            <p>
              You played {drill.attempt.slice(-3).map((n) => noteName(n)).join(' ')}
              {prompt?.group ? (
                <>
                  {' '}— that is not one group of {prompt.group === 'two' ? 'two' : 'three'}{' '}
                  neighbouring black keys.
                </>
              ) : (
                prompt &&
                drill.attempt.length === 1 && <> — the answer is {noteName(prompt.expected[0]!)}.</>
              )}
            </p>
            {drill.hint && <p className="mt-1 text-ink-300">{drill.hint}</p>}
          </div>
        )}

        {status === 'prompting' && drill.attempt.length > 0 && (
          <p className="px-4 py-3 font-mono text-sm text-ink-400">
            {drill.attempt.map((n) => noteName(n)).join('  ')}
          </p>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={drill.skip}
          className="rounded border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-ink-400 hover:bg-ink-700"
        >
          Skip this one
        </button>
      </div>
    </section>
  )
}

function describe(exercise: DrillExercise): string {
  switch (exercise.kind) {
    case 'noteName':
      return 'A note appears on the staff. Play it on your keyboard.'
    case 'findNote':
      if (exercise.groupMode) return 'Find the black-key groups by their shape.'
      return exercise.byPattern
        ? 'Find each key using the black-key groups as your guide.'
        : 'A note is named. Find it and play it.'
    case 'chordBuild':
      return exercise.byEar
        ? 'Listen to each chord, then play it back.'
        : 'A chord is named. Play all of its notes together.'
    case 'intervalEar':
      return 'Two notes sound. Play back the same distance, starting anywhere.'
  }
}

/** The pattern-based way to find a white key, for Unit 1. */
function patternHint(midi: number): string {
  switch (((midi % 12) + 12) % 12) {
    case 0:
      return 'C is the white key immediately to the LEFT of a group of TWO black keys.'
    case 5:
      return 'F is the white key immediately to the LEFT of a group of THREE black keys.'
    case 11:
      return 'B is the white key immediately to the RIGHT of a group of THREE black keys.'
    default:
      return 'Find the nearest C, F or B first, then step to it.'
  }
}
