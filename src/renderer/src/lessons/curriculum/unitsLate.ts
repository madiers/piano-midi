/**
 * Units 8-15: eighth notes, accidentals, chords, scales, and the two extra keys.
 *
 * Note the deliberate deviation from the usual method-book order in Units 13-14:
 * F major comes before G major. Textbooks teach G first, but right-hand G
 * position runs G4-D5, and D5 is above the top of a C3-anchored 25-key
 * controller. F fits; G needs an anchor change. Hardware wins.
 */

import type { Unit } from '@shared/types'
import {
  LH_C_POSITION,
  PRIMARY_CHORDS_C,
  RH_C_POSITION,
  keyboardFigure,
  makeUnit,
  text
} from './helpers'

const BOTH_C_POSITIONS = [...LH_C_POSITION, ...RH_C_POSITION]

export const UNIT_8: Unit = makeUnit(
  8,
  'u8',
  'Eighth Notes and Upbeats',
  'Subdivide the beat, and play with both hands at once for the first time.',
  'MID',
  [
    {
      title: 'Eighth notes',
      kind: 'concept',
      newConcepts: ['eighth note', 'beaming'],
      blocks: [
        text(
          'Two eighth notes fit in one beat. Alone an eighth note has a flag; in pairs or groups they are joined by a beam, which makes the beat structure visible at a glance.\n\nCount them "1 and 2 and 3 and 4 and", with the number on the key and the "and" exactly halfway between.'
        )
      ],
      srsAtoms: ['eighth-note']
    },
    {
      title: 'Tap eighths',
      kind: 'drill',
      exercise: { kind: 'rhythmTap', rounds: 2, generator: { bars: 4, timeSignature: [4, 4], tempoBpm: 66, keySignatureFifths: 0, pool: [60], hand: 'right', durations: [0.5, 1, 2], maxLeap: 1, restProbability: 0.05 } }
    },
    {
      title: '2/4 and the upbeat',
      kind: 'concept',
      newConcepts: ['2/4 time', 'upbeat'],
      blocks: [
        text(
          '2/4 is two beats to the bar — a march.\n\nMany tunes do not start on beat 1. An upbeat (or anacrusis) is an incomplete first bar: the melody starts partway through, leading into the first full bar. "Happy Birthday" does this. Count the missing beats silently before you play.'
        )
      ],
      srsAtoms: ['upbeat']
    },
    {
      title: 'All the durations together',
      kind: 'play',
      hands: 'right',
      requiredRange: [60, 67],
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 2, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 72, keySignatureFifths: 0, pool: RH_C_POSITION, hand: 'right', durations: [0.5, 1, 2, 4], maxLeap: 2, restProbability: 0.1 } }
    },
    {
      title: 'Hands together',
      kind: 'play',
      hands: 'both',
      requiredRange: [48, 67],
      newConcepts: ['hands together'],
      minTempoPercent: 60,
      blocks: [
        text(
          'This is the hardest jump in the whole course, so it gets its own lesson and a gentler tempo.\n\nThe left hand holds whole notes while the right hand moves. One hand doing something slow under another doing something faster is genuinely difficult at first — your hands will want to copy each other. Start in wait mode, and do not rush to full speed.',
          'Expect this to feel impossible for a few minutes'
        )
      ],
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 3, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 60, keySignatureFifths: 0, pool: BOTH_C_POSITIONS, hand: 'both', durations: [1, 2, 4], maxLeap: 2, restProbability: 0.05 } }
    }
  ]
)

export const UNIT_9: Unit = makeUnit(
  9,
  'u9',
  'Sharps, Flats and Naturals',
  'Reach the black keys, and learn the accidental rule everyone gets wrong.',
  'MID',
  [
    {
      title: 'Half steps and whole steps',
      kind: 'concept',
      newConcepts: ['half step', 'whole step'],
      blocks: [
        keyboardFigure(
          'A half step is the distance to the very next key, black or white — with no key of any colour in between. A whole step is two half steps.\n\nMost white keys have a black key between them, so most white-to-white steps are whole steps. The exceptions are E-F and B-C, which have no black key between them and are therefore half steps. Those two pairs explain the whole layout of the keyboard.',
          [64, 65, 71, 72],
          { 64: 'E', 65: 'F', 71: 'B', 72: 'C' },
          'The two natural half steps'
        )
      ],
      srsAtoms: ['half-step', 'whole-step', 'e-f-b-c']
    },
    {
      title: 'Sharps and flats',
      kind: 'concept',
      newConcepts: ['sharp', 'flat', 'enharmonic'],
      blocks: [
        text(
          'A sharp (♯) raises a note by a half step. A flat (♭) lowers it by a half step. The sign is printed before the note head, but spoken after the letter: "F sharp".\n\nBecause they meet in the middle, the same black key has two names — F♯ and G♭ are the same key. Which name is used depends on the key of the music, and the app always writes whichever is correct for the key you are in.',
          'Two names, one key'
        )
      ],
      srsAtoms: ['sharp', 'flat', 'enharmonic']
    },
    {
      title: 'Find the black keys',
      kind: 'drill',
      requiredRange: [48, 72],
      exercise: { kind: 'findNote', pool: [49, 51, 54, 56, 58, 61, 63, 66, 68, 70], acceptAnyOctave: false, rounds: 12 }
    },
    {
      title: 'Naturals, and how long an accidental lasts',
      kind: 'concept',
      newConcepts: ['natural', 'accidental duration'],
      blocks: [
        text(
          'A natural (♮) cancels a sharp or flat.\n\nHere is the rule that catches almost everyone: an accidental lasts to the end of the bar, for that note on that line or space. Once a bar has an F♯ in it, every later F in that same bar is also sharp — even though it is not marked again. The next bar line resets everything.\n\nIf you have ever wondered why a passage suddenly sounded wrong, this is usually why.',
          'The rule worth memorising'
        )
      ],
      srsAtoms: ['natural', 'accidental-lasts-the-bar']
    },
    {
      title: 'Read with accidentals',
      kind: 'drill',
      requiredRange: [48, 72],
      exercise: { kind: 'noteName', pool: [58, 60, 61, 63, 65, 66, 68, 70], clef: 'grand', acceptAnyOctave: false, rounds: 14 }
    },
    {
      title: 'Pieces with accidentals',
      kind: 'play',
      hands: 'both',
      requiredRange: [48, 72],
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 2, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 69, keySignatureFifths: 0, pool: [48, 50, 52, 53, 55, 58, 60, 61, 62, 64, 66, 67], hand: 'both', durations: [1, 2, 4], maxLeap: 2, restProbability: 0.1 } }
    }
  ]
)

export const UNIT_10: Unit = makeUnit(
  10,
  'u10',
  'Triads',
  'Three notes at once, and the inversions that keep them on a small keyboard.',
  'MID',
  [
    {
      title: 'What a triad is',
      kind: 'concept',
      newConcepts: ['triad', 'root', 'chord'],
      blocks: [
        text(
          'A triad is three notes stacked in thirds: a root, the note a 3rd above it, and the note a 5th above the root. On the staff that is unmistakable — three note heads all on lines, or all on spaces, like a small snowman.\n\nIn C position the right hand plays C-E-G with fingers 1, 3 and 5, which is exactly the frame your hand already sits in.'
        )
      ],
      srsAtoms: ['triad']
    },
    {
      title: 'Build C, F and G',
      kind: 'drill',
      requiredRange: [48, 72],
      exercise: { kind: 'chordBuild', roots: [48, 53, 55], qualities: ['major'], inversions: [0], inversionPolicy: 'any-inversion', byEar: false, rounds: 9 }
    },
    {
      title: 'Major and minor',
      kind: 'concept',
      newConcepts: ['major triad', 'minor triad'],
      blocks: [
        text(
          'Lower the middle note of a major triad by one half step and it becomes minor. That single half step is the whole difference, and it changes the character completely — bright to shadowed.\n\nC major is C-E-G. C minor is C-E♭-G. Play them one after another and the difference is obvious immediately.'
        )
      ],
      srsAtoms: ['major-vs-minor']
    },
    {
      title: 'Major or minor by ear',
      kind: 'drill',
      requiredRange: [48, 72],
      exercise: { kind: 'chordBuild', roots: [48, 50, 53, 55], qualities: ['major', 'minor'], inversions: [0], inversionPolicy: 'any-voicing', byEar: true, rounds: 10 }
    },
    {
      title: 'Inversions',
      kind: 'concept',
      newConcepts: ['inversion'],
      blocks: [
        text(
          'Take the bottom note of a triad and move it up an octave. Same three letters, different order, same chord — that is an inversion. C-E-G becomes E-G-C, then G-C-E.\n\nOn a full-size piano inversions are a refinement. On 25 keys they are a necessity: they are how a chord progression stays inside two octaves instead of marching off the end of the keyboard. You will use them constantly from here on.',
          'Not a curiosity on a small keyboard'
        )
      ],
      srsAtoms: ['inversion']
    },
    {
      title: 'Play all three inversions',
      kind: 'drill',
      requiredRange: [48, 72],
      exercise: { kind: 'chordBuild', roots: [48, 53, 55], qualities: ['major'], inversions: [0, 1, 2], inversionPolicy: 'exact', byEar: false, rounds: 9 }
    },
    {
      title: 'Chords under a melody',
      kind: 'play',
      hands: 'both',
      requiredRange: [48, 72],
      minTempoPercent: 60,
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 2, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 63, keySignatureFifths: 0, pool: BOTH_C_POSITIONS, hand: 'both', durations: [1, 2, 4], maxLeap: 2, restProbability: 0.05, maxChordSize: 3 } }
    }
  ]
)

export const UNIT_11: Unit = makeUnit(
  11,
  'u11',
  'Primary Chords: I, IV and V7',
  'The three chords that harmonise most of a major key.',
  'MID',
  [
    {
      title: 'The three chords',
      kind: 'concept',
      newConcepts: ['I chord', 'IV chord', 'V7 chord'],
      blocks: [
        text(
          'Build a triad on the 1st, 4th and 5th degrees of a scale and you get the three chords that carry an enormous amount of music. In C major they are C, F and G7.\n\nThey are written with Roman numerals — I, IV and V7 — because the pattern is the same in every key. Learn the shape once and it transfers.'
        )
      ],
      srsAtoms: ['primary-chords']
    },
    {
      title: 'Voicings that fit 25 keys',
      kind: 'concept',
      requiredRange: [48, 59],
      hands: 'left',
      newConcepts: ['chord voicing'],
      blocks: [
        keyboardFigure(
          'Played in root position these three chords wander badly. Textbooks solve that with a compact C-position set — but the usual G7 shape needs the B below your lowest key, and no octave shift fixes it while your right hand is also in position.\n\nSo this course uses a set that genuinely fits your keyboard:\n\n• I — C3 E3 G3, fingers 5 3 1\n• IV — C3 F3 A3, fingers 5 2 1\n• V7 — F3 G3 B3, fingers 5 4 1\n\nThe V7 leaves out the chord\'s fifth. That is completely standard practice: the root, third and seventh are what give a dominant seventh its sound, and the fifth is the first note any pianist drops.',
          [...PRIMARY_CHORDS_C.I, ...PRIMARY_CHORDS_C.IV, ...PRIMARY_CHORDS_C.V7],
          { 48: 'C3', 53: 'F3', 55: 'G3', 59: 'B3' },
          'Chords that fit your hardware'
        )
      ]
    },
    {
      title: 'Chord changes',
      kind: 'drill',
      hands: 'left',
      requiredRange: [48, 67],
      blocks: [text('The app calls a chord; you play it. Speed of the change matters as much as accuracy.')],
      // Root position and first inversion only: second inversions of G push the
      // top note past the keyboard, and the point of this lesson is compact
      // voicings that stay under one hand anyway.
      exercise: { kind: 'chordBuild', roots: [48, 53, 55], qualities: ['major', 'dominant7'], inversions: [0, 1], inversionPolicy: 'any-inversion', byEar: false, rounds: 12 }
    },
    {
      title: 'Broken chords',
      kind: 'concept',
      newConcepts: ['broken chord', 'Alberti bass'],
      blocks: [
        text(
          'Instead of sounding a chord all at once, play its notes one after another. That is a broken chord, and it turns a static harmony into motion.\n\nThe Alberti pattern — lowest, highest, middle, highest — is the classic version, and it is everywhere in Mozart and Clementi. In C that is C-G-E-G, repeating.'
        )
      ],
      srsAtoms: ['broken-chord']
    },
    {
      title: 'The progression',
      kind: 'play',
      hands: 'left',
      requiredRange: [48, 59],
      minTempoPercent: 60,
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 2, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 63, keySignatureFifths: 0, pool: [48, 52, 53, 55, 57, 59], hand: 'left', durations: [1, 2, 4], maxLeap: 2, restProbability: 0, maxChordSize: 3 } }
    },
    {
      title: 'Melody and accompaniment',
      kind: 'play',
      hands: 'both',
      requiredRange: [48, 72],
      minTempoPercent: 60,
      blocks: [text('Right hand carries the tune; left hand plays broken chords underneath. This is real piano playing.')],
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 3, generator: { bars: 16, timeSignature: [4, 4], tempoBpm: 60, keySignatureFifths: 0, pool: BOTH_C_POSITIONS, hand: 'both', durations: [0.5, 1, 2], maxLeap: 2, restProbability: 0.05 } }
    }
  ]
)

export const UNIT_12: Unit = makeUnit(
  12,
  'u12',
  'Scales and Thumb-Under',
  'Escape the five-finger position for the first time.',
  'MID',
  [
    {
      title: 'Tetrachords',
      kind: 'concept',
      requiredRange: [48, 72],
      newConcepts: ['tetrachord'],
      blocks: [
        text(
          'A tetrachord is four notes in the pattern whole-whole-half. A major scale is simply two tetrachords joined by a whole step — C D E F, then G A B C.\n\nPlay the lower one with your left hand and the upper with your right, and you have a complete C major scale with no thumb crossing at all. Separating the idea from the physical skill like this makes the next lesson far less daunting.'
        )
      ],
      srsAtoms: ['tetrachord']
    },
    {
      title: 'The major scale formula',
      kind: 'concept',
      newConcepts: ['major scale'],
      blocks: [
        text(
          'Every major scale, in every key, follows the same step pattern:\n\nwhole – whole – half – whole – whole – whole – half\n\nStart on any key, apply that pattern, and you have that key\'s major scale. C major is the only one that uses no black keys, which is why everything starts there.'
        )
      ],
      srsAtoms: ['major-scale-formula']
    },
    {
      title: 'Right-hand thumb-under',
      kind: 'drill',
      hands: 'right',
      requiredRange: [60, 72],
      newConcepts: ['thumb-under'],
      minTempoPercent: 60,
      blocks: [
        text(
          'A scale spans eight notes and you have five fingers, so the hand has to move through itself.\n\nGoing up from C4: fingers 1-2-3, then the thumb passes under the third finger to take F, then 2-3-4-5 finishes on C5. The crossing happens between E and F.\n\nKeep the thumb low and moving early — start bringing it under as finger 3 plays, not after. The wrist stays level; it should not jerk upward at the crossing.',
          'Fingering: 1 2 3 1 2 3 4 5'
        )
      ],
      exercise: { kind: 'scaleRun', tonicMidi: 60, scaleType: 'major', octaves: 1, hands: 'right', tempoBpm: 60, gradeEvenness: true, rounds: 3 }
    },
    {
      title: 'Left-hand thumb-under',
      kind: 'drill',
      hands: 'left',
      requiredRange: [48, 60],
      minTempoPercent: 60,
      blocks: [
        text(
          'The left hand going up is 5-4-3-2-1, then finger 3 crosses OVER the thumb to take A, then 2-1 finishes on C.\n\nFingering: 5 4 3 2 1 3 2 1, with the crossing between G and A.'
        )
      ],
      exercise: { kind: 'scaleRun', tonicMidi: 48, scaleType: 'major', octaves: 1, hands: 'left', tempoBpm: 60, gradeEvenness: true, rounds: 3 }
    },
    {
      title: 'Evenness',
      kind: 'drill',
      hands: 'right',
      requiredRange: [60, 72],
      blocks: [
        text(
          'A scale should sound like one smooth line, not four notes and a bump. The bump is almost always at the thumb crossing.\n\nThis drill measures the gap between consecutive notes and shows you where it stretches — usually exactly at the seam.'
        )
      ],
      exercise: { kind: 'scaleRun', tonicMidi: 60, scaleType: 'major', octaves: 1, hands: 'right', tempoBpm: 66, gradeEvenness: true, rounds: 4 }
    },
    {
      title: 'Hands together, one octave',
      kind: 'play',
      hands: 'both',
      requiredRange: [48, 72],
      minTempoPercent: 60,
      blocks: [text('C major, both hands an octave apart, at a deliberately unhurried ♩=54.')],
      exercise: { kind: 'scaleRun', tonicMidi: 60, scaleType: 'major', octaves: 1, hands: 'both', tempoBpm: 54, gradeEvenness: true, rounds: 3 }
    },
    {
      title: 'Two octaves, right hand',
      kind: 'play',
      hands: 'right',
      anchor: 'MID',
      requiredRange: [48, 72],
      minTempoPercent: 60,
      blocks: [
        text(
          'C3 all the way to C5 — the entire span of your keyboard in one run. Two thumb crossings going up, two coming down.\n\nOn a full-size piano this run simply keeps going. What you are learning here is the pattern, and the pattern does not change; there is just more of it.'
        )
      ],
      exercise: { kind: 'scaleRun', tonicMidi: 48, scaleType: 'major', octaves: 2, hands: 'right', tempoBpm: 54, gradeEvenness: true, rounds: 3 }
    },
    {
      title: 'Technique checkpoint',
      kind: 'assess',
      hands: 'both',
      requiredRange: [48, 72],
      minScore: 0.8,
      minTempoPercent: 80,
      exercise: { kind: 'scaleRun', tonicMidi: 60, scaleType: 'major', octaves: 1, hands: 'both', tempoBpm: 60, gradeEvenness: true, rounds: 2 }
    }
  ]
)

export const UNIT_13: Unit = makeUnit(
  13,
  'u13',
  'F Major',
  'Your second key — and the first octave-anchor change.',
  'LOW',
  [
    {
      title: 'Shift down an octave',
      kind: 'concept',
      anchor: 'LOW',
      newConcepts: ['anchor change'],
      blocks: [
        text(
          'F major needs room below Middle C that a C3-anchored keyboard does not have, so this unit moves down one octave: your lowest key becomes C2.\n\nUse your keyboard\'s Octave − button, or the octave control at the top of the window, then play your lowest key so the app can confirm the shift landed where it should.',
          'Moving the window, not the music'
        )
      ]
    },
    {
      title: 'B flat, and the key signature',
      kind: 'concept',
      newConcepts: ['key signature', 'B flat'],
      blocks: [
        text(
          'F major has one flat: B♭.\n\nRather than marking every single B, the flat is printed once at the start of each line, just after the clef. That is a key signature, and it applies to every B in the piece, in every octave, until the music says otherwise.\n\nOne flat, and it is B♭ — that is F major.'
        )
      ],
      srsAtoms: ['key-signature-f', 'b-flat']
    },
    {
      title: 'F position',
      kind: 'drill',
      requiredRange: [41, 60],
      blocks: [text('Right hand F3 to C4; left hand F2 to C3. The same five-finger frame, moved.')],
      exercise: { kind: 'noteName', pool: [41, 43, 45, 46, 48, 53, 55, 57, 58, 60], clef: 'grand', acceptAnyOctave: false, rounds: 12 }
    },
    {
      title: 'Primary chords in F',
      kind: 'drill',
      hands: 'left',
      requiredRange: [41, 60],
      blocks: [text('The same I-IV-V7 relationship you learned in C, transplanted to F.')],
      // Second inversions of B-flat and C7 climb above the LOW anchor's ceiling.
      exercise: { kind: 'chordBuild', roots: [41, 46, 48], qualities: ['major', 'dominant7'], inversions: [0, 1], inversionPolicy: 'any-inversion', byEar: false, rounds: 10 }
    },
    {
      title: 'Two pieces in F',
      kind: 'play',
      hands: 'both',
      requiredRange: [41, 60],
      minTempoPercent: 60,
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 2, generator: { bars: 16, timeSignature: [4, 4], tempoBpm: 63, keySignatureFifths: -1, pool: [41, 43, 45, 46, 48, 53, 55, 57, 58, 60], hand: 'both', durations: [0.5, 1, 2, 4], maxLeap: 2, restProbability: 0.05 } }
    }
  ]
)

export const UNIT_14: Unit = makeUnit(
  14,
  'u14',
  'G Major',
  'A third key, and a lesson in working around a short keyboard.',
  'MID',
  [
    {
      title: 'F sharp, and the key signature',
      kind: 'concept',
      newConcepts: ['key signature G', 'F sharp'],
      blocks: [
        text(
          'G major has one sharp: F♯. One sharp in the key signature, and it is always F.\n\nThat is the pair worth remembering: one flat means F major, one sharp means G major.'
        )
      ],
      srsAtoms: ['key-signature-g', 'f-sharp']
    },
    {
      title: 'Why G position sits lower',
      kind: 'concept',
      hands: 'right',
      requiredRange: [55, 62],
      blocks: [
        text(
          'The usual right-hand G position runs G4 to D5. On your keyboard D5 is past the top key, so this course puts the right hand at G3-D4 instead — below the C position rather than above it.\n\nThis is not a compromise you have to feel bad about. Choosing a register that fits the instrument in front of you is something pianists do constantly. It is worth knowing, though, that on a 61- or 88-key instrument you would play this an octave higher.',
          'An honest workaround'
        )
      ]
    },
    {
      title: 'Read in G',
      kind: 'drill',
      requiredRange: [48, 67],
      exercise: { kind: 'noteName', pool: [55, 57, 59, 60, 62, 64, 66, 67], clef: 'grand', acceptAnyOctave: false, rounds: 12 }
    },
    {
      title: 'Transpose a piece you know',
      kind: 'concept',
      newConcepts: ['transposition'],
      blocks: [
        text(
          'Take the I-IV-V7 progression from Unit 11 and play it in G instead of C. The shapes are identical; only the starting note moves.\n\nThis is the moment Roman numerals pay off. I-IV-V7 means the same thing in every key, and once the pattern is in your hands you can move it anywhere.'
        )
      ],
      srsAtoms: ['transposition']
    },
    {
      title: 'Two pieces in G',
      kind: 'play',
      hands: 'both',
      requiredRange: [48, 67],
      minTempoPercent: 60,
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 2, generator: { bars: 16, timeSignature: [4, 4], tempoBpm: 66, keySignatureFifths: 1, pool: [48, 50, 52, 54, 55, 59, 60, 62, 64, 66, 67], hand: 'both', durations: [0.5, 1, 2, 4], maxLeap: 2, restProbability: 0.05 } }
    }
  ]
)

export const UNIT_15: Unit = makeUnit(
  15,
  'u15',
  'Repertoire and Assessment',
  'Put it together, and find out what you can actually read.',
  'MID',
  [
    {
      title: 'Three pieces',
      kind: 'play',
      hands: 'both',
      requiredRange: [48, 72],
      minTempoPercent: 80,
      blocks: [
        text(
          'Three longer pieces drawing on everything so far: both hands, accidentals, chords and a real phrase shape.'
        )
      ],
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 3, generator: { bars: 16, timeSignature: [4, 4], tempoBpm: 72, keySignatureFifths: 0, pool: BOTH_C_POSITIONS, hand: 'both', durations: [0.5, 1, 2, 4], maxLeap: 3, restProbability: 0.05, maxChordSize: 3 } }
    },
    {
      title: 'Sight-reading test',
      kind: 'assess',
      hands: 'both',
      requiredRange: [48, 72],
      minScore: 0.8,
      minTempoPercent: 80,
      blocks: [
        text(
          'Phrases you have never seen, generated fresh each attempt. Only your first run of each counts as true sight-reading — retries resample, so there is nothing to memorise.'
        )
      ],
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 4, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 72, keySignatureFifths: 0, pool: BOTH_C_POSITIONS, hand: 'both', durations: [0.5, 1, 2, 4], maxLeap: 3, restProbability: 0.1 } }
    },
    {
      title: 'Scales from memory',
      kind: 'assess',
      hands: 'both',
      requiredRange: [48, 72],
      minScore: 0.8,
      minTempoPercent: 80,
      exercise: { kind: 'scaleRun', tonicMidi: 60, scaleType: 'major', octaves: 1, hands: 'both', tempoBpm: 54, gradeEvenness: true, rounds: 2 }
    },
    {
      title: 'Where to go next',
      kind: 'concept',
      blocks: [
        text(
          'You can read both clefs, count four kinds of note, play in three keys, build and invert triads, and run a scale with the thumb under. That is a real foundation.\n\nWhat a bigger instrument would add: right-hand G position in its proper register, two-octave scales with both hands, a sustain pedal (which changes legato completely), and weighted keys that let you actually control dynamics.\n\nGood next steps are Czerny Op. 599 for studies, easy classical arrangements at around ABRSM Initial to Grade 1, and — more than anything — playing tunes you actually like.',
          'What you can do now'
        )
      ]
    }
  ]
)
