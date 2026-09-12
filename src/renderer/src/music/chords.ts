/**
 * Chords: construction, inversion, and — importantly for grading — recognition
 * of what the student actually played.
 *
 * Recognition has to be forgiving about octave and voicing (a student playing
 * C-E-G with the G an octave up is still a C major triad) but strict about
 * pitch content.
 */

import { pitchClass, pitchClassName } from './pitch'

export type ChordQuality =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'augmented'
  | 'sus2'
  | 'sus4'
  | 'major7'
  | 'minor7'
  | 'dominant7'
  | 'diminished7'
  | 'halfDiminished7'
  | 'minorMajor7'
  | 'major6'
  | 'minor6'

/** Semitone offsets above the root. */
export const CHORD_INTERVALS: Record<ChordQuality, readonly number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dominant7: [0, 4, 7, 10],
  diminished7: [0, 3, 6, 9],
  halfDiminished7: [0, 3, 6, 10],
  minorMajor7: [0, 3, 7, 11],
  major6: [0, 4, 7, 9],
  minor6: [0, 3, 7, 9]
}

/** Suffix shown after the root, e.g. "C" + "m7" = "Cm7". */
export const CHORD_SUFFIX: Record<ChordQuality, string> = {
  major: '',
  minor: 'm',
  diminished: 'dim',
  augmented: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  major7: 'maj7',
  minor7: 'm7',
  dominant7: '7',
  diminished7: 'dim7',
  halfDiminished7: 'm7♭5',
  minorMajor7: 'mMaj7',
  major6: '6',
  minor6: 'm6'
}

export const CHORD_LABEL: Record<ChordQuality, string> = {
  major: 'Major',
  minor: 'Minor',
  diminished: 'Diminished',
  augmented: 'Augmented',
  sus2: 'Suspended 2nd',
  sus4: 'Suspended 4th',
  major7: 'Major 7th',
  minor7: 'Minor 7th',
  dominant7: 'Dominant 7th',
  diminished7: 'Diminished 7th',
  halfDiminished7: 'Half-diminished 7th',
  minorMajor7: 'Minor-major 7th',
  major6: 'Major 6th',
  minor6: 'Minor 6th'
}

export interface Chord {
  rootMidi: number
  quality: ChordQuality
  /** 0 = root position, 1 = first inversion, ... */
  inversion: number
}

/**
 * The MIDI notes of a chord, voiced upward from the root.
 * Inversions move the lowest notes up an octave, which is how a pianist
 * actually plays them.
 */
export function chordNotes(chord: Chord): number[] {
  const intervals = CHORD_INTERVALS[chord.quality]
  const notes = intervals.map((i) => chord.rootMidi + i)
  const inv = ((chord.inversion % notes.length) + notes.length) % notes.length

  for (let i = 0; i < inv; i++) {
    const lowest = notes.shift()
    if (lowest !== undefined) notes.push(lowest + 12)
  }
  return notes
}

/** Display name, e.g. "Cm7" or "F/A" for an inverted chord. */
export function chordName(chord: Chord, useFlats = false): string {
  const root = pitchClassName(chord.rootMidi, useFlats)
  const base = `${root}${CHORD_SUFFIX[chord.quality]}`
  if (chord.inversion === 0) return base
  const notes = chordNotes(chord)
  const bass = pitchClassName(notes[0]!, useFlats)
  return `${base}/${bass}`
}

export function inversionLabel(inversion: number): string {
  switch (inversion) {
    case 0:
      return 'root position'
    case 1:
      return '1st inversion'
    case 2:
      return '2nd inversion'
    case 3:
      return '3rd inversion'
    default:
      return `inversion ${inversion}`
  }
}

/**
 * Identify a chord from a set of sounding MIDI notes.
 *
 * Tries every note as a candidate root and matches the resulting pitch-class
 * set against the known qualities. Returns every match, best first — ambiguity
 * is real (C6 and Am7 share all four notes), so the caller decides what counts
 * as correct for the exercise at hand.
 */
export function identifyChords(midiNotes: number[]): Chord[] {
  if (midiNotes.length < 3) return []

  const sorted = [...new Set(midiNotes)].sort((a, b) => a - b)
  const classes = new Set(sorted.map(pitchClass))
  const bassClass = pitchClass(sorted[0]!)
  const matches: Chord[] = []

  for (const rootClass of classes) {
    for (const quality of Object.keys(CHORD_INTERVALS) as ChordQuality[]) {
      const intervals = CHORD_INTERVALS[quality]
      if (intervals.length !== classes.size) continue

      const expected = new Set(intervals.map((i) => (rootClass + i) % 12))
      if (expected.size !== classes.size) continue

      let same = true
      for (const c of classes) {
        if (!expected.has(c)) {
          same = false
          break
        }
      }
      if (!same) continue

      // Which inversion is this? Determined by which chord tone is in the bass.
      const bassOffset = (bassClass - rootClass + 12) % 12
      const inversion = intervals.indexOf(bassOffset)
      if (inversion < 0) continue

      // Pick a root octave near the played notes so `rootMidi` is meaningful.
      const rootMidi = nearestWithClass(sorted[0]!, rootClass)
      matches.push({ rootMidi, quality, inversion })
    }
  }

  // Prefer root-position and simpler qualities — the reading a human would give.
  const simplicity: ChordQuality[] = [
    'major',
    'minor',
    'dominant7',
    'diminished',
    'augmented',
    'major7',
    'minor7',
    'sus4',
    'sus2',
    'major6',
    'minor6',
    'diminished7',
    'halfDiminished7',
    'minorMajor7'
  ]
  matches.sort((a, b) => {
    if (a.inversion !== b.inversion) return a.inversion - b.inversion
    return simplicity.indexOf(a.quality) - simplicity.indexOf(b.quality)
  })

  return matches
}

/** The single most likely reading of a played chord, or null. */
export function identifyChord(midiNotes: number[]): Chord | null {
  return identifyChords(midiNotes)[0] ?? null
}

function nearestWithClass(reference: number, targetClass: number): number {
  const base = reference - pitchClass(reference) + targetClass
  const candidates = [base - 12, base, base + 12]
  let best = candidates[0]!
  for (const c of candidates) {
    if (Math.abs(c - reference) < Math.abs(best - reference)) best = c
  }
  return best
}

/**
 * Do two chords sound the same, ignoring octave and voicing?
 * This is the comparison used to grade "build this chord" exercises.
 */
export function sameChordContent(a: number[], b: number[]): boolean {
  const sa = new Set(a.map(pitchClass))
  const sb = new Set(b.map(pitchClass))
  if (sa.size !== sb.size) return false
  for (const x of sa) if (!sb.has(x)) return false
  return true
}

// ------------------------------------------------------------- diatonic harmony

/** Roman numerals for the triads built on each degree of a major scale. */
export const MAJOR_DIATONIC_TRIADS: ReadonlyArray<{
  degree: number
  numeral: string
  quality: ChordQuality
  semitonesAboveTonic: number
}> = [
  { degree: 1, numeral: 'I', quality: 'major', semitonesAboveTonic: 0 },
  { degree: 2, numeral: 'ii', quality: 'minor', semitonesAboveTonic: 2 },
  { degree: 3, numeral: 'iii', quality: 'minor', semitonesAboveTonic: 4 },
  { degree: 4, numeral: 'IV', quality: 'major', semitonesAboveTonic: 5 },
  { degree: 5, numeral: 'V', quality: 'major', semitonesAboveTonic: 7 },
  { degree: 6, numeral: 'vi', quality: 'minor', semitonesAboveTonic: 9 },
  { degree: 7, numeral: 'vii°', quality: 'diminished', semitonesAboveTonic: 11 }
]

/** Build the diatonic triad on a scale degree of a major key. */
export function diatonicTriad(tonicMidi: number, degree: number, inversion = 0): Chord {
  const entry = MAJOR_DIATONIC_TRIADS[(degree - 1) % 7]!
  return {
    rootMidi: tonicMidi + entry.semitonesAboveTonic,
    quality: entry.quality,
    inversion
  }
}

/**
 * Choose the inversion of `chord` whose notes sit closest to `targetLow`,
 * so chord progressions stay inside a 25-key range instead of marching upward.
 */
export function bestInversionForRange(
  chord: Chord,
  lowest: number,
  highest: number
): Chord | null {
  const count = CHORD_INTERVALS[chord.quality].length
  let best: { chord: Chord; distance: number } | null = null

  for (let inv = 0; inv < count; inv++) {
    for (let octave = -2; octave <= 2; octave++) {
      const candidate: Chord = {
        rootMidi: chord.rootMidi + octave * 12,
        quality: chord.quality,
        inversion: inv
      }
      const notes = chordNotes(candidate)
      if (notes.some((n) => n < lowest || n > highest)) continue
      const centre = (lowest + highest) / 2
      const distance = Math.abs((notes[0]! + notes[notes.length - 1]!) / 2 - centre)
      if (!best || distance < best.distance) best = { chord: candidate, distance }
    }
  }
  return best?.chord ?? null
}
