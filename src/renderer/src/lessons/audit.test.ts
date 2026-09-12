/**
 * Checks that the course never asks for something it has not taught yet.
 *
 * This is the class of bug that made Unit 1 ask a complete beginner to play
 * "C#3" as the seventh lesson, nine units before sharps are introduced — and
 * in a lesson whose own text is about the SHAPE of the black-key groups, not
 * their names.
 */

import { describe, expect, it } from 'vitest'
import { ALL_LESSONS } from './curriculum'
import { isBlackKey, noteName } from '../music/pitch'
import type { Lesson } from '@shared/types'

/**
 * Notes whose NAME or NOTATION the student is shown.
 *
 * Deliberately not "every key the student touches". Unit 1's black-key-group
 * drill has the student press black keys, which is the point of the lesson,
 * but it prompts with a shape ("a group of TWO") and never displays an
 * accidental. Touching a black key is fine; being asked for "C#" is not.
 */
function notesNamedTo(lesson: Lesson): number[] {
  const ex = lesson.exercise
  if (!ex) return []

  switch (ex.kind) {
    case 'findNote':
      // Group prompts show a shape, never a note name.
      return ex.groupMode ? [] : ex.pool
    case 'noteName':
      return ex.pool
    case 'sightRead':
      // The staff renders every note, accidentals included.
      return ex.generator.pool
    case 'rhythmTap':
      // A single repeated pitch, and pitch is not what is being read.
      return []
    case 'playAlong':
      return ex.phrase.notes.flatMap((n) => n.midi)
    default:
      return []
  }
}

describe('the course never asks for something it has not taught', () => {
  it('shows no accidental before sharps and flats are introduced', () => {
    const taught = ALL_LESSONS.findIndex((l) => l.newConcepts.includes('sharp'))
    expect(taught, 'no lesson introduces sharps').toBeGreaterThan(0)

    const early: string[] = []
    ALL_LESSONS.slice(0, taught).forEach((lesson) => {
      const black = notesNamedTo(lesson).filter(isBlackKey)
      if (black.length > 0) {
        early.push(
          `${lesson.id} "${lesson.title}" names ${black.map((n) => noteName(n)).join(', ')}, but sharps are not taught until ${ALL_LESSONS[taught]!.id}`
        )
      }
    })

    expect(early).toEqual([])
  })

  it('still has the black-key-group lesson ask for a shape, not a name', () => {
    const lesson = ALL_LESSONS.find((l) => l.id === 'u1.2')
    expect(lesson?.exercise?.kind).toBe('findNote')
    if (lesson?.exercise?.kind !== 'findNote') return
    // If this is ever switched back to a named-note drill, the test above
    // starts failing again — which is the point.
    expect(lesson.exercise.groupMode).toBeDefined()
  })

  it('does not read the bass clef before it is introduced', () => {
    const taught = ALL_LESSONS.findIndex((l) => l.newConcepts.includes('bass clef'))
    expect(taught).toBeGreaterThan(0)

    const early: string[] = []
    ALL_LESSONS.slice(0, taught).forEach((lesson) => {
      const ex = lesson.exercise
      if (ex?.kind === 'noteName' && (ex.clef === 'bass' || ex.clef === 'grand')) {
        // The grand staff is introduced with Middle C, which legitimately sits
        // between the staves; only a genuinely bass-clef pool is a problem.
        if (ex.pool.some((n) => n < 57)) {
          early.push(`${lesson.id} "${lesson.title}" reads below A3 in a ${ex.clef} clef`)
        }
      }
    })

    expect(early).toEqual([])
  })

  it('teaches eighth notes before generating them', () => {
    const taught = ALL_LESSONS.findIndex((l) => l.newConcepts.includes('eighth note'))
    expect(taught).toBeGreaterThan(0)

    const early: string[] = []
    ALL_LESSONS.slice(0, taught).forEach((lesson) => {
      const ex = lesson.exercise
      const durations =
        ex?.kind === 'sightRead' || ex?.kind === 'rhythmTap' ? ex.generator.durations : []
      if (durations.some((d) => d < 1)) {
        early.push(`${lesson.id} "${lesson.title}" generates notes shorter than a quarter`)
      }
    })

    expect(early).toEqual([])
  })
})
