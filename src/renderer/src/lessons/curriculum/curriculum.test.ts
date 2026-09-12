import { describe, expect, it } from 'vitest'
import { ANCHORS, type Exercise, type Lesson } from '@shared/types'
import { ALL_LESSONS, CURRICULUM, firstIncompleteLesson, isLessonUnlocked, nextLesson } from './index'
import { createEmptyProgress } from '@shared/types'
import { generatePhrase } from '../generator'
import { chordNotes, bestInversionForRange } from '../../music/chords'
import { scaleNotes } from '../../music/scales'
import { PRIMARY_CHORDS_C } from './helpers'

/** Every MIDI note an exercise could possibly ask the student to play. */
function notesRequiredBy(exercise: Exercise): number[] {
  switch (exercise.kind) {
    case 'noteName':
    case 'findNote':
      return exercise.pool
    case 'sightRead':
    case 'rhythmTap': {
      // Generate several seeds; the pool bounds it, but check real output too.
      const notes = new Set<number>(exercise.generator.pool)
      for (const seed of [1, 2, 3, 17, 99]) {
        for (const note of generatePhrase(exercise.generator, seed).notes) {
          for (const midi of note.midi) notes.add(midi)
        }
      }
      return [...notes]
    }
    case 'playAlong':
      return exercise.phrase.notes.flatMap((n) => n.midi)
    case 'chordBuild': {
      const notes = new Set<number>()
      for (const root of exercise.roots) {
        for (const quality of exercise.qualities) {
          for (const inversion of exercise.inversions) {
            for (const midi of chordNotes({ rootMidi: root, quality, inversion })) notes.add(midi)
          }
        }
      }
      return [...notes]
    }
    case 'intervalEar': {
      const notes = new Set<number>()
      for (let root = exercise.rootRange[0]; root <= exercise.rootRange[1]; root++) {
        notes.add(root)
        for (const semis of exercise.semitones) notes.add(root + semis)
      }
      return [...notes]
    }
    case 'scaleRun':
      return scaleNotes(exercise.tonicMidi, exercise.scaleType, exercise.octaves)
    case 'freePlay':
      return []
    case 'calibration':
      // Calibration measures whatever keyboard the student actually has, so
      // it never demands a particular note.
      return []
  }
}

/** The playable window for a lesson: its own range, else its anchor's. */
function playableRange(lesson: Lesson): [number, number] | null {
  if (lesson.requiredRange) return lesson.requiredRange
  if (lesson.anchor) {
    const anchor = ANCHORS[lesson.anchor]
    return [anchor.low, anchor.high]
  }
  return null
}

describe('curriculum structure', () => {
  it('has 16 units and a substantial number of lessons', () => {
    expect(CURRICULUM).toHaveLength(16)
    expect(ALL_LESSONS.length).toBeGreaterThanOrEqual(60)
  })

  it('gives every lesson a unique id', () => {
    const ids = ALL_LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('numbers units in order', () => {
    CURRICULUM.forEach((unit, index) => expect(unit.index).toBe(index))
  })

  it('gives every non-concept lesson something to do', () => {
    for (const lesson of ALL_LESSONS) {
      if (lesson.kind !== 'concept') {
        expect(lesson.exercise, `${lesson.id} (${lesson.title}) has no exercise`).toBeDefined()
      }
    }
  })

  it('gives every lesson a title and teaching content or an exercise', () => {
    for (const lesson of ALL_LESSONS) {
      expect(lesson.title.length).toBeGreaterThan(0)
      expect(lesson.blocks.length > 0 || lesson.exercise !== undefined).toBe(true)
    }
  })
})

describe('the 25-key constraint', () => {
  it('never asks for a note outside the lesson range', () => {
    const violations: string[] = []

    for (const lesson of ALL_LESSONS) {
      if (!lesson.exercise) continue
      const range = playableRange(lesson)
      if (!range) continue

      for (const midi of notesRequiredBy(lesson.exercise)) {
        if (midi < range[0] || midi > range[1]) {
          violations.push(
            `${lesson.id} "${lesson.title}" needs MIDI ${midi}, outside ${range[0]}-${range[1]}`
          )
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('keeps every anchor within 25 keys', () => {
    for (const anchor of Object.values(ANCHORS)) {
      expect(anchor.high - anchor.low).toBeLessThanOrEqual(24)
    }
  })

  it('uses primary chords that fit the MID anchor', () => {
    // This is the specific trap: the textbook C-position G7 needs B2 = 47,
    // one key below a C3-anchored 25-key controller.
    const { low, high } = ANCHORS.MID
    for (const [name, notes] of Object.entries(PRIMARY_CHORDS_C)) {
      for (const midi of notes) {
        expect(midi, `${name} chord note ${midi} is outside the anchor`).toBeGreaterThanOrEqual(low)
        expect(midi).toBeLessThanOrEqual(high)
      }
    }
    // And the textbook voicing genuinely does not fit, which is why we deviate.
    expect(47).toBeLessThan(low)
  })

  it('can voice every primary triad inside the MID anchor', () => {
    const { low, high } = ANCHORS.MID
    for (const root of [48, 53, 55]) {
      const voiced = bestInversionForRange({ rootMidi: root, quality: 'major', inversion: 0 }, low, high)
      expect(voiced).not.toBeNull()
    }
  })
})

describe('pedagogical ordering', () => {
  it('teaches rhythm before pitch reading', () => {
    const firstRhythm = ALL_LESSONS.findIndex((l) => l.exercise?.kind === 'rhythmTap')
    const firstRead = ALL_LESSONS.findIndex((l) => l.exercise?.kind === 'noteName')
    expect(firstRhythm).toBeGreaterThanOrEqual(0)
    expect(firstRhythm).toBeLessThan(firstRead)
  })

  it('introduces the staff before requiring staff-only reading', () => {
    const staffConcept = ALL_LESSONS.findIndex((l) => l.newConcepts.includes('staff'))
    const firstStaffOnly = ALL_LESSONS.findIndex(
      (l) => l.exercise?.kind === 'sightRead' && l.exercise.staffOnly
    )
    expect(staffConcept).toBeGreaterThanOrEqual(0)
    expect(staffConcept).toBeLessThan(firstStaffOnly)
  })

  it('teaches all three landmarks before interval reading', () => {
    const lastLandmark = Math.max(
      ALL_LESSONS.findIndex((l) => l.newConcepts.includes('Middle C')),
      ALL_LESSONS.findIndex((l) => l.newConcepts.includes('Treble G')),
      ALL_LESSONS.findIndex((l) => l.newConcepts.includes('Bass F'))
    )
    const intervals = ALL_LESSONS.findIndex((l) => l.newConcepts.includes('interval'))
    expect(lastLandmark).toBeLessThan(intervals)
  })

  it('teaches triads before primary chords', () => {
    const triad = ALL_LESSONS.findIndex((l) => l.newConcepts.includes('triad'))
    const primary = ALL_LESSONS.findIndex((l) => l.newConcepts.includes('I chord'))
    expect(triad).toBeLessThan(primary)
  })

  it('teaches F major before G major, because G position does not fit', () => {
    const f = ALL_LESSONS.findIndex((l) => l.newConcepts.includes('key signature'))
    const g = ALL_LESSONS.findIndex((l) => l.newConcepts.includes('key signature G'))
    expect(f).toBeGreaterThanOrEqual(0)
    expect(f).toBeLessThan(g)
  })

  it('requires at least one staff-only pass, so falling notes cannot replace reading', () => {
    const staffOnly = ALL_LESSONS.filter(
      (l) => l.exercise?.kind === 'sightRead' && l.exercise.staffOnly
    )
    expect(staffOnly.length).toBeGreaterThanOrEqual(10)
  })

  it('does not schedule a sustain-pedal lesson, since the hardware has none', () => {
    const concepts = ALL_LESSONS.flatMap((l) => l.newConcepts.map((c) => c.toLowerCase()))
    expect(concepts.some((c) => c.includes('pedal'))).toBe(false)
  })
})

describe('progression gating', () => {
  it('unlocks the first lesson and locks the rest', () => {
    const progress = createEmptyProgress()
    expect(isLessonUnlocked(ALL_LESSONS[0]!.id, progress)).toBe(true)
    expect(isLessonUnlocked(ALL_LESSONS[1]!.id, progress)).toBe(false)
  })

  it('unlocks the next lesson once the previous one is complete', () => {
    const progress = createEmptyProgress()
    const first = ALL_LESSONS[0]!
    progress.lessons[first.id] = {
      lessonId: first.id,
      stars: 3,
      bestScore: 1,
      bestPitchAccuracy: 1,
      attempts: 1,
      bestTempoPercent: 100,
      completed: true,
      lastPlayedAt: '2026-01-01T00:00:00.000Z'
    }
    expect(isLessonUnlocked(ALL_LESSONS[1]!.id, progress)).toBe(true)
    expect(firstIncompleteLesson(progress).id).toBe(ALL_LESSONS[1]!.id)
  })

  it('walks the whole course in order', () => {
    let lesson = ALL_LESSONS[0]
    let count = 1
    while (lesson) {
      const next = nextLesson(lesson.id)
      if (!next) break
      lesson = next
      count += 1
    }
    expect(count).toBe(ALL_LESSONS.length)
  })
})
