/**
 * Pure predicates over exercise kinds.
 *
 * Deliberately dependency-free: these are imported by tests and by the lesson
 * view, and pulling them out of the drill runner keeps that import from
 * dragging in the app store — which constructs an AudioContext at module load
 * and cannot exist in a plain Node test.
 */

import type {
  ChordBuildExercise,
  Exercise,
  FindNoteExercise,
  IntervalEarExercise,
  NoteNameExercise
} from '@shared/types'

/** Prompt-and-answer drills, as opposed to timed performances. */
export type DrillExercise =
  | NoteNameExercise
  | FindNoteExercise
  | ChordBuildExercise
  | IntervalEarExercise

export function isDrillExercise(exercise: Exercise | undefined): exercise is DrillExercise {
  return (
    exercise?.kind === 'noteName' ||
    exercise?.kind === 'findNote' ||
    exercise?.kind === 'chordBuild' ||
    exercise?.kind === 'intervalEar'
  )
}

/** Exercise kinds that the lesson view renders as a phrase on a staff. */
export const PHRASE_EXERCISE_KINDS = ['sightRead', 'rhythmTap', 'playAlong', 'scaleRun'] as const

export function isPhraseExercise(exercise: Exercise | undefined): boolean {
  return (
    exercise !== undefined &&
    (PHRASE_EXERCISE_KINDS as readonly string[]).includes(exercise.kind)
  )
}
