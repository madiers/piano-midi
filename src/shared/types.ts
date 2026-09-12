/**
 * Types shared between the main and renderer processes.
 *
 * The curriculum design these types encode is an "eclectic / landmark" method
 * (the Alfred-Faber consensus): pre-staff finger work, then the three landmark
 * notes (Middle C, Treble G, Bass F), then intervallic reading. Five-finger
 * positions are a temporary scaffold, never the reading system.
 */

export type Hand = 'left' | 'right' | 'both' | 'either'

/**
 * Which two-octave slice of the keyboard a unit expects.
 *
 * A 25-key controller spans exactly 24 semitones, so only ONE anchor is
 * reachable at a time. We never silently transpose the music to fit — that
 * would break the note-name-to-physical-key mapping the student is building.
 * Instead a lesson declares its anchor and the app asks for an octave shift.
 */
export type OctaveAnchor = 'LOW' | 'MID' | 'HIGH'

export interface AnchorSpec {
  id: OctaveAnchor
  /** Lowest MIDI note the anchor needs. */
  low: number
  /** Highest MIDI note the anchor needs. */
  high: number
  label: string
  description: string
}

/**
 * MID contains all three landmarks (Bass F 53, Middle C 60, Treble G 67) and
 * supports both C positions plus a two-octave RH scale, which is why almost
 * the whole course lives there.
 */
export const ANCHORS: Record<OctaveAnchor, AnchorSpec> = {
  LOW: {
    id: 'LOW',
    low: 36,
    high: 60,
    label: 'Low (C2–C4)',
    description: 'Used for F major and left-hand chord work.'
  },
  MID: {
    id: 'MID',
    low: 48,
    high: 72,
    label: 'Middle (C3–C5)',
    description: 'The default. Contains Middle C, Treble G and Bass F.'
  },
  HIGH: {
    id: 'HIGH',
    low: 60,
    high: 84,
    label: 'High (C4–C6)',
    description: 'Optional, for two-octave right-hand scales.'
  }
}

// ------------------------------------------------------------------- settings

export type GradingProfileId = 'beginner' | 'standard' | 'strict'

/** Practice tempo ladder. Wait mode does not grade timing at all. */
export type TempoStep = 'wait' | 60 | 80 | 100

export interface DeviceCalibration {
  deviceId: string | null
  deviceName: string | null
  /** Lowest and highest MIDI note numbers the hardware actually sends. */
  deviceLow: number
  deviceHigh: number
  keyCount: number
  /**
   * Median signed timing error from the tap test, in ms.
   *
   * This mixes real device latency with the human "negative mean asynchrony"
   * (people genuinely tap early). We only ever subtract part of it — see
   * `appliedInputOffset` in the grading engine — so a real timing habit stays
   * visible and coachable instead of being silently erased.
   */
  inputOffsetMs: number
  calibratedAt: string
}

export interface AppSettings {
  schemaVersion: number
  midi: {
    /** null means auto-detect. */
    preferredDeviceId: string | null
    /** Semitones added to incoming notes, for octave shifting. */
    transpose: number
  }
  calibration: DeviceCalibration | null
  audio: {
    /** 0..1 */
    masterVolume: number
    metronomeVolume: number
    /**
     * Sample tails are truncated to this many seconds on decode.
     *
     * Salamander's bass samples run 20-26 s, which decodes to ~140 MB of
     * Float32 for a single velocity layer. Truncating to a few seconds costs
     * nothing audibly for beginner exercises and cuts resident audio by ~60%.
     */
    sampleTailSeconds: number
    engine: 'samples' | 'synth'
  }
  practice: {
    gradingProfile: GradingProfileId
    tempoStep: TempoStep
    countInBars: number
    metronomeEnabled: boolean
    showNoteNames: boolean
    showFingerNumbers: boolean
    /** Falling-note view alongside the staff. */
    showFallingNotes: boolean
  }
  ui: {
    theme: 'system' | 'light' | 'dark'
    /** Label middle C as C4 (scientific) or C3 (some hardware). Display only. */
    octaveNaming: 'C4' | 'C3'
  }
  updates: {
    autoCheck: boolean
  }
  onboarding: {
    completed: boolean
  }
}

export const SETTINGS_SCHEMA_VERSION = 1

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  midi: { preferredDeviceId: null, transpose: 0 },
  calibration: null,
  audio: {
    masterVolume: 0.8,
    metronomeVolume: 0.5,
    sampleTailSeconds: 6,
    engine: 'samples'
  },
  practice: {
    gradingProfile: 'beginner',
    tempoStep: 'wait',
    countInBars: 1,
    metronomeEnabled: true,
    showNoteNames: true,
    showFingerNumbers: true,
    showFallingNotes: true
  },
  ui: { theme: 'system', octaveNaming: 'C4' },
  updates: { autoCheck: true },
  onboarding: { completed: false }
}

// ------------------------------------------------------------------- progress

export type StarRating = 0 | 1 | 2 | 3

export interface LessonResult {
  lessonId: string
  stars: StarRating
  /** Best final score 0..1. */
  bestScore: number
  bestPitchAccuracy: number
  attempts: number
  /** Highest tempo step at which the lesson was passed. */
  bestTempoPercent: number
  completed: boolean
  lastPlayedAt: string
}

/**
 * A spaced-repetition card. Deliberately limited to DECLARATIVE facts —
 * note names, intervals, chord qualities, key signatures. Applying a
 * forgetting-curve scheduler to motor skills (scales, pieces) is a category
 * error, so those use a simple replay ladder instead.
 */
export interface SrsCard {
  id: string
  /** Days. */
  interval: number
  ease: number
  repetitions: number
  lapses: number
  dueAt: string
  lastReviewedAt: string | null
}

export interface PracticeStats {
  totalPracticeMs: number
  sessions: number
  streakDays: number
  longestStreakDays: number
  /** YYYY-MM-DD in local time. */
  lastPracticeDate: string | null
  /** Streak freezes left this week — one forgiven missed day. */
  freezesRemaining: number
  notesPlayed: number
}

export interface UserProgress {
  schemaVersion: number
  lessons: Record<string, LessonResult>
  srs: Record<string, SrsCard>
  stats: PracticeStats
  createdAt: string
}

export const PROGRESS_SCHEMA_VERSION = 1

export function createEmptyProgress(now = new Date().toISOString()): UserProgress {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    lessons: {},
    srs: {},
    stats: {
      totalPracticeMs: 0,
      sessions: 0,
      streakDays: 0,
      longestStreakDays: 0,
      lastPracticeDate: null,
      freezesRemaining: 1,
      notesPlayed: 0
    },
    createdAt: now
  }
}

// --------------------------------------------------------------------- music

/** A note (or chord) inside a generated or authored phrase. */
export interface PhraseNote {
  id: string
  /** One entry for a single note, several for a chord. */
  midi: number[]
  /** Onset in beats from the start of the phrase. */
  startBeats: number
  durationBeats: number
  hand: 'left' | 'right'
  /** 1 = thumb .. 5 = little finger. */
  fingers?: number[]
  /** Optional lyric/counting syllable shown under the note. */
  label?: string
}

export interface Phrase {
  /** e.g. [4, 4] for 4/4. */
  timeSignature: [number, number]
  /** Positive = sharps, negative = flats. */
  keySignatureFifths: number
  tempoBpm: number
  bars: number
  notes: PhraseNote[]
  /** Only notes for this hand are graded; the other hand may be played back. */
  gradedHands: Hand
}

// ------------------------------------------------------------------ exercises

export type ExerciseKind =
  | 'noteName'
  | 'findNote'
  | 'sightRead'
  | 'playAlong'
  | 'chordBuild'
  | 'intervalEar'
  | 'rhythmTap'
  | 'scaleRun'
  | 'freePlay'

/** How strictly a chord answer must match what was asked for. */
export type InversionPolicy = 'exact' | 'any-inversion' | 'any-voicing'

interface ExerciseBase {
  kind: ExerciseKind
  /** Overrides the lesson's grading profile when set. */
  gradingProfile?: GradingProfileId
  /** How many prompts/rounds before the exercise ends. */
  rounds?: number
}

/** "Which note is this?" — answered by PLAYING it, not by clicking. */
export interface NoteNameExercise extends ExerciseBase {
  kind: 'noteName'
  /** Pool of MIDI notes that may be asked. */
  pool: number[]
  clef: 'treble' | 'bass' | 'grand'
  /** Accept the right pitch class in any octave. Used early on. */
  acceptAnyOctave: boolean
}

/** "Find F sharp" — named in words, located on the keyboard. */
export interface FindNoteExercise extends ExerciseBase {
  kind: 'findNote'
  pool: number[]
  acceptAnyOctave: boolean
  /** Prompt by pattern ("the white key left of a 2-black-key group"). */
  byPattern?: boolean
}

/** Read and play a generated phrase in time. */
export interface SightReadExercise extends ExerciseBase {
  kind: 'sightRead'
  generator: PhraseGeneratorSpec
  /** Hide the falling-note lane — at least one pass per lesson must be staff-only. */
  staffOnly: boolean
}

/** Synthesia-style falling notes over a fixed phrase. */
export interface PlayAlongExercise extends ExerciseBase {
  kind: 'playAlong'
  phrase: Phrase
}

export interface ChordBuildExercise extends ExerciseBase {
  kind: 'chordBuild'
  /** Roots offered, as MIDI notes. */
  roots: number[]
  qualities: Array<'major' | 'minor' | 'diminished' | 'augmented' | 'dominant7'>
  inversions: number[]
  inversionPolicy: InversionPolicy
  /** Ask by ear rather than by name. */
  byEar: boolean
}

export interface IntervalEarExercise extends ExerciseBase {
  kind: 'intervalEar'
  /** Interval sizes in semitones that may be asked. */
  semitones: number[]
  direction: 'ascending' | 'descending' | 'harmonic' | 'mixed'
  rootRange: [number, number]
}

/** Rhythm only — any pitch counts, timing is everything. */
export interface RhythmTapExercise extends ExerciseBase {
  kind: 'rhythmTap'
  generator: PhraseGeneratorSpec
}

export interface ScaleRunExercise extends ExerciseBase {
  kind: 'scaleRun'
  tonicMidi: number
  scaleType: 'major' | 'naturalMinor'
  octaves: number
  hands: Hand
  tempoBpm: number
  /** Grade evenness of inter-onset intervals, not just correctness. */
  gradeEvenness: boolean
}

export interface FreePlayExercise extends ExerciseBase {
  kind: 'freePlay'
}

export type Exercise =
  | NoteNameExercise
  | FindNoteExercise
  | SightReadExercise
  | PlayAlongExercise
  | ChordBuildExercise
  | IntervalEarExercise
  | RhythmTapExercise
  | ScaleRunExercise
  | FreePlayExercise

/**
 * Parameters for generating a fresh phrase.
 *
 * Sight-reading exercises MUST resample the seed on every retry — reusing it
 * turns sight-reading into memorisation.
 */
export interface PhraseGeneratorSpec {
  bars: number
  timeSignature: [number, number]
  tempoBpm: number
  keySignatureFifths: number
  /** Notes the generator may choose from. */
  pool: number[]
  hand: 'left' | 'right' | 'both'
  /** Which durations may appear, in beats. */
  durations: number[]
  /** Largest melodic leap in scale steps. 1 = steps only. */
  maxLeap: number
  /** Probability 0..1 that a rest is placed instead of a note. */
  restProbability: number
  /** Allow chords of this many notes. 1 = melody only. */
  maxChordSize?: number
  /**
   * Where the two hands divide when `hand` is 'both'. Notes below this go to
   * the left hand, notes at or above it to the right. Defaults to Middle C.
   * Without this the hands share one pool and can be handed the same key at
   * the same instant, which nobody can play.
   */
  handSplit?: number
}

// -------------------------------------------------------------------- lessons

export type LessonKind = 'concept' | 'drill' | 'play' | 'review' | 'assess'

/** A block of teaching content shown before the interactive part. */
export interface ConceptBlock {
  heading?: string
  body: string
  /** Illustration hint the UI knows how to draw. */
  figure?:
    | { type: 'keyboard'; highlight: number[]; labels?: Record<number, string> }
    | { type: 'staff'; phrase: Phrase }
    | { type: 'fingers'; hand: 'left' | 'right'; numbers: number[] }
    | { type: 'interval'; from: number; to: number }
}

export interface Lesson {
  id: string
  unitId: string
  title: string
  kind: LessonKind
  /** null for lessons with no keyboard requirement (pure concept). */
  anchor: OctaveAnchor | null
  hands: Hand
  /** Inclusive MIDI range the lesson actually needs. */
  requiredRange?: [number, number]
  /** Short strings naming what is introduced here, shown as chips. */
  newConcepts: string[]
  blocks: ConceptBlock[]
  exercise?: Exercise
  mastery: {
    /** Final score needed to mark complete and unlock the next lesson. */
    minScore: number
    /** Percentage of target tempo the score must be achieved at. */
    minTempoPercent: number
  }
  /** SRS atom ids this lesson introduces. */
  srsAtoms?: string[]
}

export interface Unit {
  id: string
  index: number
  title: string
  goal: string
  anchor: OctaveAnchor | null
  lessons: Lesson[]
}
