/**
 * End-to-end checks over real curriculum lessons.
 *
 * These drive actual generated phrases through the real grader, rather than
 * hand-made fixtures, so a curriculum change that produces ungradeable
 * material fails here rather than in front of a student.
 */

import { describe, expect, it } from 'vitest'
import { ALL_LESSONS, getLesson } from './curriculum'
import { generatePhrase, generateRhythm, phraseFromNotes } from './generator'
import { PerformanceGrader } from './PerformanceGrader'
import { scaleNotes, RH_MAJOR_SCALE_FINGERING } from '../music/scales'
import type { Phrase } from '@shared/types'

/** Play a phrase perfectly and return the result. */
function playPerfectly(phrase: Phrase, bpm: number, waitMode = false) {
  const events = PerformanceGrader.fromPhrase(phrase, bpm)
  const grader = new PerformanceGrader(events, {
    profile: 'standard',
    bpm,
    waitMode,
    tempoPercent: 100
  })
  grader.start(0)

  // In wait mode there is no transport, but timestamps must still advance:
  // the grader suppresses the same pitch retriggered within 30 ms as a
  // hardware double-trigger, so a student playing everything at t=0 would
  // lose every repeated note.
  let waitClock = 0
  for (const event of events) {
    for (const pitch of event.pitches) {
      if (waitMode) waitClock += 500
      grader.noteOn(pitch, waitMode ? waitClock : event.onsetMs, 80)
    }
  }
  grader.tick(Number.MAX_SAFE_INTEGER / 2)
  return grader.complete()
}

describe('playing a generated lesson phrase', () => {
  it('scores three stars when played perfectly', () => {
    const lesson = getLesson('u5.6')
    expect(lesson?.exercise?.kind).toBe('sightRead')
    if (lesson?.exercise?.kind !== 'sightRead') return

    const phrase = generatePhrase(lesson.exercise.generator, 4242)
    const result = playPerfectly(phrase, phrase.tempoBpm)

    expect(result.pitchAccuracy).toBe(1)
    expect(result.missed).toBe(0)
    expect(result.wrong).toBe(0)
    expect(result.stars).toBe(3)
  })

  it('scores zero when nothing is played', () => {
    const lesson = getLesson('u5.6')
    if (lesson?.exercise?.kind !== 'sightRead') return
    const phrase = generatePhrase(lesson.exercise.generator, 7)
    const events = PerformanceGrader.fromPhrase(phrase, phrase.tempoBpm)
    const grader = new PerformanceGrader(events, {
      profile: 'standard',
      bpm: phrase.tempoBpm,
      tempoPercent: 100
    })
    grader.start(0)
    grader.tick(Number.MAX_SAFE_INTEGER / 2)

    const result = grader.complete()
    expect(result.missed).toBe(result.totalExpected)
    expect(result.stars).toBe(0)
    expect(result.final).toBe(0)
  })

  it('fails a lesson when half the notes are wrong', () => {
    const lesson = getLesson('u5.6')
    if (lesson?.exercise?.kind !== 'sightRead') return
    const phrase = generatePhrase(lesson.exercise.generator, 11)
    const events = PerformanceGrader.fromPhrase(phrase, phrase.tempoBpm)
    const grader = new PerformanceGrader(events, {
      profile: 'standard',
      bpm: phrase.tempoBpm,
      tempoPercent: 100
    })
    grader.start(0)

    events.forEach((event, index) => {
      for (const pitch of event.pitches) {
        // Every other note is played a tone too high.
        grader.noteOn(index % 2 === 0 ? pitch : pitch + 2, event.onsetMs, 80)
      }
    })
    grader.tick(Number.MAX_SAFE_INTEGER / 2)

    const result = grader.complete()
    expect(result.pitchAccuracy).toBeLessThan(0.7)
    expect(result.final).toBeLessThan(lesson.mastery.minScore)
  })

  it('grades every sight-reading lesson in the course without throwing', () => {
    const sightRead = ALL_LESSONS.filter((l) => l.exercise?.kind === 'sightRead')
    expect(sightRead.length).toBeGreaterThan(5)

    for (const lesson of sightRead) {
      if (lesson.exercise?.kind !== 'sightRead') continue
      const phrase = generatePhrase(lesson.exercise.generator, 99)
      expect(phrase.notes.length, `${lesson.id} generated an empty phrase`).toBeGreaterThan(0)

      const result = playPerfectly(phrase, phrase.tempoBpm)
      expect(result.pitchAccuracy, `${lesson.id} could not be played perfectly`).toBe(1)
    }
  })

  it('grades every rhythm lesson, where any pitch is acceptable', () => {
    const rhythm = ALL_LESSONS.filter((l) => l.exercise?.kind === 'rhythmTap')
    for (const lesson of rhythm) {
      if (lesson.exercise?.kind !== 'rhythmTap') continue
      const phrase = generateRhythm(lesson.exercise.generator, 5)
      expect(phrase.notes.length, `${lesson.id} generated no rhythm`).toBeGreaterThan(0)
      // A rhythm exercise is a single repeated pitch, by construction.
      expect(new Set(phrase.notes.flatMap((n) => n.midi)).size).toBe(1)

      const result = playPerfectly(phrase, phrase.tempoBpm)
      expect(result.stars, `${lesson.id} could not be passed`).toBe(3)
    }
  })

  it('builds a playable scale for every scale lesson', () => {
    const scales = ALL_LESSONS.filter((l) => l.exercise?.kind === 'scaleRun')
    expect(scales.length).toBeGreaterThan(3)

    for (const lesson of scales) {
      if (lesson.exercise?.kind !== 'scaleRun') continue
      const notes = scaleNotes(
        lesson.exercise.tonicMidi,
        lesson.exercise.scaleType,
        lesson.exercise.octaves
      )
      const phrase = phraseFromNotes(notes, {
        tempoBpm: lesson.exercise.tempoBpm,
        hand: lesson.exercise.hands === 'left' ? 'left' : 'right',
        fingers: [...RH_MAJOR_SCALE_FINGERING]
      })
      const result = playPerfectly(phrase, phrase.tempoBpm)
      expect(result.pitchAccuracy, `${lesson.id} scale could not be played`).toBe(1)
    }
  })

  it('lets wait mode pass without any sense of timing', () => {
    const lesson = getLesson('u5.6')
    if (lesson?.exercise?.kind !== 'sightRead') return
    const phrase = generatePhrase(lesson.exercise.generator, 3)

    const result = playPerfectly(phrase, phrase.tempoBpm, true)
    expect(result.pitchAccuracy).toBe(1)
    expect(result.missed).toBe(0)
  })
})
