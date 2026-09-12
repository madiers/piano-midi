import { describe, expect, it } from 'vitest'
import { ALL_LESSONS } from './curriculum'
import { PHRASE_EXERCISE_KINDS } from './exerciseKinds'

/**
 * Every exercise kind the lesson view actually draws something for.
 *
 * An earlier version of this test skipped 'freePlay' as self-evidently fine.
 * It was not: the two Unit 0 calibration lessons used it, so they rendered
 * nothing, saved nothing and offered no way forward — the course was
 * impassable from lesson two, and the test that was supposed to catch exactly
 * this had been written to look away from it. Nothing gets an exemption here.
 */
const RENDERED_KINDS = new Set<string>([
  ...PHRASE_EXERCISE_KINDS,
  'noteName',
  'findNote',
  'chordBuild',
  'intervalEar',
  'calibration',
  'freePlay'
])

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
      if (RENDERED_KINDS.has(exercise.kind)) continue
      orphans.push(`${lesson.id} uses unrendered exercise kind "${exercise.kind}"`)
    }

    expect(orphans).toEqual([])
  })

  it('covers every exercise kind the curriculum actually uses', () => {
    const used = new Set(ALL_LESSONS.map((l) => l.exercise?.kind).filter(Boolean))
    // If a new kind is added to the curriculum, this fails until it is rendered.
    for (const kind of used) {
      expect(RENDERED_KINDS.has(kind as string), `exercise kind "${kind}" has no renderer`).toBe(
        true
      )
    }
  })
})

describe('no lesson can dead-end', () => {
  /**
   * A lesson is escapable if it either produces a graded result (which shows a
   * Next button) or falls into the set the view gives an explicit Continue to.
   * This mirrors the condition in LessonView; if the two drift apart, a lesson
   * silently becomes a trap with no way to complete or move on.
   */
  const SELF_COMPLETING = new Set<string>(['calibration', 'freePlay'])
  const GRADED = new Set<string>([
    ...PHRASE_EXERCISE_KINDS,
    'noteName',
    'findNote',
    'chordBuild',
    'intervalEar'
  ])

  it('gives every lesson a way to complete and move on', () => {
    const trapped: string[] = []

    for (const lesson of ALL_LESSONS) {
      const kind = lesson.exercise?.kind
      const escapable =
        lesson.kind === 'concept' ||
        kind === undefined ||
        SELF_COMPLETING.has(kind) ||
        GRADED.has(kind)
      if (!escapable) trapped.push(`${lesson.id} "${lesson.title}" (${lesson.kind}/${kind})`)
    }

    expect(trapped).toEqual([])
  })

  it('keeps the Unit 0 setup steps on a kind that can save settings', () => {
    // These specifically must WRITE calibration, not merely be completable.
    for (const id of ['u0.2', 'u0.3', 'u0.4']) {
      const lesson = ALL_LESSONS.find((l) => l.id === id)
      expect(lesson, `${id} missing`).toBeDefined()
      expect(lesson!.exercise?.kind, `${id} must be a calibration exercise`).toBe('calibration')
    }
  })
})
