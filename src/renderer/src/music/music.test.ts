import { describe, expect, it } from 'vitest'
import {
  isBlackKey,
  midiFromName,
  noteName,
  octaveOf,
  parseNoteName,
  spelledToMidi,
  diatonicStep,
  midiToFrequency
} from './pitch'
import { intervalBetween, intervalFromSemitones, intervalShorthand } from './intervals'
import { keySignatureFor, scaleNotes, spellInKey } from './scales'
import {
  chordNotes,
  chordName,
  diatonicTriad,
  identifyChord,
  bestInversionForRange,
  sameChordContent
} from './chords'

describe('pitch', () => {
  it('anchors middle C at MIDI 60 = C4', () => {
    expect(noteName(60)).toBe('C4')
    expect(midiFromName('C4')).toBe(60)
    expect(octaveOf(60)).toBe(4)
  })

  it('names the landmark notes the curriculum teaches', () => {
    expect(noteName(53)).toBe('F3') // Bass F
    expect(noteName(67)).toBe('G4') // Treble G
  })

  it('identifies black keys', () => {
    // One octave from C4: only the five accidentals are black.
    const black = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71].filter(isBlackKey)
    expect(black).toEqual([61, 63, 66, 68, 70])
  })

  it('parses accidentals including doubles and unicode', () => {
    expect(parseNoteName('F#3')).toEqual({ letter: 'F', accidental: 1, octave: 3 })
    expect(parseNoteName('Bb5')).toEqual({ letter: 'B', accidental: -1, octave: 5 })
    expect(parseNoteName('C##4')).toEqual({ letter: 'C', accidental: 2, octave: 4 })
    expect(parseNoteName('E♭4')).toEqual({ letter: 'E', accidental: -1, octave: 4 })
    expect(parseNoteName('H4')).toBeNull()
    expect(parseNoteName('')).toBeNull()
  })

  it('handles enharmonics that cross an octave boundary', () => {
    // B#3 sounds the same as C4, and Cb4 the same as B3.
    expect(spelledToMidi({ letter: 'B', accidental: 1, octave: 3 })).toBe(60)
    expect(spelledToMidi({ letter: 'C', accidental: -1, octave: 4 })).toBe(59)
  })

  it('places enharmonics on different staff positions', () => {
    // F#4 and Gb4 are the same key but must not sit on the same staff line.
    const fSharp = { letter: 'F', accidental: 1, octave: 4 } as const
    const gFlat = { letter: 'G', accidental: -1, octave: 4 } as const
    expect(spelledToMidi(fSharp)).toBe(spelledToMidi(gFlat))
    expect(diatonicStep(fSharp)).not.toBe(diatonicStep(gFlat))
  })

  it('converts A4 to 440 Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6)
    expect(midiToFrequency(81)).toBeCloseTo(880, 6)
  })
})

describe('intervals', () => {
  it('names the intervals taught in unit 7', () => {
    const c4 = parseNoteName('C4')!
    expect(intervalShorthand(intervalBetween(c4, parseNoteName('D4')!))).toBe('M2')
    expect(intervalShorthand(intervalBetween(c4, parseNoteName('E4')!))).toBe('M3')
    expect(intervalShorthand(intervalBetween(c4, parseNoteName('F4')!))).toBe('P4')
    expect(intervalShorthand(intervalBetween(c4, parseNoteName('G4')!))).toBe('P5')
    expect(intervalShorthand(intervalBetween(c4, parseNoteName('C5')!))).toBe('P8')
  })

  it('distinguishes quality by spelling, not just semitones', () => {
    const c4 = parseNoteName('C4')!
    // Both are 3 semitones, but spelled differently they are different intervals.
    expect(intervalShorthand(intervalBetween(c4, parseNoteName('Eb4')!))).toBe('m3')
    expect(intervalShorthand(intervalBetween(c4, parseNoteName('D#4')!))).toBe('A2')
  })

  it('is direction agnostic', () => {
    const c4 = parseNoteName('C4')!
    const g4 = parseNoteName('G4')!
    expect(intervalBetween(c4, g4).semitones).toBe(intervalBetween(g4, c4).semitones)
    expect(intervalBetween(g4, c4).number).toBe(5)
  })

  it('classifies intervals from sound alone', () => {
    expect(intervalShorthand(intervalFromSemitones(7))).toBe('P5')
    expect(intervalShorthand(intervalFromSemitones(4))).toBe('M3')
    expect(intervalShorthand(intervalFromSemitones(3))).toBe('m3')
    expect(intervalShorthand(intervalFromSemitones(12))).toBe('P8')
  })
})

describe('scales and key signatures', () => {
  it('builds a one-octave C major scale', () => {
    expect(scaleNotes(60, 'major', 1)).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
  })

  it('knows the key signatures the curriculum uses', () => {
    expect(keySignatureFor('C').fifths).toBe(0)
    expect(keySignatureFor('G').alteredLetters).toEqual(['F'])
    expect(keySignatureFor('F').alteredLetters).toEqual(['B'])
    expect(keySignatureFor('F').usesFlats).toBe(true)
  })

  it('spells notes correctly for the key', () => {
    // In G major, MIDI 66 must be written F#, never Gb.
    const g = keySignatureFor('G')
    const spelled = spellInKey(66, g)
    expect(spelled.letter).toBe('F')
    expect(spelled.accidental).toBe(1)

    // In F major, MIDI 70 must be written Bb, never A#.
    const f = keySignatureFor('F')
    const bFlat = spellInKey(70, f)
    expect(bFlat.letter).toBe('B')
    expect(bFlat.accidental).toBe(-1)
  })

  it('spells naturals without accidentals in C major', () => {
    const c = keySignatureFor('C')
    for (const [midi, letter] of [
      [60, 'C'],
      [62, 'D'],
      [64, 'E'],
      [65, 'F'],
      [67, 'G'],
      [69, 'A'],
      [71, 'B']
    ] as const) {
      const spelled = spellInKey(midi, c)
      expect(spelled.letter).toBe(letter)
      expect(spelled.accidental).toBe(0)
      expect(spelledToMidi(spelled)).toBe(midi)
    }
  })

  it('always spells back to the same key', () => {
    for (const fifths of [-4, -1, 0, 1, 3]) {
      const key = keySignatureFor(fifths >= 0 ? ['C', 'G', 'D', 'A', 'E'][fifths]! : ['C', 'F', 'Bb', 'Eb', 'Ab'][-fifths]!)
      for (let midi = 48; midi <= 84; midi++) {
        expect(spelledToMidi(spellInKey(midi, key))).toBe(midi)
      }
    }
  })
})

describe('chords', () => {
  it('builds triads', () => {
    expect(chordNotes({ rootMidi: 60, quality: 'major', inversion: 0 })).toEqual([60, 64, 67])
    expect(chordNotes({ rootMidi: 60, quality: 'minor', inversion: 0 })).toEqual([60, 63, 67])
    expect(chordNotes({ rootMidi: 60, quality: 'dominant7', inversion: 0 })).toEqual([
      60, 64, 67, 70
    ])
  })

  it('inverts by moving the lowest note up an octave', () => {
    expect(chordNotes({ rootMidi: 60, quality: 'major', inversion: 1 })).toEqual([64, 67, 72])
    expect(chordNotes({ rootMidi: 60, quality: 'major', inversion: 2 })).toEqual([67, 72, 76])
  })

  it('recognises a chord regardless of voicing', () => {
    const identified = identifyChord([60, 64, 67])
    expect(identified?.quality).toBe('major')
    expect(identified?.inversion).toBe(0)

    // First inversion: E in the bass.
    const inverted = identifyChord([64, 67, 72])
    expect(inverted?.quality).toBe('major')
    expect(inverted?.inversion).toBe(1)
  })

  it('recognises a chord spread across octaves', () => {
    // C major with the G up an octave is still C major.
    const wide = identifyChord([60, 64, 79])
    expect(wide?.quality).toBe('major')
  })

  it('names inverted chords with a slash bass', () => {
    expect(chordName({ rootMidi: 60, quality: 'major', inversion: 0 })).toBe('C')
    expect(chordName({ rootMidi: 60, quality: 'major', inversion: 1 })).toBe('C/E')
    expect(chordName({ rootMidi: 62, quality: 'minor', inversion: 0 })).toBe('Dm')
  })

  it('builds the diatonic triads of C major', () => {
    expect(chordNotes(diatonicTriad(60, 1))).toEqual([60, 64, 67]) // C
    expect(chordNotes(diatonicTriad(60, 4))).toEqual([65, 69, 72]) // F
    expect(chordNotes(diatonicTriad(60, 5))).toEqual([67, 71, 74]) // G
    expect(diatonicTriad(60, 2).quality).toBe('minor') // Dm
    expect(diatonicTriad(60, 7).quality).toBe('diminished') // Bdim
  })

  it('compares chords by pitch-class content', () => {
    expect(sameChordContent([60, 64, 67], [72, 76, 79])).toBe(true)
    expect(sameChordContent([60, 64, 67], [60, 63, 67])).toBe(false)
  })

  it('finds a voicing that fits inside a 25-key range', () => {
    // This is the real constraint: a 25-key controller anchored at C3-C5.
    const low = 48
    const high = 72
    for (const degree of [1, 4, 5]) {
      const voiced = bestInversionForRange(diatonicTriad(60, degree), low, high)
      expect(voiced).not.toBeNull()
      for (const note of chordNotes(voiced!)) {
        expect(note).toBeGreaterThanOrEqual(low)
        expect(note).toBeLessThanOrEqual(high)
      }
    }
  })
})

describe('compound and octave intervals (regression)', () => {
  it('calls a plain octave perfect, not diminished', () => {
    expect(intervalShorthand(intervalBetween(parseNoteName('C4')!, parseNoteName('C5')!))).toBe('P8')
    expect(intervalShorthand(intervalBetween(parseNoteName('G3')!, parseNoteName('G4')!))).toBe('P8')
  })

  it('handles compound intervals beyond the octave', () => {
    expect(intervalShorthand(intervalBetween(parseNoteName('C4')!, parseNoteName('D5')!))).toBe('M9')
    expect(intervalShorthand(intervalBetween(parseNoteName('C4')!, parseNoteName('E5')!))).toBe('M10')
    expect(intervalShorthand(intervalBetween(parseNoteName('C4')!, parseNoteName('G5')!))).toBe('P12')
    expect(intervalShorthand(intervalBetween(parseNoteName('C4')!, parseNoteName('C6')!))).toBe('P15')
  })

  it('still detects altered octaves', () => {
    expect(intervalShorthand(intervalBetween(parseNoteName('C4')!, parseNoteName('C#5')!))).toBe('A8')
    expect(intervalShorthand(intervalBetween(parseNoteName('C4')!, parseNoteName('Cb5')!))).toBe('d8')
  })
})
