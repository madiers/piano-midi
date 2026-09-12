/**
 * The renderer's single audio entry point.
 *
 * Owns the AudioContext, the master gain, the piano voice (sampled, with a
 * synth fallback) and the metronome, and provides the one conversion everything
 * else depends on: mapping `performance.now()` timestamps from MIDI events onto
 * the AudioContext clock, so grading and playback share one timeline.
 */

import type { AudioManifest } from '@shared/ipc'
import { PianoSampler, type SamplerLoadProgress } from './PianoSampler'
import { SynthPiano } from './SynthPiano'
import { Metronome } from './Metronome'

export type AudioEngineStatus =
  | 'idle'
  | 'loading'
  | 'ready-samples'
  | 'ready-synth'
  | 'error'

export class AudioEngine {
  readonly context: AudioContext
  private readonly master: GainNode
  private readonly metronomeGain: GainNode

  private sampler: PianoSampler | null = null
  private readonly synth: SynthPiano
  readonly metronome: Metronome

  private status: AudioEngineStatus = 'idle'
  private errorMessage: string | null = null
  private useSamples = false

  /**
   * performance.now() minus AudioContext.currentTime*1000, refreshed
   * periodically. MIDI timestamps are on the performance clock; audio is on the
   * context clock, and the two drift.
   */
  private perfToContextOffsetMs = 0
  private offsetTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    // 'interactive' asks the platform for the smallest buffer it will give us.
    this.context = new AudioContext({ latencyHint: 'interactive' })

    this.master = this.context.createGain()
    this.master.gain.value = 0.8
    this.master.connect(this.context.destination)

    this.metronomeGain = this.context.createGain()
    this.metronomeGain.gain.value = 0.5
    this.metronomeGain.connect(this.context.destination)

    this.synth = new SynthPiano(this.context, this.master)
    this.metronome = new Metronome(this.context, this.metronomeGain)

    this.refreshClockOffset()
    this.offsetTimer = setInterval(() => this.refreshClockOffset(), 5000)
  }

  getStatus(): AudioEngineStatus {
    return this.status
  }

  getError(): string | null {
    return this.errorMessage
  }

  /** Reported output latency in ms, for the diagnostics panel. */
  getLatencyMs(): number {
    const base = this.context.baseLatency ?? 0
    const output = this.context.outputLatency ?? 0
    return Math.round((base + output) * 1000)
  }

  getSamplerInfo(): { samples: number; memoryMB: number } | null {
    if (!this.sampler?.isReady) return null
    return {
      samples: this.sampler.sampleCount,
      memoryMB: Math.round((this.sampler.memoryBytes / 1048576) * 10) / 10
    }
  }

  /**
   * Browsers suspend a context created outside a user gesture. Call this from
   * any click, and again on the first MIDI note, so the first key press is
   * never silent.
   */
  async resume(): Promise<void> {
    if (this.context.state === 'suspended') {
      try {
        await this.context.resume()
      } catch (err) {
        console.warn('[audio] resume failed:', err)
      }
    }
  }

  async loadSamples(
    manifest: AudioManifest | null,
    baseUrl: string,
    tailSeconds: number,
    onProgress?: (progress: SamplerLoadProgress) => void
  ): Promise<void> {
    if (!manifest) {
      this.status = 'ready-synth'
      this.errorMessage = 'No sample pack found — run `npm run assets`. Using a synthesised tone.'
      this.useSamples = false
      return
    }

    this.status = 'loading'
    const sampler = new PianoSampler(this.context, this.master, { tailSeconds })
    try {
      await sampler.load(manifest, baseUrl, onProgress)
      this.sampler = sampler
      this.useSamples = true
      this.status = 'ready-samples'
      this.errorMessage = null
    } catch (err) {
      console.error('[audio] sample load failed:', err)
      this.sampler = null
      this.useSamples = false
      this.status = 'ready-synth'
      this.errorMessage =
        err instanceof Error ? err.message : 'Sample pack failed to load; using a synthesised tone.'
    }
  }

  // --------------------------------------------------------------- playing

  noteOn(midi: number, velocity = 80): void {
    void this.resume()
    if (this.useSamples && this.sampler?.isReady) this.sampler.noteOn(midi, velocity)
    else this.synth.noteOn(midi, velocity)
  }

  noteOff(midi: number): void {
    if (this.useSamples && this.sampler?.isReady) this.sampler.noteOff(midi)
    else this.synth.noteOff(midi)
  }

  setSustain(down: boolean): void {
    if (this.useSamples && this.sampler?.isReady) this.sampler.setSustain(down)
    else this.synth.setSustain(down)
  }

  allNotesOff(): void {
    this.sampler?.allNotesOff()
    this.synth.allNotesOff()
  }

  // ---------------------------------------------------------------- levels

  setMasterVolume(value: number): void {
    this.master.gain.setTargetAtTime(clamp01(value), this.context.currentTime, 0.01)
  }

  setMetronomeVolume(value: number): void {
    this.metronomeGain.gain.setTargetAtTime(clamp01(value), this.context.currentTime, 0.01)
  }

  setSampleTailSeconds(seconds: number): void {
    this.sampler?.setTailSeconds(seconds)
  }

  // ----------------------------------------------------------------- clock

  private refreshClockOffset(): void {
    // getOutputTimestamp gives a matched pair of the two clocks, which is more
    // accurate than reading them separately.
    const stamp = this.context.getOutputTimestamp?.()
    if (stamp && stamp.contextTime !== undefined && stamp.performanceTime !== undefined) {
      this.perfToContextOffsetMs = stamp.performanceTime - stamp.contextTime * 1000
    } else {
      this.perfToContextOffsetMs = performance.now() - this.context.currentTime * 1000
    }
  }

  /** Convert a MIDI event timestamp (performance clock) to AudioContext seconds. */
  performanceToContextTime(performanceMs: number): number {
    return (performanceMs - this.perfToContextOffsetMs) / 1000
  }

  /** Convert an AudioContext time to the performance clock, for grading. */
  contextToPerformanceMs(contextSeconds: number): number {
    return contextSeconds * 1000 + this.perfToContextOffsetMs
  }

  dispose(): void {
    if (this.offsetTimer !== null) clearInterval(this.offsetTimer)
    this.offsetTimer = null
    this.metronome.stop()
    this.allNotesOff()
    this.sampler?.dispose()
    void this.context.close()
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
