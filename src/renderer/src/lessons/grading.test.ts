import { describe, expect, it } from 'vitest'
import {
  GRADING_PROFILES,
  appliedInputOffset,
  classifyError,
  computeScore,
  judgeDuration,
  judgeTiming,
  passesMastery,
  timingWindows
} from './grading'
import { PerformanceGrader, type ExpectedEvent } from './PerformanceGrader'

function makeEvent(
  id: string,
  onsetMs: number,
  pitches: number[],
  durationMs = 500
): ExpectedEvent {
  return {
    id,
    onsetMs,
    durationMs,
    pitches,
    hand: 'right',
    unmatched: new Set(pitches),
    results: new Map(),
    onsetTimes: [],
    expired: false
  }
}

describe('timing windows', () => {
  it('scales with tempo and clamps at the extremes', () => {
    // Documented reference values from the curriculum design.
    const standard = GRADING_PROFILES.standard
    expect(timingWindows(60, standard)).toEqual({ perfect: 50, good: 110, ok: 200 })
    expect(timingWindows(90, standard).perfect).toBeCloseTo(35, 5)
    // At fast tempos the fractional window would go below the floor.
    expect(timingWindows(120, standard)).toEqual({ perfect: 35, good: 70, ok: 120 })
  })

  it('makes the beginner profile more forgiving', () => {
    const beginner = timingWindows(90, GRADING_PROFILES.beginner)
    const strict = timingWindows(90, GRADING_PROFILES.strict)
    expect(beginner.ok).toBeGreaterThan(strict.ok)
    expect(beginner.ok / strict.ok).toBeCloseTo(1.5 / 0.7, 4)
  })

  it('grades by tier', () => {
    const w = timingWindows(90, GRADING_PROFILES.standard)
    const p = GRADING_PROFILES.standard
    expect(judgeTiming(0, w, p)).toBe('perfect')
    expect(judgeTiming(30, w, p)).toBe('perfect')
    expect(judgeTiming(60, w, p)).toBe('good')
    expect(judgeTiming(120, w, p)).toBe('ok')
    expect(judgeTiming(400, w, p)).toBe('miss')
  })

  it('gives beginners extra room on the early side only', () => {
    // Novices systematically anticipate the beat, so early gets a wider window.
    const w = timingWindows(90, GRADING_PROFILES.beginner)
    const p = GRADING_PROFILES.beginner
    const justOutside = w.perfect * 1.2
    expect(judgeTiming(-justOutside, w, p)).toBe('perfect')
    expect(judgeTiming(justOutside, w, p)).not.toBe('perfect')
  })
})

describe('error classification', () => {
  it('recognises the six common beginner mistakes', () => {
    expect(classifyError(72, 60)).toBe('octave')
    expect(classifyError(61, 60)).toBe('right-letter-wrong-accidental')
    expect(classifyError(62, 60)).toBe('adjacent-white')
    expect(classifyError(75, 60)).toBe('unrelated')
  })

  it('treats a semitone between two white keys as a neighbour slip', () => {
    // E to F is a semitone and both are white.
    expect(classifyError(65, 64)).toBe('semitone-neighbour')
  })
})

describe('scoring', () => {
  it('weights pitch above timing', () => {
    const allRight = computeScore(10, 10, Array(10).fill('perfect'), 0, 100)
    expect(allRight.final).toBeCloseTo(1, 5)
    expect(allRight.stars).toBe(3)

    // Right notes, sloppy timing still scores respectably.
    const sloppy = computeScore(10, 10, Array(10).fill('ok'), 0, 100)
    expect(sloppy.final).toBeCloseTo(0.65 + 0.35 * 0.5, 5)
    expect(sloppy.stars).toBe(2)
  })

  it('caps the penalty for extra notes', () => {
    // Unweighted keys mean brushed neighbours; the penalty must not spiral.
    const many = computeScore(10, 10, Array(10).fill('perfect'), 50, 100)
    expect(many.extrasPenalty).toBe(0.15)
    expect(many.final).toBeCloseTo(0.85, 5)
  })

  it('withholds three stars below full tempo', () => {
    const perfectButSlow = computeScore(10, 10, Array(10).fill('perfect'), 0, 80)
    expect(perfectButSlow.final).toBeCloseTo(1, 5)
    expect(perfectButSlow.stars).toBe(2)
  })

  it('gates progression at 80% score and 80% tempo', () => {
    expect(passesMastery(0.85, 100)).toBe(true)
    expect(passesMastery(0.85, 80)).toBe(true)
    expect(passesMastery(0.79, 100)).toBe(false)
    expect(passesMastery(0.85, 60)).toBe(false)
  })
})

describe('input offset', () => {
  it('applies the whole measured offset for beginners', () => {
    const { applied, residual } = appliedInputOffset(-70, GRADING_PROFILES.beginner)
    expect(applied).toBe(-70)
    expect(residual).toBe(0)
  })

  it('caps the device correction and leaves the human part coachable', () => {
    // Subtracting all of a -70 ms offset would permanently hide a real habit.
    const { applied, residual } = appliedInputOffset(-70, GRADING_PROFILES.standard)
    expect(applied).toBe(-30)
    expect(residual).toBe(-40)
  })
})

describe('durations', () => {
  it('flags under-held notes', () => {
    expect(judgeDuration(500, 1000, 'normal')).toBe('ok')
    expect(judgeDuration(200, 1000, 'normal')).toBe('clipped')
  })

  it('checks legato overlap', () => {
    expect(judgeDuration(1000, 1000, 'legato', 0)).toBe('ok')
    expect(judgeDuration(1000, 1000, 'legato', 100)).toBe('broken-legato')
    expect(judgeDuration(600, 1000, 'legato', 0)).toBe('clipped')
  })

  it('requires staccato to be short in both relative and absolute terms', () => {
    expect(judgeDuration(100, 1000, 'staccato')).toBe('ok')
    expect(judgeDuration(400, 2000, 'staccato')).toBe('too-long')
  })
})

describe('PerformanceGrader', () => {
  const opts = { profile: 'standard' as const, bpm: 60 }

  it('matches correct notes and scores them', () => {
    const events = [makeEvent('a', 0, [60]), makeEvent('b', 1000, [62])]
    const grader = new PerformanceGrader(events, opts)
    grader.start(0)

    grader.noteOn(60, 0, 80)
    grader.noteOn(62, 1000, 80)

    const result = grader.complete()
    expect(result.correct).toBe(2)
    expect(result.wrong).toBe(0)
    expect(result.pitchAccuracy).toBe(1)
    expect(result.stars).toBe(3)
  })

  it('prefers the event that wants this pitch over the merely nearest one', () => {
    // Two events close together; the student plays the SECOND event's pitch
    // slightly early. Matching by nearest onset alone would call it wrong.
    const events = [makeEvent('a', 0, [60]), makeEvent('b', 150, [67])]
    const grader = new PerformanceGrader(events, opts)
    grader.start(0)

    grader.noteOn(67, 20, 80)
    expect(events[1]!.unmatched.size).toBe(0)
    expect(events[0]!.unmatched.has(60)).toBe(true)
  })

  it('ignores key noise and double triggers', () => {
    const events = [makeEvent('a', 0, [60])]
    const grader = new PerformanceGrader(events, opts)
    grader.start(0)

    grader.noteOn(60, 0, 3) // below the velocity gate
    expect(events[0]!.unmatched.size).toBe(1)

    grader.noteOn(60, 0, 80)
    grader.noteOn(60, 10, 80) // double trigger within 30 ms
    const result = grader.complete()
    expect(result.correct).toBe(1)
    expect(result.extras).toBe(0)
  })

  it('counts a note played far from anything as an extra, not a wrong note', () => {
    // The stray note lands in the gap between two events, outside either
    // accept window, so it belongs to neither and must not consume a slot.
    const events = [makeEvent('a', 0, [60]), makeEvent('b', 4000, [62])]
    const grader = new PerformanceGrader(events, opts)
    grader.start(0)
    grader.noteOn(60, 0, 80)
    grader.noteOn(75, 2000, 80)

    expect(events[1]!.unmatched.has(62)).toBe(true)
    const result = grader.complete()
    expect(result.extras).toBe(1)
    expect(result.wrong).toBe(0)
  })

  it('stops grading once every expected note is accounted for', () => {
    // Notes played after the phrase ends (ringing out, a stray finger) must
    // not retroactively damage a finished score.
    const events = [makeEvent('a', 0, [60])]
    const grader = new PerformanceGrader(events, opts)
    grader.start(0)
    grader.noteOn(60, 0, 80)
    expect(grader.isFinished).toBe(true)

    grader.noteOn(75, 5000, 80)
    const result = grader.complete()
    expect(result.extras).toBe(0)
    expect(result.final).toBeCloseTo(1, 5)
  })

  it('reports missed notes once the playhead passes them', () => {
    const events = [makeEvent('a', 0, [60]), makeEvent('b', 1000, [62])]
    const grader = new PerformanceGrader(events, opts)
    grader.start(0)
    grader.noteOn(60, 0, 80)
    grader.tick(3000)

    const result = grader.complete()
    expect(result.missed).toBe(1)
    expect(result.pitchAccuracy).toBe(0.5)
  })

  it('classifies a wrong note with a teaching hint', () => {
    const events = [makeEvent('a', 0, [60])]
    const kinds: string[] = []
    const grader = new PerformanceGrader(events, {
      ...opts,
      onFeedback: (e) => {
        if (e.type === 'wrong') kinds.push(e.kind)
      }
    })
    grader.start(0)
    grader.noteOn(72, 0, 80) // right letter, wrong octave

    expect(kinds).toEqual(['octave'])
  })

  it('grades a chord as one event and tracks its spread', () => {
    const events = [makeEvent('a', 0, [60, 64, 67])]
    const grader = new PerformanceGrader(events, opts)
    grader.start(0)
    grader.noteOn(60, 0, 80)
    grader.noteOn(64, 25, 80)
    grader.noteOn(67, 45, 80)

    const result = grader.complete()
    expect(result.correct).toBe(3)
    expect(result.maxChordSpreadMs).toBe(45)
  })

  it('advances only on the right note in wait mode, without timing pressure', () => {
    const events = [makeEvent('a', 0, [60]), makeEvent('b', 1000, [62])]
    const grader = new PerformanceGrader(events, { ...opts, waitMode: true })

    expect(grader.nextEvent?.id).toBe('a')
    grader.noteOn(64, 99999, 80) // wrong: does not advance
    expect(grader.nextEvent?.id).toBe('a')

    grader.noteOn(60, 99999, 80)
    expect(grader.nextEvent?.id).toBe('b')

    grader.noteOn(62, 500000, 80) // absurdly late, still fine in wait mode
    expect(grader.isFinished).toBe(true)
    expect(grader.complete().pitchAccuracy).toBe(1)
  })

  it('reports a consistent early bias so it can be coached', () => {
    const events = [0, 1000, 2000].map((t, i) => makeEvent(`e${i}`, t, [60 + i]))
    const grader = new PerformanceGrader(events, opts)
    grader.start(0)
    grader.noteOn(60, -40, 80)
    grader.noteOn(61, 960, 80)
    grader.noteOn(62, 1955, 80)

    const result = grader.complete()
    expect(result.meanTimingErrorMs).toBeLessThan(-30)
  })
})
