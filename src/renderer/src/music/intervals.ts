/**
 * Intervals.
 *
 * An interval has two independent parts: the *number* (how many letter names
 * it spans — a 3rd, a 5th) and the *quality* (major, minor, perfect,
 * augmented, diminished). Beginners learn to read the number off the staff by
 * counting lines and spaces, which is exactly `diatonicStep` arithmetic, so we
 * model both parts rather than collapsing to semitones.
 */

import { diatonicStep, pitchClass, type SpelledPitch } from './pitch'

export type IntervalQuality =
  | 'perfect'
  | 'major'
  | 'minor'
  | 'augmented'
  | 'diminished'

export interface Interval {
  /** 1 = unison, 2 = second, 3 = third ... 8 = octave. Can exceed 8. */
  number: number
  quality: IntervalQuality
  /** Absolute size in semitones. */
  semitones: number
}

/** Interval numbers that take perfect/aug/dim rather than major/minor. */
const PERFECT_NUMBERS = new Set([1, 4, 5, 8])

/** Semitone size of each simple interval number when perfect or major. */
const BASE_SEMITONES: Record<number, number> = {
  1: 0,
  2: 2,
  3: 4,
  4: 5,
  5: 7,
  6: 9,
  7: 11,
  8: 12
}

const ORDINALS = [
  'unison',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'octave',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth'
]

/**
 * The interval between two spelled pitches, with correct quality.
 * Direction is ignored — this reports the absolute interval.
 */
export function intervalBetween(a: SpelledPitch, b: SpelledPitch): Interval {
  const stepA = diatonicStep(a)
  const stepB = diatonicStep(b)
  const lowFirst = stepA <= stepB
  const low = lowFirst ? a : b
  const high = lowFirst ? b : a

  const stepSpan = Math.abs(stepB - stepA)
  const number = stepSpan + 1
  const semitones = Math.abs(midiOf(high) - midiOf(low))

  return { number, quality: qualityFor(number, semitones), semitones }
}

function midiOf(p: SpelledPitch): number {
  const LETTER_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  return (p.octave + 1) * 12 + LETTER_SEMITONES[p.letter]! + p.accidental
}

/**
 * Work out the quality from the interval number and its real semitone size.
 * Compound intervals (9ths and beyond) are reduced to their simple form first.
 */
export function qualityFor(number: number, semitones: number): IntervalQuality {
  // Reduce to a simple interval plus whole octaves. An octave (8) reduces to a
  // unison (1) plus one octave, a tenth (10) to a third plus one octave, and so
  // on. The expected size is then the simple interval's size plus 12 per
  // octave, compared against the FULL semitone count — reducing only one side
  // of that comparison is what made an octave read as diminished.
  const octaves = Math.floor((number - 1) / 7)
  const simpleNumber = number - 7 * octaves

  const base = BASE_SEMITONES[simpleNumber]
  if (base === undefined) return 'perfect'

  const expected = base + 12 * octaves
  const diff = semitones - expected

  if (PERFECT_NUMBERS.has(simpleNumber)) {
    if (diff === 0) return 'perfect'
    return diff > 0 ? 'augmented' : 'diminished'
  }

  if (diff === 0) return 'major'
  if (diff === -1) return 'minor'
  return diff > 0 ? 'augmented' : 'diminished'
}

/** Plain-English name, e.g. "major third". */
export function intervalName(interval: Interval): string {
  const ordinal = ORDINALS[interval.number - 1] ?? `${interval.number}th`
  if (interval.number === 1 && interval.quality === 'perfect') return 'unison'
  return `${interval.quality} ${ordinal}`
}

/** Compact label used on buttons and flashcards, e.g. "M3", "P5", "m7". */
export function intervalShorthand(interval: Interval): string {
  const q =
    interval.quality === 'major'
      ? 'M'
      : interval.quality === 'minor'
        ? 'm'
        : interval.quality === 'perfect'
          ? 'P'
          : interval.quality === 'augmented'
            ? 'A'
            : 'd'
  return `${q}${interval.number}`
}

/**
 * Semitone-only interval classification, for ear-training where spelling is
 * unknowable from sound alone. Always picks the common spelling.
 */
export function intervalFromSemitones(semitones: number): Interval {
  const abs = Math.abs(semitones)
  const simple = abs % 12
  const octaves = Math.floor(abs / 12)

  const table: Array<{ number: number; quality: IntervalQuality }> = [
    { number: 1, quality: 'perfect' }, // 0
    { number: 2, quality: 'minor' }, // 1
    { number: 2, quality: 'major' }, // 2
    { number: 3, quality: 'minor' }, // 3
    { number: 3, quality: 'major' }, // 4
    { number: 4, quality: 'perfect' }, // 5
    { number: 5, quality: 'diminished' }, // 6 (tritone)
    { number: 5, quality: 'perfect' }, // 7
    { number: 6, quality: 'minor' }, // 8
    { number: 6, quality: 'major' }, // 9
    { number: 7, quality: 'minor' }, // 10
    { number: 7, quality: 'major' } // 11
  ]

  const entry = table[simple]!
  const number = simple === 0 && octaves > 0 ? 8 + (octaves - 1) * 7 : entry.number + octaves * 7

  return { number, quality: entry.quality, semitones: abs }
}

/** Is this interval a step (2nd) — the thing beginners contrast with skips? */
export function isStep(interval: Interval): boolean {
  return interval.number === 2
}

/** Is this a skip (3rd)? */
export function isSkip(interval: Interval): boolean {
  return interval.number === 3
}

/** Do two MIDI notes form a consonant interval? Used to colour ear-training UI. */
export function isConsonant(semitones: number): boolean {
  const s = ((semitones % 12) + 12) % 12
  return [0, 3, 4, 5, 7, 8, 9].includes(s)
}

/** Interval between two raw MIDI notes, using default (sharp) spelling. */
export function semitoneInterval(a: number, b: number): Interval {
  return intervalFromSemitones(Math.abs(b - a))
}

/** Are these the same pitch class? Handy shorthand for drills. */
export function isOctaveApart(a: number, b: number): boolean {
  return a !== b && pitchClass(a) === pitchClass(b)
}
