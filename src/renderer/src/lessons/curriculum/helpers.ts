/**
 * Small builders that keep the curriculum data readable.
 *
 * The curriculum follows the modern "eclectic / landmark" consensus shared by
 * Alfred and Faber: pre-staff finger work first, then the three landmark notes
 * (Middle C, Treble G, Bass F), then reading by interval. Five-finger positions
 * are scaffolding, not the reading system — students who learn positions as the
 * reading system stall the moment music leaves the position.
 *
 * Only the ORDER of concepts is taken from those methods, which is factual and
 * not copyrightable. All pieces, text and exercises here are original.
 */

import type {
  ConceptBlock,
  Exercise,
  Hand,
  Lesson,
  LessonKind,
  OctaveAnchor,
  Unit
} from '@shared/types'

export interface LessonInit {
  title: string
  kind: LessonKind
  anchor?: OctaveAnchor | null
  hands?: Hand
  requiredRange?: [number, number]
  newConcepts?: string[]
  blocks?: ConceptBlock[]
  exercise?: Exercise
  minScore?: number
  minTempoPercent?: number
  srsAtoms?: string[]
}

export function makeUnit(
  index: number,
  id: string,
  title: string,
  goal: string,
  anchor: OctaveAnchor | null,
  lessons: LessonInit[]
): Unit {
  return {
    id,
    index,
    title,
    goal,
    anchor,
    lessons: lessons.map((init, i) => buildLesson(id, i + 1, init, anchor))
  }
}

function buildLesson(
  unitId: string,
  index: number,
  init: LessonInit,
  unitAnchor: OctaveAnchor | null
): Lesson {
  return {
    id: `${unitId}.${index}`,
    unitId,
    title: init.title,
    kind: init.kind,
    anchor: init.anchor === undefined ? unitAnchor : init.anchor,
    hands: init.hands ?? 'either',
    requiredRange: init.requiredRange,
    newConcepts: init.newConcepts ?? [],
    blocks: init.blocks ?? [],
    exercise: init.exercise,
    mastery: {
      // Concept lessons are read-and-continue; anything graded needs 80%,
      // which is also the bar Piano Marvel uses to advance a student.
      minScore: init.minScore ?? (init.kind === 'concept' ? 0 : 0.8),
      minTempoPercent: init.minTempoPercent ?? (init.kind === 'play' ? 80 : 0)
    },
    srsAtoms: init.srsAtoms
  }
}

/** Prose block. */
export function text(body: string, heading?: string): ConceptBlock {
  return heading ? { heading, body } : { body }
}

/** Prose plus a keyboard diagram. */
export function keyboardFigure(
  body: string,
  highlight: number[],
  labels?: Record<number, string>,
  heading?: string
): ConceptBlock {
  return { heading, body, figure: { type: 'keyboard', highlight, labels } }
}

export function fingerFigure(
  body: string,
  hand: 'left' | 'right',
  numbers: number[],
  heading?: string
): ConceptBlock {
  return { heading, body, figure: { type: 'fingers', hand, numbers } }
}

// ------------------------------------------------------------- note constants

/** Landmark notes, the anchors the whole reading system hangs off. */
export const MIDDLE_C = 60
export const TREBLE_G = 67
export const BASS_F = 53

/** Right-hand C position: C4-G4, thumb on Middle C. */
export const RH_C_POSITION = [60, 62, 64, 65, 67]
/** Left-hand C position: C3-G3, thumb on G3, little finger on C3. */
export const LH_C_POSITION = [48, 50, 52, 53, 55]

/** Every white key in the MID anchor (C3-C5). */
export const MID_WHITE_KEYS = [
  48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72
]

/**
 * The 25-key primary-chord voicings.
 *
 * This is the single most important hardware accommodation in the course.
 * The textbook C-position G7 is played B-F-G, which needs B2 = MIDI 47 — one
 * key below a C3-anchored 25-key controller, and no octave shift fixes it
 * while the right hand is also in C position. These voicings all sit inside
 * C3-C5 and keep the same harmonic function.
 */
export const PRIMARY_CHORDS_C = {
  /** C major, root position. Left hand 5-3-1. */
  I: [48, 52, 55], // C3 E3 G3
  /** F major, second inversion — keeps C under the little finger. LH 5-2-1. */
  IV: [48, 53, 57], // C3 F3 A3
  /**
   * G7 with the fifth omitted: F3 G3 B3, left hand 5-4-1.
   *
   * The textbook voicing is B-F-G, which needs B2. Dropping the fifth of a
   * dominant seventh is standard practice and keeps the root, third and
   * seventh — the notes that actually define the chord.
   */
  V7: [53, 55, 59] // F3 G3 B3
}
