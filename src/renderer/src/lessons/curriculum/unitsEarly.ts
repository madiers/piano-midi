/**
 * Units 0-7: setup, keyboard geography, rhythm, the two C positions, the staff,
 * the three landmark notes, and interval reading.
 *
 * Unit 7 is the hinge of the whole course. Up to there a student is decoding
 * note by note; from there they read shapes — step, skip, and the distance
 * between them — which is what makes reading fast enough to be enjoyable.
 */

import type { Unit } from '@shared/types'
import {
  BASS_F,
  LH_C_POSITION,
  MID_WHITE_KEYS,
  MIDDLE_C,
  RH_C_POSITION,
  TREBLE_G,
  fingerFigure,
  keyboardFigure,
  makeUnit,
  text
} from './helpers'

export const UNIT_0: Unit = makeUnit(
  0,
  'u0',
  'Setup & Calibration',
  'Teach the app about your keyboard and your timing, so everything after this is graded fairly.',
  null,
  [
    {
      title: 'Connect your keyboard',
      kind: 'concept',
      newConcepts: ['MIDI', 'device selection'],
      blocks: [
        text(
          'Plug your MIDI keyboard in over USB. The app watches for keyboards continuously, so it should appear at the top of the window within a second or two — no restart needed.\n\nIf nothing shows up, check that your cable carries data (many cheap USB cables are charge-only), and that no other music app is holding the keyboard open. Bluetooth keyboards on macOS also need pairing in Audio MIDI Setup before any app can see them.',
          'Getting connected'
        ),
        text(
          'Some controllers expose two ports — one for the keys and one for an editor or control surface. The app picks the one that carries notes, but if you ever see no response, try the other port from the device menu.'
        )
      ]
    },
    {
      title: 'Range calibration',
      kind: 'drill',
      newConcepts: ['key range'],
      blocks: [
        text(
          'Play your lowest key, then your highest. This tells the app exactly how much keyboard you have, so it never asks you for a note you physically cannot play.'
        )
      ],
      exercise: { kind: 'calibration', mode: 'range' }
    },
    {
      title: 'Find your octave',
      kind: 'drill',
      newConcepts: ['octave', 'Middle C'],
      blocks: [
        keyboardFigure(
          'Most of this course lives in the two octaves from C3 to C5, with Middle C in the middle. If your keyboard starts somewhere else, use its Octave +/- buttons — or the octave control at the top of this window — until your lowest key is C3.\n\nWe shift the keyboard rather than the music on purpose. Moving the music would break the link between a written note and the key under your finger, and that link is the thing you are here to build.',
          [48, 60, 72],
          { 48: 'C3', 60: 'Middle C', 72: 'C5' },
          'Two octaves, anchored'
        )
      ],
      exercise: { kind: 'calibration', mode: 'octave', targetLowNote: 48 }
    },
    {
      title: 'Timing calibration',
      kind: 'drill',
      newConcepts: ['latency'],
      blocks: [
        text(
          'Tap any key along with the click, sixteen times. This measures the small delay between your finger and the app, so later timing scores reflect your playing rather than your hardware.\n\nOne honest note: almost everyone plays slightly ahead of a click — it is a well-documented human tendency, not a fault. The app corrects for the hardware part and leaves the human part visible, so it can tell you about it instead of silently hiding it.',
          'Why this matters'
        )
      ],
      exercise: { kind: 'calibration', mode: 'latency' }
    },
    {
      title: 'Sit well',
      kind: 'concept',
      newConcepts: ['posture'],
      blocks: [
        text(
          'A 25-key controller usually sits on a desk, which puts the keys higher than a piano would. That quietly encourages collapsed wrists and raised shoulders, and those habits are genuinely hard to undo later.\n\nSit so your forearms run roughly parallel to the floor and your wrists stay level — not dropped below the keys, not arched above them. If the desk is too high, raise your chair. Let your shoulders hang.',
          'Setting up'
        ),
        text(
          'Curve your fingers as if holding a small ball. Play on the fingertips, with the last joint firm rather than buckling. Your thumb plays on its side, near the tip.'
        )
      ]
    }
  ]
)

export const UNIT_1: Unit = makeUnit(
  1,
  'u1',
  'Hands and Keyboard Geography',
  'Find any white key by pattern, without a single note of notation.',
  'MID',
  [
    {
      title: 'Finger numbers',
      kind: 'concept',
      newConcepts: ['finger numbers'],
      blocks: [
        fingerFigure(
          'Both hands use the same numbering: thumb is 1, index 2, middle 3, ring 4, little finger 5. The hands mirror each other, so the two thumbs face one another in the middle of the keyboard.\n\nAlmost every instruction in this course refers to fingers by number, so this is worth a minute now.',
          'right',
          [1, 2, 3, 4, 5],
          'One to five, thumbs inward'
        )
      ],
      srsAtoms: ['finger-numbers']
    },
    {
      title: 'The black-key groups',
      kind: 'drill',
      newConcepts: ['black-key groups'],
      hands: 'either',
      blocks: [
        keyboardFigure(
          'The black keys are not evenly spread — they come in alternating groups of two and three. That pattern is how you find your way around without looking for labels, and it repeats identically all the way up the keyboard.',
          [49, 51, 54, 56, 58],
          { 49: 'a group of two', 54: 'a group of three' },
          'Twos and threes'
        )
      ],
      // Asks for the SHAPE, not note names: sharps are not taught until Unit 9.
      exercise: {
        kind: 'findNote',
        pool: [49, 51, 54, 56, 58, 61, 63, 66, 68, 70],
        acceptAnyOctave: true,
        groupMode: 'mixed',
        rounds: 8
      }
    },
    {
      title: 'Find C, F and B by pattern',
      kind: 'drill',
      newConcepts: ['landmark by pattern'],
      blocks: [
        keyboardFigure(
          'Now use the groups to name white keys:\n\n• C is the white key immediately left of any group of two.\n• F is the white key immediately left of any group of three.\n• B is the white key immediately right of any group of three.\n\nWith those three, every other white key is just a step away.',
          [60, 65, 59],
          { 60: 'C — left of a 2-group', 65: 'F — left of a 3-group', 59: 'B — right of a 3-group' },
          'Three keys you can always find'
        )
      ],
      exercise: { kind: 'findNote', pool: [48, 53, 59, 60, 65, 71, 72], acceptAnyOctave: true, rounds: 10 },
      srsAtoms: ['find-c', 'find-f', 'find-b']
    },
    {
      title: 'Name every white key',
      kind: 'drill',
      newConcepts: ['musical alphabet'],
      blocks: [
        text(
          'The white keys run A B C D E F G, then start again at A. Seven letters, repeating forever — there is no H.\n\nGoing right raises the pitch; going left lowers it. When you arrive back at the same letter you have moved an octave.'
        )
      ],
      // Letter names only — octave numbers are a separate skill, and demanding
      // "C3" rather than "a C" here would be testing something not yet taught.
      exercise: { kind: 'findNote', pool: MID_WHITE_KEYS, acceptAnyOctave: true, rounds: 12 },
      srsAtoms: ['white-key-names']
    }
  ]
)

export const UNIT_2: Unit = makeUnit(
  2,
  'u2',
  'Beat and Note Values',
  'Build rhythm as its own skill, before adding the load of reading pitch.',
  'MID',
  [
    {
      title: 'Beat, bars and 4/4',
      kind: 'concept',
      newConcepts: ['beat', 'bar', 'time signature'],
      blocks: [
        text(
          'Music runs on a steady pulse called the beat. Beats are grouped into bars by vertical bar lines, and the time signature at the start says how many beats each bar holds.\n\n4/4 means four beats per bar, and a quarter note gets one beat. Count "1 2 3 4" around and around.',
          'The pulse'
        )
      ],
      srsAtoms: ['time-signature-44']
    },
    {
      title: 'Tap quarter notes',
      kind: 'drill',
      newConcepts: ['quarter note'],
      blocks: [text('Tap any key on every click. Any pitch is fine — this is purely about the timing.')],
      exercise: { kind: 'rhythmTap', rounds: 1, generator: { bars: 4, timeSignature: [4, 4], tempoBpm: 72, keySignatureFifths: 0, pool: [60], hand: 'right', durations: [1], maxLeap: 1, restProbability: 0 } }
    },
    {
      title: 'Half notes and whole notes',
      kind: 'concept',
      newConcepts: ['half note', 'whole note'],
      blocks: [
        text(
          'A quarter note is one beat and has a filled head with a stem. A half note is two beats and has a hollow head with a stem. A whole note is four beats — hollow, no stem.\n\nThe most common beginner mistake is letting go too early: a half note must sound for the whole of "1-2", not just the instant you press it. This app checks how long you hold, not only when you start.',
          'Holding a note is part of playing it'
        )
      ],
      srsAtoms: ['note-values']
    },
    {
      title: 'Mixed rhythms',
      kind: 'drill',
      blocks: [text('Quarter, half and whole notes together. Keep counting out loud — it genuinely helps.')],
      exercise: { kind: 'rhythmTap', rounds: 1, generator: { bars: 4, timeSignature: [4, 4], tempoBpm: 72, keySignatureFifths: 0, pool: [60], hand: 'right', durations: [1, 2, 4], maxLeap: 1, restProbability: 0 } }
    },
    {
      title: '3/4 time',
      kind: 'concept',
      newConcepts: ['3/4 time', 'dotted half note'],
      blocks: [
        text(
          '3/4 means three beats per bar — a waltz. Count "1 2 3", leaning slightly on the 1.\n\nA dot after a note adds half of that note\'s value again. A dotted half note is therefore 2 + 1 = 3 beats, which fills a 3/4 bar exactly.'
        )
      ],
      srsAtoms: ['time-signature-34', 'dotted-half']
    },
    {
      title: 'Your first piece: one note',
      kind: 'play',
      hands: 'right',
      requiredRange: [60, 60],
      blocks: [text('Eight bars on Middle C alone. Everything here is rhythm — which is exactly the point.')],
      exercise: { kind: 'rhythmTap', rounds: 1, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 72, keySignatureFifths: 0, pool: [60], hand: 'right', durations: [1, 2, 4], maxLeap: 1, restProbability: 0.1 } }
    }
  ]
)

export const UNIT_3: Unit = makeUnit(
  3,
  'u3',
  'Right Hand, C Position',
  'Five-finger control in the right hand, still with no notation to decode.',
  'MID',
  [
    {
      title: 'The right-hand C position',
      kind: 'concept',
      hands: 'right',
      requiredRange: [60, 67],
      newConcepts: ['C position'],
      blocks: [
        keyboardFigure(
          'Put your right thumb on Middle C and let the other four fingers fall on the next four white keys: D, E, F, G. One finger per key, nothing crossing.\n\nThis is a hand position — a temporary frame that lets you play without moving. It is scaffolding, not the way you will eventually read music.',
          RH_C_POSITION,
          { 60: '1', 62: '2', 64: '3', 65: '4', 67: '5' },
          'Thumb on Middle C'
        )
      ]
    },
    {
      title: 'Finger-number sequences',
      kind: 'drill',
      hands: 'right',
      requiredRange: [60, 67],
      blocks: [text('Play the numbers as they appear. No staff yet — just fingers and keys.')],
      exercise: { kind: 'sightRead', staffOnly: false, preStaff: true, rounds: 1, generator: { bars: 4, timeSignature: [4, 4], tempoBpm: 66, keySignatureFifths: 0, pool: RH_C_POSITION, hand: 'right', durations: [1, 2], maxLeap: 1, restProbability: 0 } }
    },
    {
      title: 'Steps, skips and repeats',
      kind: 'concept',
      newConcepts: ['step', 'skip', 'repeat'],
      blocks: [
        text(
          'Three kinds of movement, and for now you can hear and feel all three without naming a single note:\n\n• A repeat plays the same key again.\n• A step moves to the very next key in the position.\n• A skip jumps over one key.\n\nRecognising these by shape is the foundation of fast reading, and it arrives properly in Unit 7.'
        )
      ],
      srsAtoms: ['step-skip-repeat']
    },
    {
      title: 'Right-hand pieces',
      kind: 'play',
      hands: 'right',
      requiredRange: [60, 67],
      blocks: [text('Short pieces in C position, quarter and half notes, 4/4.')],
      exercise: { kind: 'sightRead', staffOnly: false, preStaff: true, rounds: 2, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 72, keySignatureFifths: 0, pool: RH_C_POSITION, hand: 'right', durations: [1, 2, 4], maxLeap: 2, restProbability: 0.05 } }
    },
    {
      title: 'A piece in 3/4',
      kind: 'play',
      hands: 'right',
      requiredRange: [60, 67],
      blocks: [text('Three beats to the bar, with dotted half notes to fill a bar in one stroke.')],
      exercise: { kind: 'sightRead', staffOnly: false, preStaff: true, rounds: 1, generator: { bars: 8, timeSignature: [3, 4], tempoBpm: 69, keySignatureFifths: 0, pool: RH_C_POSITION, hand: 'right', durations: [1, 2, 3], maxLeap: 2, restProbability: 0 } }
    }
  ]
)

export const UNIT_4: Unit = makeUnit(
  4,
  'u4',
  'Left Hand, C Position',
  'The same control in the left hand, then the two hands taking turns.',
  'MID',
  [
    {
      title: 'The left-hand C position',
      kind: 'concept',
      hands: 'left',
      requiredRange: [48, 55],
      newConcepts: ['LH C position'],
      blocks: [
        keyboardFigure(
          'The left hand mirrors the right. Put your little finger (5) on C3 — one octave below Middle C — and your thumb (1) lands on G3.\n\nNotice the numbering runs the other way round: in the left hand, 5 is the lowest note and 1 the highest.',
          LH_C_POSITION,
          { 48: '5', 50: '4', 52: '3', 53: '2', 55: '1' },
          'Little finger on C3'
        )
      ]
    },
    {
      title: 'Left-hand sequences',
      kind: 'drill',
      hands: 'left',
      requiredRange: [48, 55],
      exercise: { kind: 'sightRead', staffOnly: false, preStaff: true, rounds: 1, generator: { bars: 4, timeSignature: [4, 4], tempoBpm: 66, keySignatureFifths: 0, pool: LH_C_POSITION, hand: 'left', durations: [1, 2], maxLeap: 1, restProbability: 0 } }
    },
    {
      title: 'Left-hand pieces',
      kind: 'play',
      hands: 'left',
      requiredRange: [48, 55],
      exercise: { kind: 'sightRead', staffOnly: false, preStaff: true, rounds: 2, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 72, keySignatureFifths: 0, pool: LH_C_POSITION, hand: 'left', durations: [1, 2, 4], maxLeap: 2, restProbability: 0.05 } }
    },
    {
      title: 'Hands taking turns',
      kind: 'play',
      hands: 'both',
      requiredRange: [48, 67],
      newConcepts: ['alternating hands'],
      blocks: [
        text(
          'Left hand plays a phrase, then the right answers. The hands never sound at the same time — playing together is a genuinely harder motor skill and gets its own lesson in Unit 8.'
        )
      ],
      exercise: { kind: 'sightRead', staffOnly: false, preStaff: true, rounds: 1, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 69, keySignatureFifths: 0, pool: [...LH_C_POSITION, ...RH_C_POSITION], hand: 'both', durations: [1, 2], maxLeap: 2, restProbability: 0.1 } }
    }
  ]
)

export const UNIT_5: Unit = makeUnit(
  5,
  'u5',
  'The Staff, and Middle C',
  'Read your first notes from a real staff.',
  'MID',
  [
    {
      title: 'Lines and spaces',
      kind: 'concept',
      newConcepts: ['staff', 'grand staff', 'clef'],
      blocks: [
        text(
          'A staff is five lines and the four spaces between them. A note sits either on a line or in a space, and the higher it sits, the higher it sounds.\n\nPiano music uses two staves joined by a brace — the grand staff. The upper one usually belongs to the right hand, the lower to the left.',
          'Five lines'
        ),
        text(
          'From here on, every lesson shows the staff. Falling notes are available as a practice aid, but at least one pass of each piece is staff-only — if you only ever watch falling bars, you finish the course unable to read, which is the one outcome this course is designed to avoid.',
          'Why we keep the staff visible'
        )
      ],
      srsAtoms: ['staff-lines-spaces']
    },
    {
      title: 'Landmark 1: Middle C',
      kind: 'concept',
      requiredRange: [60, 60],
      newConcepts: ['Middle C', 'ledger line'],
      blocks: [
        keyboardFigure(
          'Middle C sits between the two staves, on its own short line called a ledger line. It can be written below the treble staff or above the bass staff — same key either way, played by whichever thumb is closer.\n\nThis is the first of three landmark notes. Rather than counting up from the bottom line every time, you will learn to spot a landmark and read outward from it.',
          [MIDDLE_C],
          { 60: 'Middle C' },
          'The note in the middle'
        )
      ],
      srsAtoms: ['landmark-middle-c']
    },
    {
      title: 'Is it Middle C?',
      kind: 'drill',
      requiredRange: [55, 65],
      blocks: [text('Play the note you see. Some are Middle C; some are its neighbours.')],
      exercise: { kind: 'noteName', pool: [59, 60, 62], clef: 'grand', acceptAnyOctave: false, rounds: 10 }
    },
    {
      title: 'C, D and E in the treble',
      kind: 'concept',
      hands: 'right',
      requiredRange: [60, 64],
      blocks: [
        text(
          'From Middle C, step up: D sits in the space below the bottom line, E on the bottom line itself. Three notes, read by stepping up from a landmark rather than by memorising each one separately.'
        )
      ]
    },
    {
      title: 'Read C, D and E',
      kind: 'drill',
      hands: 'right',
      requiredRange: [60, 64],
      exercise: { kind: 'noteName', pool: [60, 62, 64], clef: 'treble', acceptAnyOctave: false, rounds: 12 },
      srsAtoms: ['read-c4', 'read-d4', 'read-e4']
    },
    {
      title: 'Pieces on three notes',
      kind: 'play',
      hands: 'right',
      requiredRange: [60, 64],
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 2, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 69, keySignatureFifths: 0, pool: [60, 62, 64], hand: 'right', durations: [1, 2, 4], maxLeap: 2, restProbability: 0.05 } }
    }
  ]
)

export const UNIT_6: Unit = makeUnit(
  6,
  'u6',
  'Treble G and Bass F',
  'Add the other two landmarks and complete both staves.',
  'MID',
  [
    {
      title: 'Landmark 2: Treble G',
      kind: 'concept',
      hands: 'right',
      requiredRange: [67, 67],
      newConcepts: ['treble clef', 'Treble G'],
      blocks: [
        keyboardFigure(
          'The treble clef is sometimes called the G clef, and for a good reason: the curl at its centre wraps around the second line from the bottom, and that line is G — the G above Middle C.\n\nThe clef is literally pointing at the note. Once you see that, you have a landmark near the top of the staff to read from.',
          [TREBLE_G],
          { 67: 'Treble G' },
          'The clef points at G'
        )
      ],
      srsAtoms: ['landmark-treble-g']
    },
    {
      title: 'Fill in F and G',
      kind: 'drill',
      hands: 'right',
      requiredRange: [60, 67],
      blocks: [text('You now have the whole right-hand C position on the staff: C D E F G.')],
      exercise: { kind: 'noteName', pool: RH_C_POSITION, clef: 'treble', acceptAnyOctave: false, rounds: 12 },
      srsAtoms: ['read-f4', 'read-g4']
    },
    {
      title: 'Landmark 3: Bass F',
      kind: 'concept',
      hands: 'left',
      requiredRange: [53, 53],
      newConcepts: ['bass clef', 'Bass F'],
      blocks: [
        keyboardFigure(
          'The bass clef does the same trick. Its two dots sit either side of the fourth line up, and that line is F — the F below Middle C.\n\nThree landmarks now: Bass F, Middle C, Treble G. Between them they cover the whole grand staff, and every other note is a step or a skip from one of them.',
          [BASS_F, MIDDLE_C, TREBLE_G],
          { 53: 'Bass F', 60: 'Middle C', 67: 'Treble G' },
          'The dots straddle F'
        )
      ],
      srsAtoms: ['landmark-bass-f']
    },
    {
      title: 'Read the bass staff',
      kind: 'drill',
      hands: 'left',
      requiredRange: [48, 60],
      blocks: [text('Down from Middle C: B, A, G — then the rest of the left-hand position.')],
      exercise: { kind: 'noteName', pool: [48, 50, 52, 53, 55, 57, 59], clef: 'bass', acceptAnyOctave: false, rounds: 12 },
      srsAtoms: ['read-c3', 'read-f3', 'read-g3']
    },
    {
      title: 'Both clefs at once',
      kind: 'drill',
      hands: 'both',
      requiredRange: [48, 67],
      blocks: [
        text(
          'Mixed treble and bass. This is the point where many people slow right down, because the same-looking note means different things in the two clefs. Read from the nearest landmark rather than translating.'
        )
      ],
      exercise: { kind: 'noteName', pool: [48, 50, 52, 53, 55, 60, 62, 64, 65, 67], clef: 'grand', acceptAnyOctave: false, rounds: 16 }
    },
    {
      title: 'Grand-staff pieces',
      kind: 'play',
      hands: 'both',
      requiredRange: [48, 67],
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 2, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 72, keySignatureFifths: 0, pool: [...LH_C_POSITION, ...RH_C_POSITION], hand: 'both', durations: [1, 2, 4], maxLeap: 2, restProbability: 0.1 } }
    }
  ]
)

export const UNIT_7: Unit = makeUnit(
  7,
  'u7',
  'Intervals: Steps and Skips',
  'Stop reading letters and start reading shapes. This is the unit that makes reading fast.',
  'MID',
  [
    {
      title: 'Seconds and thirds',
      kind: 'concept',
      newConcepts: ['2nd', '3rd', 'interval'],
      blocks: [
        text(
          'An interval is the distance between two notes, and on the staff it has an unmistakable look.\n\nA 2nd — a step — goes from a line to the space touching it. The two note heads are adjacent and appear to lean on each other.\n\nA 3rd — a skip — goes line to line, or space to space. The heads stack neatly with a visible gap.\n\nOnce you see this, you stop naming every note. You find one note, then read the shape.',
          'Line-to-space, line-to-line'
        )
      ],
      srsAtoms: ['interval-2nd', 'interval-3rd']
    },
    {
      title: 'Step or skip?',
      kind: 'drill',
      hands: 'right',
      requiredRange: [60, 67],
      blocks: [text('Answer by playing the second note, not by clicking a button.')],
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 2, generator: { bars: 4, timeSignature: [4, 4], tempoBpm: 66, keySignatureFifths: 0, pool: RH_C_POSITION, hand: 'right', durations: [1, 2], maxLeap: 2, restProbability: 0 } }
    },
    {
      title: 'Fourths and fifths',
      kind: 'concept',
      newConcepts: ['4th', '5th'],
      blocks: [
        text(
          'Wider intervals work the same way: a 4th goes line to space (or space to line) but with one note skipped between; a 5th goes line to line with a whole line skipped.\n\nThe 5th from C to G is worth knowing on sight — it is the frame of the hand position you have been using all along.'
        )
      ],
      srsAtoms: ['interval-4th', 'interval-5th']
    },
    {
      title: 'Intervals by ear',
      kind: 'drill',
      newConcepts: ['ear training'],
      blocks: [text('Now hear them. Two notes sound; play back the interval you heard, starting from any key.')],
      exercise: { kind: 'intervalEar', semitones: [2, 4, 5, 7], direction: 'ascending', rootRange: [55, 65], rounds: 10 }
    },
    {
      title: 'Harmonic intervals',
      kind: 'concept',
      newConcepts: ['harmonic interval', 'melodic interval'],
      blocks: [
        text(
          'Notes printed one after another are a melodic interval — you play them in turn. Notes printed stacked vertically are a harmonic interval — you play them together.\n\nHarmonic 3rds and 5ths in the left hand are the seed of chords, which arrive in Unit 10.'
        )
      ]
    },
    {
      title: 'Legato and staccato',
      kind: 'concept',
      newConcepts: ['legato', 'staccato', 'tie', 'slur'],
      blocks: [
        text(
          'A slur — a curved line over different notes — means legato: smoothly connected. With no sustain pedal on a 25-key controller, legato has to come entirely from your fingers. Hold each key until the very instant the next one sounds, so there is no gap and no overlap.\n\nA dot above or below a note head means staccato: short and detached, released well before the next note.\n\nA tie looks like a slur but joins two notes of the same pitch — play once, hold for both.',
          'Connecting notes without a pedal'
        )
      ],
      srsAtoms: ['legato', 'staccato', 'tie-vs-slur']
    },
    {
      title: 'Reading checkpoint',
      kind: 'assess',
      hands: 'both',
      requiredRange: [48, 67],
      minScore: 0.8,
      minTempoPercent: 80,
      blocks: [text('Everything from Units 5 to 7, on the staff, at tempo.')],
      exercise: { kind: 'sightRead', staffOnly: true, rounds: 3, generator: { bars: 8, timeSignature: [4, 4], tempoBpm: 76, keySignatureFifths: 0, pool: [...LH_C_POSITION, ...RH_C_POSITION], hand: 'both', durations: [1, 2, 4], maxLeap: 3, restProbability: 0.1 } }
    }
  ]
)
