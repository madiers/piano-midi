/**
 * Matches a live MIDI stream against an expected phrase and grades it.
 *
 * The matching is greedy-but-preferential: an incoming note first tries to
 * satisfy an expected event that is still waiting for exactly that pitch, and
 * only if none is in range does it get charged against the nearest event as a
 * wrong note. That ordering matters — matching purely by nearest onset would
 * report a correct note as wrong whenever the student was slightly out of time
 * and two events overlapped in the accept window.
 */

import type { GradingProfileId, Phrase, PhraseNote } from '@shared/types'
import {
  GRADING_PROFILES,
  appliedInputOffset,
  classifyError,
  computeScore,
  judgeTiming,
  timingWindows,
  type ErrorKind,
  type Judgement,
  type ScoreBreakdown,
  type TimingWindows
} from './grading'

/** One note the student is expected to play. */
export interface ExpectedEvent {
  id: string
  /** Onset in ms from the start of the performance. */
  onsetMs: number
  durationMs: number
  /** Every pitch in this event — more than one means a chord. */
  pitches: number[]
  hand: 'left' | 'right'
  fingers?: number[]
  /** Pitches not yet played. */
  unmatched: Set<number>
  /** Per-pitch judgement once matched. */
  results: Map<number, Judgement>
  /** Timestamps of the note-ons that satisfied this event, for chord spread. */
  onsetTimes: number[]
  expired: boolean
}

export type FeedbackEvent =
  | { type: 'hit'; eventId: string; pitch: number; judgement: Judgement; errorMs: number }
  | { type: 'wrong'; eventId: string; pitch: number; expected: number; kind: ErrorKind }
  | { type: 'missed'; eventId: string; pitch: number }
  | { type: 'extra'; pitch: number }
  | { type: 'complete'; result: PerformanceResult }

export interface PerformanceResult extends ScoreBreakdown {
  totalExpected: number
  correct: number
  wrong: number
  missed: number
  /** Mean signed timing error in ms; negative means consistently early. */
  meanTimingErrorMs: number
  /** Largest chord spread seen, in ms. */
  maxChordSpreadMs: number
  judgements: Judgement[]
  errorKinds: ErrorKind[]
}

export interface GraderOptions {
  profile: GradingProfileId
  bpm: number
  /** Measured input latency from calibration, in ms. */
  inputOffsetMs?: number
  /** In wait mode nothing is timed; the student advances by playing the right note. */
  waitMode?: boolean
  /** Percentage of target tempo this run is at, for star eligibility. */
  tempoPercent?: number
  /**
   * Accept ANY pitch as the right note, grading timing only.
   *
   * Rhythm exercises tell the student "tap any key — any pitch is fine".
   * Without this the grader still matched strictly by pitch, so following that
   * instruction scored every tap as a wrong note.
   */
  ignorePitch?: boolean
  onFeedback?: (event: FeedbackEvent) => void
}

/** Note-ons below this velocity are ignored as key noise. */
const VELOCITY_GATE = 8
/** Two note-ons of the same pitch closer than this are a double trigger. */
const RETRIGGER_SUPPRESS_MS = 30

export class PerformanceGrader {
  private readonly events: ExpectedEvent[]
  private readonly profile = GRADING_PROFILES.standard
  private readonly windows: TimingWindows
  private readonly offsetApplied: number
  readonly offsetResidual: number
  private readonly waitMode: boolean
  private readonly ignorePitch: boolean
  private readonly tempoPercent: number
  private readonly onFeedback?: (event: FeedbackEvent) => void

  private startedAt: number | null = null
  private lastOnsetByPitch = new Map<number, number>()
  private heldSince = new Map<number, { time: number; eventId: string }>()

  private correct = 0
  private wrong = 0
  private missed = 0
  private extras = 0
  private judgements: Judgement[] = []
  private errorKinds: ErrorKind[] = []
  private timingErrors: number[] = []
  private maxChordSpread = 0
  private finished = false

  /** In wait mode, the index of the event the student must play next. */
  private waitIndex = 0

  constructor(events: ExpectedEvent[], options: GraderOptions) {
    this.events = events
    this.profile = GRADING_PROFILES[options.profile]
    this.windows = timingWindows(options.bpm, this.profile)
    this.waitMode = options.waitMode ?? false
    this.ignorePitch = options.ignorePitch ?? false
    this.tempoPercent = options.tempoPercent ?? 100
    this.onFeedback = options.onFeedback

    const offset = appliedInputOffset(options.inputOffsetMs ?? 0, this.profile)
    this.offsetApplied = offset.applied
    this.offsetResidual = offset.residual
  }

  /** Build expected events from a phrase at a given tempo. */
  static fromPhrase(phrase: Phrase, bpm: number): ExpectedEvent[] {
    const msPerBeat = 60000 / bpm
    return phrase.notes
      .slice()
      .sort((a, b) => a.startBeats - b.startBeats)
      .map((note: PhraseNote) => ({
        id: note.id,
        onsetMs: note.startBeats * msPerBeat,
        durationMs: note.durationBeats * msPerBeat,
        pitches: [...note.midi],
        hand: note.hand,
        fingers: note.fingers,
        unmatched: new Set(note.midi),
        results: new Map<number, Judgement>(),
        onsetTimes: [],
        expired: false
      }))
  }

  /** Marks t=0. Every timestamp passed to noteOn is relative to this. */
  start(atMs: number): void {
    this.startedAt = atMs
  }

  get isStarted(): boolean {
    return this.startedAt !== null
  }

  /** The event the student should play next, for cursor and highlight UI. */
  get nextEvent(): ExpectedEvent | null {
    if (this.waitMode) return this.events[this.waitIndex] ?? null
    return this.events.find((e) => !e.expired && e.unmatched.size > 0) ?? null
  }

  /**
   * Feed a note-on.
   * `timeMs` is a performance-clock timestamp from the MIDI event.
   */
  noteOn(pitch: number, timeMs: number, velocity: number): void {
    if (this.finished) return
    if (velocity < VELOCITY_GATE) return

    const previous = this.lastOnsetByPitch.get(pitch)
    if (previous !== undefined && timeMs - previous < RETRIGGER_SUPPRESS_MS) return
    this.lastOnsetByPitch.set(pitch, timeMs)

    if (this.waitMode) {
      this.handleWaitMode(pitch)
      return
    }

    if (this.startedAt === null) return
    const t = timeMs - this.startedAt - this.offsetApplied

    // Candidate events are those whose accept window still contains t.
    const candidates = this.events.filter(
      (e) => !e.expired && e.unmatched.size > 0 && Math.abs(t - e.onsetMs) <= this.windows.ok
    )

    // In rhythm mode any key satisfies the nearest waiting event; only the
    // timing is judged.
    const exact = this.ignorePitch
      ? candidates.sort((a, b) => Math.abs(t - a.onsetMs) - Math.abs(t - b.onsetMs))[0]
      : candidates
          .filter((e) => e.unmatched.has(pitch))
          .sort((a, b) => Math.abs(t - a.onsetMs) - Math.abs(t - b.onsetMs))[0]

    if (exact) {
      const errorMs = t - exact.onsetMs
      const judgement = judgeTiming(errorMs, this.windows, this.profile)
      // With pitch ignored, consume whichever slot is waiting rather than the
      // one matching the played note.
      const consumed = this.ignorePitch ? ([...exact.unmatched][0] ?? pitch) : pitch
      exact.unmatched.delete(consumed)
      exact.results.set(consumed, judgement)
      exact.onsetTimes.push(t)
      this.correct += 1
      this.judgements.push(judgement)
      this.timingErrors.push(errorMs)
      this.heldSince.set(pitch, { time: timeMs, eventId: exact.id })

      if (exact.onsetTimes.length > 1) {
        const spread = Math.max(...exact.onsetTimes) - Math.min(...exact.onsetTimes)
        this.maxChordSpread = Math.max(this.maxChordSpread, spread)
      }

      this.emit({ type: 'hit', eventId: exact.id, pitch, judgement, errorMs })
      this.checkComplete()
      return
    }

    // Second preference: the nearest event with a slot free — a wrong note.
    const nearest = candidates.sort(
      (a, b) => Math.abs(t - a.onsetMs) - Math.abs(t - b.onsetMs)
    )[0]

    if (nearest) {
      const expectedPitch = [...nearest.unmatched][0]!
      nearest.unmatched.delete(expectedPitch)
      nearest.results.set(expectedPitch, 'miss')
      this.wrong += 1
      const kind = classifyError(pitch, expectedPitch)
      this.errorKinds.push(kind)
      this.emit({ type: 'wrong', eventId: nearest.id, pitch, expected: expectedPitch, kind })
      this.checkComplete()
      return
    }

    // Matched nothing at all.
    this.extras += 1
    this.emit({ type: 'extra', pitch })
  }

  noteOff(pitch: number, _timeMs: number): void {
    this.heldSince.delete(pitch)
  }

  /**
   * Wait mode: no timing at all, the student simply plays the right notes in
   * order. This is the highest-value mode for an absolute beginner, and the
   * reason it exists is that timing pressure makes reading impossible before
   * reading is automatic.
   */
  private handleWaitMode(pitch: number): void {
    const event = this.events[this.waitIndex]
    if (!event) return

    if (this.ignorePitch) {
      const consumed = [...event.unmatched][0]
      if (consumed === undefined) return
      event.unmatched.delete(consumed)
      event.results.set(consumed, 'perfect')
      this.correct += 1
      this.judgements.push('perfect')
      this.emit({ type: 'hit', eventId: event.id, pitch, judgement: 'perfect', errorMs: 0 })
      if (event.unmatched.size === 0) {
        this.waitIndex += 1
        if (this.waitIndex >= this.events.length) this.complete()
      }
      return
    }

    if (event.unmatched.has(pitch)) {
      event.unmatched.delete(pitch)
      event.results.set(pitch, 'perfect')
      this.correct += 1
      this.judgements.push('perfect')
      this.emit({ type: 'hit', eventId: event.id, pitch, judgement: 'perfect', errorMs: 0 })

      if (event.unmatched.size === 0) {
        this.waitIndex += 1
        if (this.waitIndex >= this.events.length) this.complete()
      }
      return
    }

    const expectedPitch = [...event.unmatched][0]
    if (expectedPitch === undefined) return
    this.wrong += 1
    const kind = classifyError(pitch, expectedPitch)
    this.errorKinds.push(kind)
    this.emit({ type: 'wrong', eventId: event.id, pitch, expected: expectedPitch, kind })
  }

  /**
   * Advance the playhead. Events whose accept window has passed are expired and
   * their unplayed pitches counted as missed.
   */
  tick(nowMs: number): void {
    if (this.finished || this.waitMode || this.startedAt === null) return
    const t = nowMs - this.startedAt - this.offsetApplied

    for (const event of this.events) {
      if (event.expired) continue
      if (t <= event.onsetMs + this.windows.ok) continue

      event.expired = true
      for (const pitch of event.unmatched) {
        this.missed += 1
        this.emit({ type: 'missed', eventId: event.id, pitch })
      }
      event.unmatched.clear()
    }
    this.checkComplete()
  }

  private checkComplete(): void {
    if (this.finished) return
    const done = this.events.every((e) => e.expired || e.unmatched.size === 0)
    if (done) this.complete()
  }

  complete(): PerformanceResult {
    if (this.finished) return this.buildResult()
    this.finished = true
    const result = this.buildResult()
    this.emit({ type: 'complete', result })
    return result
  }

  get isFinished(): boolean {
    return this.finished
  }

  private buildResult(): PerformanceResult {
    const totalExpected = this.events.reduce((n, e) => n + e.pitches.length, 0)
    const breakdown = computeScore(
      this.correct,
      totalExpected,
      this.judgements,
      this.extras,
      this.tempoPercent
    )
    const meanTimingErrorMs =
      this.timingErrors.length === 0
        ? 0
        : this.timingErrors.reduce((a, b) => a + b, 0) / this.timingErrors.length

    return {
      ...breakdown,
      totalExpected,
      correct: this.correct,
      wrong: this.wrong,
      missed: this.missed,
      meanTimingErrorMs,
      maxChordSpreadMs: this.maxChordSpread,
      judgements: this.judgements,
      errorKinds: this.errorKinds
    }
  }

  private emit(event: FeedbackEvent): void {
    this.onFeedback?.(event)
  }
}
