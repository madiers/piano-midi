/**
 * Scales and key signatures.
 *
 * A 25-key controller spans exactly two octaves, so most scale work in this app
 * is one-octave-up-and-back within the available range. `scaleNotes` therefore
 * always takes an explicit starting MIDI note rather than assuming a register.
 */

import { LETTERS, pitchClass, type Accidental, type LetterName, type SpelledPitch } from './pitch'

export type ScaleType =
  | 'major'
  | 'naturalMinor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'pentatonicMajor'
  | 'pentatonicMinor'
  | 'chromatic'
  | 'blues'

/** Semitone steps from the tonic. */
export const SCALE_INTERVALS: Record<ScaleType, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  blues: [0, 3, 5, 6, 7, 10]
}

export const SCALE_LABELS: Record<ScaleType, string> = {
  major: 'Major',
  naturalMinor: 'Natural minor',
  harmonicMinor: 'Harmonic minor',
  melodicMinor: 'Melodic minor',
  pentatonicMajor: 'Major pentatonic',
  pentatonicMinor: 'Minor pentatonic',
  chromatic: 'Chromatic',
  blues: 'Blues'
}

/**
 * MIDI notes of a scale starting at `tonicMidi`, ascending.
 * `octaves` of 1 yields 8 notes for a major scale (tonic repeated on top).
 */
export function scaleNotes(tonicMidi: number, type: ScaleType, octaves = 1): number[] {
  const steps = SCALE_INTERVALS[type]
  const out: number[] = []
  for (let o = 0; o < octaves; o++) {
    for (const step of steps) out.push(tonicMidi + o * 12 + step)
  }
  out.push(tonicMidi + octaves * 12)
  return out
}

// ----------------------------------------------------------------- key signatures

export interface KeySignature {
  /** Tonic letter plus accidental, e.g. "F#" or "Bb". */
  tonic: string
  mode: 'major' | 'minor'
  /** Positive = that many sharps, negative = that many flats, 0 = C major/A minor. */
  fifths: number
  /** Letters that carry an accidental in this key, in the order they appear. */
  alteredLetters: LetterName[]
  usesFlats: boolean
}

const SHARP_ORDER: LetterName[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER: LetterName[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/** Major keys by number of sharps (positive) / flats (negative). */
const MAJOR_BY_FIFTHS: Record<number, string> = {
  [-7]: 'Cb',
  [-6]: 'Gb',
  [-5]: 'Db',
  [-4]: 'Ab',
  [-3]: 'Eb',
  [-2]: 'Bb',
  [-1]: 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#'
}

const MINOR_BY_FIFTHS: Record<number, string> = {
  [-7]: 'Ab',
  [-6]: 'Eb',
  [-5]: 'Bb',
  [-4]: 'F',
  [-3]: 'C',
  [-2]: 'G',
  [-1]: 'D',
  0: 'A',
  1: 'E',
  2: 'B',
  3: 'F#',
  4: 'C#',
  5: 'G#',
  6: 'D#',
  7: 'A#'
}

export function keySignature(fifths: number, mode: 'major' | 'minor' = 'major'): KeySignature {
  const tonic = (mode === 'major' ? MAJOR_BY_FIFTHS : MINOR_BY_FIFTHS)[fifths] ?? 'C'
  const usesFlats = fifths < 0
  const alteredLetters = usesFlats
    ? FLAT_ORDER.slice(0, Math.abs(fifths))
    : SHARP_ORDER.slice(0, fifths)
  return { tonic, mode, fifths, alteredLetters, usesFlats }
}

/** Look up a key signature by its tonic name, e.g. "G" major -> 1 sharp. */
export function keySignatureFor(tonic: string, mode: 'major' | 'minor' = 'major'): KeySignature {
  const table = mode === 'major' ? MAJOR_BY_FIFTHS : MINOR_BY_FIFTHS
  for (const [fifths, name] of Object.entries(table)) {
    if (name === tonic) return keySignature(Number(fifths), mode)
  }
  return keySignature(0, mode)
}

/** The default accidental applied to a letter by this key signature. */
export function accidentalInKey(letter: LetterName, key: KeySignature): Accidental {
  if (!key.alteredLetters.includes(letter)) return 0
  return key.usesFlats ? -1 : 1
}

/**
 * Spell a MIDI note the way it should be written in a given key.
 *
 * This is what makes the notation read correctly: in D major, MIDI 66 must be
 * written F#, not Gb. We prefer the spelling whose natural-or-key-accidental
 * form matches, and otherwise fall back to the key's accidental direction.
 */
export function spellInKey(midi: number, key: KeySignature): SpelledPitch {
  const pc = pitchClass(midi)

  // Try each letter and see which one lands on this pitch class with an
  // accidental the key would plausibly write.
  const LETTER_SEMITONES: Record<LetterName, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  }

  const candidates: Array<{ pitch: SpelledPitch; cost: number }> = []

  for (const letter of LETTERS) {
    const natural = LETTER_SEMITONES[letter]
    let diff = pc - natural
    // Normalise into -2..+2 accounting for octave wrap.
    if (diff > 6) diff -= 12
    if (diff < -6) diff += 12
    if (diff < -2 || diff > 2) continue

    const accidental = diff as Accidental
    // Octave must be derived from the natural letter position, not the MIDI
    // number, so B#3 and Cb4 land in the right octave.
    let octave = Math.floor(midi / 12) - 1
    if (letter === 'B' && accidental > 0 && pc < 6) octave -= 1
    if (letter === 'C' && accidental < 0 && pc > 6) octave += 1

    const keyAcc = accidentalInKey(letter, key)
    let cost = 0
    if (accidental !== keyAcc) cost += 2 // needs an explicit accidental
    if (Math.abs(accidental) === 2) cost += 6 // double accidentals are a last resort
    if (accidental !== 0 && key.usesFlats && accidental > 0) cost += 1 // wrong direction
    if (accidental !== 0 && !key.usesFlats && accidental < 0) cost += 1

    candidates.push({ pitch: { letter, accidental, octave }, cost })
  }

  candidates.sort((a, b) => a.cost - b.cost)
  return candidates[0]?.pitch ?? { letter: 'C', accidental: 0, octave: Math.floor(midi / 12) - 1 }
}

/** Standard right-hand fingering for a one-octave ascending major scale. */
export const RH_MAJOR_SCALE_FINGERING = [1, 2, 3, 1, 2, 3, 4, 5] as const

/** Standard left-hand fingering for a one-octave ascending major scale. */
export const LH_MAJOR_SCALE_FINGERING = [5, 4, 3, 2, 1, 3, 2, 1] as const

/** Is every note of this scale playable inside the given key range? */
export function scaleFitsRange(
  tonicMidi: number,
  type: ScaleType,
  lowest: number,
  highest: number,
  octaves = 1
): boolean {
  const notes = scaleNotes(tonicMidi, type, octaves)
  return notes.every((n) => n >= lowest && n <= highest)
}
