import { describe, expect, it } from 'vitest'
import { ALL_LESSONS } from './curriculum'
import { isDrillExercise, PHRASE_EXERCISE_KINDS } from './exerciseKinds'

/** Exercise kinds the lesson view knows how to build a phrase for. */
const PHRASE_KINDS = new Set<string>(PHRASE_EXERCISE_KINDS)

describe('every lesson can actually be presented', () => {
  it('has a renderer for each lesson', () => {
    const orphans: string[] = []

    for (const lesson of ALL_LESSONS) {
      const exercise = lesson.exercise
      if (!exercise) {
        // A lesson with nothing to do must at least have something to read.
        if (lesson.blocks.length === 0) orphans.push(`${lesson.id} has neither content nor exercise`)
        continue
      }
      if (exercise.kind === 'freePlay') continue
      if (isDrillExercise(exercise)) continue
      if (PHRASE_KINDS.has(exercise.kind)) continue
      orphans.push(`${lesson.id} uses unrendered exercise kind "${exercise.kind}"`)
    }

    expect(orphans).toEqual([])
  })

  it('covers every exercise kind the curriculum actually uses', () => {
    const used = new Set(ALL_LESSONS.map((l) => l.exercise?.kind).filter(Boolean))
    // If a new kind is added to the curriculum, this fails until it is rendered.
    for (const kind of used) {
      const handled =
        kind === 'freePlay' ||
        PHRASE_KINDS.has(kind as string) ||
        ['noteName', 'findNote', 'chordBuild', 'intervalEar'].includes(kind as string)
      expect(handled, `exercise kind "${kind}" has no renderer`).toBe(true)
    }
  })
})
