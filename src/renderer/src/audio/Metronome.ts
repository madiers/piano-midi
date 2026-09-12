/**
 * Metronome.
 *
 * Clicks are scheduled ahead of time on the AudioContext clock rather than
 * fired from a timer, which is the only way to get a steady pulse: setTimeout
 * drifts by tens of milliseconds under render load, and a metronome that
 * wobbles is worse than none when the student is being graded against it.
 *
 * The timer only decides *what to schedule next*; the audio clock decides when
 * it actually sounds.
 */

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_S = 0.1

export interface MetronomeTick {
  /** 0-based beat within the bar. */
  beatInBar: number
  /** Absolute beat count since start. */
  beat: number
  /** AudioContext time the click sounds. */
  time: number
}

export class Metronome {
  private timer: ReturnType<typeof setInterval> | null = null
  private nextNoteTime = 0
  private beat = 0
  private running = false

  private bpm = 90
  private beatsPerBar = 4

  /** Called for every scheduled tick so the UI can flash in sync. */
  onTick: ((tick: MetronomeTick) => void) | null = null

  constructor(
    private readonly context: AudioContext,
    private readonly output: GainNode
  ) {}

  get isRunning(): boolean {
    return this.running
  }

  setTempo(bpm: number): void {
    this.bpm = Math.max(20, Math.min(300, bpm))
  }

  setTimeSignature(beatsPerBar: number): void {
    this.beatsPerBar = Math.max(1, beatsPerBar)
  }

  /** Starts at the next audio-clock instant. Returns that start time. */
  start(startAt?: number): number {
    if (this.running) return this.nextNoteTime
    this.running = true
    this.beat = 0
    this.nextNoteTime = startAt ?? this.context.currentTime + 0.1
    const startTime = this.nextNoteTime

    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS)
    this.schedule()
    return startTime
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private schedule(): void {
    if (!this.running) return
    const secondsPerBeat = 60 / this.bpm

    while (this.nextNoteTime < this.context.currentTime + SCHEDULE_AHEAD_S) {
      const beatInBar = this.beat % this.beatsPerBar
      this.click(this.nextNoteTime, beatInBar === 0)
      this.onTick?.({ beatInBar, beat: this.beat, time: this.nextNoteTime })

      this.nextNoteTime += secondsPerBeat
      this.beat += 1
    }
  }

  /**
   * A short pitched blip. The downbeat is higher so bars are audible without
   * counting. Oscillator rather than a sample: zero load time, zero memory,
   * and a click is one of the few sounds synthesis genuinely nails.
   */
  private click(time: number, accent: boolean): void {
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()

    osc.frequency.value = accent ? 1000 : 800
    osc.type = 'square'

    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(accent ? 0.5 : 0.32, time + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)

    osc.connect(gain)
    gain.connect(this.output)
    osc.start(time)
    osc.stop(time + 0.06)
  }
}
