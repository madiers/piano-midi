/**
 * Pitch primitives.
 *
 * Everything in the app speaks MIDI note numbers (0-127) as the single source
 * of truth for "which key". Spelling (C# vs Db) is a *presentation* concern and
 * is resolved separately, because the same key is written differently depending
 * on the key signature — which matters a lot once we render notation.
 *
 * Convention: scientific pitch notation, middle C = C4 = MIDI 60.
 * (Some hardware/DAWs call middle C "C3". We expose an octave-naming offset in
 * settings for that, but internally C4 = 60 always.)
 */

export type LetterName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/** -2 = double flat, -1 = flat, 0 = natural, 1 = sharp, 2 = double sharp */
export type Accidental = -2 | -1 | 0 | 1 | 2

export interface SpelledPitch {
  letter: LetterName
  accidental: Accidental
  /** Scientific octave. C4 is middle C. */
  octave: number
}

export const LETTERS: readonly LetterName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

/** Semitone offset of each natural letter above C. */
const LETTER_SEMITONES: Record<LetterName, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
}

/** Diatonic step index of each letter (C=0 .. B=6). Used for staff placement. */
const LETTER_STEPS: Record<LetterName, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6
}

export const MIDDLE_C = 60
export const MIN_MIDI = 0
export const MAX_MIDI = 127

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

/** True for the black keys of a piano. */
export function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10
}

/** Pitch class 0-11, where 0 = C. Safe for negative input. */
export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

/** Scientific octave number for a MIDI note. MIDI 60 -> 4. */
export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1
}

/**
 * Short display name, e.g. 60 -> "C4", 61 -> "C#4" (or "Db4" with flats).
 * This is the quick path for UI labels; use `spell()` when notation needs a
 * key-signature-correct spelling.
 */
export function noteName(midi: number, useFlats = false): string {
  const table = useFlats ? FLAT_NAMES : SHARP_NAMES
  const name = table[pitchClass(midi)]
  return `${name}${octaveOf(midi)}`
}

/** Name without the octave, e.g. 61 -> "C#". */
export function pitchClassName(midi: number, useFlats = false): string {
  const table = useFlats ? FLAT_NAMES : SHARP_NAMES
  return table[pitchClass(midi)]!
}

/** MIDI number for a spelled pitch. Handles enharmonics like Cb4 and B#3. */
export function spelledToMidi(p: SpelledPitch): number {
  return (p.octave + 1) * 12 + LETTER_SEMITONES[p.letter] + p.accidental
}

/**
 * Absolute diatonic step: how many letter-names above C-1 this pitch sits.
 * This — not the MIDI number — is what determines vertical position on a staff,
 * which is why F#4 and Gb4 sit on different lines despite being the same key.
 */
export function diatonicStep(p: SpelledPitch): number {
  return (p.octave + 1) * 7 + LETTER_STEPS[p.letter]
}

/**
 * Parse a note name such as "C4", "F#3", "Bb5", "Cbb4", "A##2".
 * Returns null on anything unparseable rather than throwing, because this is
 * also used against user-authored lesson data.
 */
export function parseNoteName(input: string): SpelledPitch | null {
  const m = /^([A-Ga-g])(#{1,2}|b{1,2}|♯{1,2}|♭{1,2}|x)?(-?\d{1,2})$/.exec(input.trim())
  if (!m) return null

  const letter = m[1]!.toUpperCase() as LetterName
  const accToken = m[2] ?? ''
  const octave = Number.parseInt(m[3]!, 10)

  let accidental: Accidental
  switch (accToken) {
    case '':
      accidental = 0
      break
    case '#':
    case '♯':
      accidental = 1
      break
    case '##':
    case '♯♯':
    case 'x':
      accidental = 2
      break
    case 'b':
    case '♭':
      accidental = -1
      break
    case 'bb':
    case '♭♭':
      accidental = -2
      break
    default:
      return null
  }

  const pitch: SpelledPitch = { letter, accidental, octave }
  const midi = spelledToMidi(pitch)
  if (midi < MIN_MIDI || midi > MAX_MIDI) return null
  return pitch
}

/** Convenience: note name straight to a MIDI number, or null. */
export function midiFromName(input: string): number | null {
  const p = parseNoteName(input)
  return p ? spelledToMidi(p) : null
}

export function formatAccidental(accidental: Accidental): string {
  switch (accidental) {
    case -2:
      return '𝄫'
    case -1:
      return '♭'
    case 0:
      return ''
    case 1:
      return '♯'
    case 2:
      return '𝄪'
  }
}

export function formatSpelled(p: SpelledPitch, withOctave = true): string {
  const base = `${p.letter}${formatAccidental(p.accidental)}`
  return withOctave ? `${base}${p.octave}` : base
}

/** Semitone distance, signed. */
export function semitonesBetween(a: number, b: number): number {
  return b - a
}

/** Clamp any value into the valid MIDI range. */
export function clampMidi(midi: number): number {
  return Math.min(MAX_MIDI, Math.max(MIN_MIDI, Math.round(midi)))
}

/**
 * Frequency in Hz. A4 (MIDI 69) = 440 by default; the tuning reference is
 * configurable because some students play along with an acoustic instrument.
 */
export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12)
}

/** Do two MIDI notes sound the same pitch class (ignoring octave)? */
export function samePitchClass(a: number, b: number): boolean {
  return pitchClass(a) === pitchClass(b)
}
