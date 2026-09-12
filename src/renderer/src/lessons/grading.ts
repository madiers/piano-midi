/**
 * Timing windows and scoring.
 *
 * The numbers are derived from sensorimotor-synchronization research rather
 * than from rhythm-game conventions. Novice tap standard deviation is roughly
 * 4-5% of the inter-onset interval, which is about 30 ms at 90 BPM — so a
 * game-style ±16 ms "perfect" would be earned by chance and teach nothing.
 * Instead every window is a fraction of the beat, clamped to absolute bounds
 * so it stays sane at extreme tempos.
 *
 * Perception research puts the threshold for hearing two onsets as separate at
 * roughly 40 ms, so a ±35 ms PERFECT genuinely means "that sounded together" —
 * it is not a participation trophy.
 */

import type { GradingProfileId } from '@shared/types'

export type Judgement = 'perfect' | 'good' | 'ok' | 'miss'

export type NoteOutcome =
  | 'perfect'
  | 'good'
  | 'ok'
  | 'wrong-pitch'
  | 'missed'
  | 'extra'

export interface GradingProfile {
  id: GradingProfileId
  /** Multiplies every window. Beginner is more forgiving. */
  mult: number
  /** Max gap between note-ons that still counts as one chord. */
  chordSpreadMs: number
  /** Whether note lengths are checked as well as onsets. */
  durationChecks: boolean
  /**
   * Novices systematically anticipate the beat, so early hits get a slightly
   * wider window in the gentler profiles. Turned off at 'strict', where the
   * bias is coached instead of accommodated.
   */
  earlyBias: number
}

export const GRADING_PROFILES: Record<GradingProfileId, GradingProfile> = {
  beginner: { id: 'beginner', mult: 1.5, chordSpreadMs: 90, durationChecks: false, earlyBias: 1.25 },
  standard: { id: 'standard', mult: 1.0, chordSpreadMs: 60, durationChecks: true, earlyBias: 1.0 },
  strict: { id: 'strict', mult: 0.7, chordSpreadMs: 40, durationChecks: true, earlyBias: 1.0 }
}

interface Tier {
  name: Judgement
  frac: number
  minMs: number
  maxMs: number
  score: number
}

const TIERS: Tier[] = [
  { name: 'perfect', frac: 0.05, minMs: 35, maxMs: 70, score: 1.0 },
  { name: 'good', frac: 0.11, minMs: 70, maxMs: 140, score: 0.8 },
  { name: 'ok', frac: 0.2, minMs: 120, maxMs: 250, score: 0.5 }
]

export interface TimingWindows {
  perfect: number
  good: number
  /** Also the accept window: beyond this, a note is not matched at all. */
  ok: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Half-widths in ms for a tempo and profile. */
export function timingWindows(bpm: number, profile: GradingProfile): TimingWindows {
  const beat = 60000 / bpm
  const [perfect, good, ok] = TIERS.map((t) => clamp(t.frac * beat, t.minMs, t.maxMs) * profile.mult)
  return { perfect: perfect!, good: good!, ok: ok! }
}

/**
 * Judge a signed timing error. Negative means early.
 * Early errors are scaled down by the profile's early bias before comparison,
 * which effectively widens the early side of each window.
 */
export function judgeTiming(
  errorMs: number,
  windows: TimingWindows,
  profile: GradingProfile
): Judgement {
  const adjusted = errorMs < 0 ? Math.abs(errorMs) / profile.earlyBias : Math.abs(errorMs)
  if (adjusted <= windows.perfect) return 'perfect'
  if (adjusted <= windows.good) return 'good'
  if (adjusted <= windows.ok) return 'ok'
  return 'miss'
}

export function judgementScore(judgement: Judgement): number {
  switch (judgement) {
    case 'perfect':
      return 1
    case 'good':
      return 0.8
    case 'ok':
      return 0.5
    case 'miss':
      return 0
  }
}

// --------------------------------------------------------------- error kinds

/**
 * Why a wrong note was wrong.
 *
 * These six cover the large majority of beginner mistakes, and each maps to a
 * different piece of teaching. "Wrong note" alone teaches nothing; "you played
 * the right letter an octave too low" teaches something specific.
 */
export type ErrorKind =
  | 'octave'
  | 'semitone-neighbour'
  | 'adjacent-white'
  | 'wrong-hand-range'
  | 'right-letter-wrong-accidental'
  | 'unrelated'

export function classifyError(
  played: number,
  expected: number,
  handSplitPoint?: number
): ErrorKind {
  const pcPlayed = ((played % 12) + 12) % 12
  const pcExpected = ((expected % 12) + 12) % 12

  if (played !== expected && pcPlayed === pcExpected) return 'octave'

  const distance = Math.abs(played - expected)
  if (distance === 1) {
    // A semitone apart with the same letter name means the accidental was
    // missed — a different mistake from brushing a neighbouring key.
    const isBlackPlayed = [1, 3, 6, 8, 10].includes(pcPlayed)
    const isBlackExpected = [1, 3, 6, 8, 10].includes(pcExpected)
    if (isBlackPlayed !== isBlackExpected) return 'right-letter-wrong-accidental'
    return 'semitone-neighbour'
  }

  if (distance === 2 && !isBlack(pcPlayed) && !isBlack(pcExpected)) return 'adjacent-white'

  if (
    handSplitPoint !== undefined &&
    played === expected + 0 &&
    (played < handSplitPoint) !== (expected < handSplitPoint)
  ) {
    return 'wrong-hand-range'
  }

  return 'unrelated'
}

function isBlack(pitchClass: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitchClass)
}

export const ERROR_HINTS: Record<ErrorKind, string> = {
  octave: 'Right note name, wrong octave — check which hand position you are in.',
  'semitone-neighbour': 'You caught the key next door. Keep fingertips firm and curved.',
  'adjacent-white': 'One white key off — count lines and spaces from the nearest landmark.',
  'wrong-hand-range': 'Right note, wrong hand.',
  'right-letter-wrong-accidental':
    'Right letter, wrong black/white key — check the sharp or flat.',
  unrelated: 'Not the written note — find it from the nearest landmark.'
}

// --------------------------------------------------------------- final score

export interface ScoreBreakdown {
  pitchAccuracy: number
  timingQuality: number
  extras: number
  extrasPenalty: number
  final: number
  stars: 0 | 1 | 2 | 3
}

/**
 * Weighted 65% pitch / 35% timing: playing the right notes matters more than
 * playing them exactly on the beat, which is the correct priority for a
 * beginner. Extras are cheap on purpose — on unweighted keys, brushing a
 * neighbouring key is a hardware artefact as much as a mistake, and punishing
 * it hard just produces frustration.
 */
export function computeScore(
  correctEvents: number,
  expectedEvents: number,
  hitJudgements: Judgement[],
  extras: number,
  tempoPercent: number
): ScoreBreakdown {
  const pitchAccuracy = expectedEvents === 0 ? 0 : correctEvents / expectedEvents
  const timingQuality =
    hitJudgements.length === 0
      ? 0
      : hitJudgements.reduce((sum, j) => sum + judgementScore(j), 0) / hitJudgements.length

  const extrasPenalty = Math.min(0.15, 0.02 * extras)
  const final = Math.max(0, 0.65 * pitchAccuracy + 0.35 * timingQuality - extrasPenalty)

  let stars: 0 | 1 | 2 | 3 = 0
  if (final >= 0.93 && pitchAccuracy >= 0.95 && extras <= 2 && tempoPercent >= 100) stars = 3
  else if (final >= 0.8) stars = 2
  else if (final >= 0.6) stars = 1

  return { pitchAccuracy, timingQuality, extras, extrasPenalty, final, stars }
}

/** A lesson unlocks the next one at 80% score, played at ≥80% of target tempo. */
export function passesMastery(
  score: number,
  tempoPercent: number,
  minScore = 0.8,
  minTempoPercent = 80
): boolean {
  return score >= minScore && tempoPercent >= minTempoPercent
}

/**
 * How much of the measured input offset to actually subtract.
 *
 * The calibration median mixes device latency with the human tendency to tap
 * early. Subtracting all of it on the standard profile would permanently mask
 * a real timing habit that the student should be coached out of, so we cap the
 * correction and leave the remainder visible.
 */
export function appliedInputOffset(
  measuredOffsetMs: number,
  profile: GradingProfile
): { applied: number; residual: number } {
  if (profile.id === 'beginner') {
    return { applied: measuredOffsetMs, residual: 0 }
  }
  const cap = 30
  const applied = Math.sign(measuredOffsetMs) * Math.min(Math.abs(measuredOffsetMs), cap)
  return { applied, residual: measuredOffsetMs - applied }
}

// ----------------------------------------------------------------- durations

export type DurationVerdict = 'ok' | 'clipped' | 'broken-legato' | 'smudged' | 'too-long'

export function judgeDuration(
  heldMs: number,
  notatedMs: number,
  mode: 'normal' | 'legato' | 'staccato',
  gapToNextMs?: number
): DurationVerdict {
  const ratio = notatedMs === 0 ? 1 : heldMs / notatedMs

  switch (mode) {
    case 'staccato':
      return ratio <= 0.5 && heldMs <= 250 ? 'ok' : 'too-long'

    case 'legato': {
      if (ratio < 0.85) return 'clipped'
      if (ratio > 1.2) return 'smudged'
      if (gapToNextMs !== undefined) {
        if (gapToNextMs > 40) return 'broken-legato'
        if (gapToNextMs < -120) return 'smudged'
      }
      return 'ok'
    }

    case 'normal':
    default:
      // Under-holding half and whole notes is the single most common beginner
      // error, so it is worth flagging even when the onset was perfect.
      return ratio >= 0.5 ? 'ok' : 'clipped'
  }
}
