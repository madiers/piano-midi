/**
 * Sample-based piano voice.
 *
 * The samples are Salamander Grand Piano V3 (Alexander Holm, CC BY 3.0),
 * recorded every minor third from A0 to C8. Notes in between are produced by
 * pitch-shifting the nearest recording, which over a maximum of one semitone
 * is inaudible for our purposes.
 *
 * Two things drove the design:
 *
 *  1. MEMORY. Salamander's bass samples run 20-26 seconds. Decoded to Float32
 *     stereo at 44.1 kHz, the full 30-sample set is roughly 140 MB resident.
 *     We truncate each buffer to a few seconds on decode with a short fade,
 *     which is inaudible for beginner exercises (no sustain pedal on a 25-key
 *     controller anyway) and cuts that by about 60%.
 *
 *  2. LATENCY. Every voice is a plain AudioBufferSourceNode started at
 *     `currentTime`, with an AudioContext created at latencyHint 'interactive'.
 *     There is no scheduling layer between a key press and `start()`.
 */

import type { AudioManifest } from '@shared/ipc'

export interface SamplerLoadProgress {
  loaded: number
  total: number
}

interface LoadedSample {
  midi: number
  buffer: AudioBuffer
}

interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
  note: number
  startedAt: number
}

export interface PianoSamplerOptions {
  /** Seconds of each sample to keep. See the memory note above. */
  tailSeconds?: number
  /** Release time in seconds when a key is let go. */
  releaseSeconds?: number
}

export class PianoSampler {
  private readonly context: AudioContext
  private readonly master: GainNode
  private samples: LoadedSample[] = []
  /** Sounding voices, keyed by MIDI note. A note can be retriggered while held. */
  private readonly voices = new Map<number, Voice[]>()
  /** Notes released while the sustain pedal is down, waiting for pedal-up. */
  private readonly sustained = new Set<number>()
  private sustainDown = false

  private tailSeconds: number
  private releaseSeconds: number
  private ready = false

  constructor(context: AudioContext, master: GainNode, options: PianoSamplerOptions = {}) {
    this.context = context
    this.master = master
    this.tailSeconds = options.tailSeconds ?? 6
    this.releaseSeconds = options.releaseSeconds ?? 0.35
  }

  get isReady(): boolean {
    return this.ready
  }

  get sampleCount(): number {
    return this.samples.length
  }

  /** Approximate resident size of the decoded samples, in bytes. */
  get memoryBytes(): number {
    return this.samples.reduce(
      (sum, s) => sum + s.buffer.length * s.buffer.numberOfChannels * 4,
      0
    )
  }

  /**
   * Fetch and decode every sample in the first velocity layer.
   * Samples that fail to load are skipped rather than failing the whole load —
   * a piano missing one recording still plays, using a neighbour.
   */
  async load(
    manifest: AudioManifest,
    baseUrl: string,
    onProgress?: (progress: SamplerLoadProgress) => void
  ): Promise<void> {
    const layer = manifest.layers[0]
    if (!layer) throw new Error('audio manifest contains no velocity layers')

    const total = layer.samples.length
    let loaded = 0
    const out: LoadedSample[] = []

    // Decode a few at a time: all 30 at once briefly holds every untrimmed
    // buffer in memory simultaneously, which is exactly what we are avoiding.
    const CONCURRENCY = 4
    const queue = [...layer.samples]

    const worker = async (): Promise<void> => {
      for (;;) {
        const entry = queue.shift()
        if (!entry) return
        try {
          const url = `${baseUrl}${layer.dir}/${encodeURIComponent(entry.file)}`
          const response = await fetch(url)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const encoded = await response.arrayBuffer()
          const decoded = await this.context.decodeAudioData(encoded)
          out.push({ midi: entry.midi, buffer: this.trim(decoded) })
        } catch (err) {
          console.warn(`[audio] failed to load ${entry.file}:`, err)
        } finally {
          loaded += 1
          onProgress?.({ loaded, total })
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    out.sort((a, b) => a.midi - b.midi)
    this.samples = out
    this.ready = out.length > 0
    if (!this.ready) throw new Error('no piano samples could be decoded')
  }

  /**
   * Shorten a decoded buffer and fade the last 150 ms so the truncation is not
   * an audible click.
   */
  private trim(buffer: AudioBuffer): AudioBuffer {
    const maxLength = Math.floor(this.tailSeconds * buffer.sampleRate)
    if (buffer.length <= maxLength) return buffer

    const fadeSamples = Math.min(Math.floor(0.15 * buffer.sampleRate), maxLength)
    const trimmed = this.context.createBuffer(
      buffer.numberOfChannels,
      maxLength,
      buffer.sampleRate
    )

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const source = buffer.getChannelData(channel)
      const target = trimmed.getChannelData(channel)
      target.set(source.subarray(0, maxLength))
      for (let i = 0; i < fadeSamples; i++) {
        const index = maxLength - fadeSamples + i
        target[index] = (target[index] ?? 0) * (1 - i / fadeSamples)
      }
    }
    return trimmed
  }

  private nearestSample(midi: number): LoadedSample | null {
    if (this.samples.length === 0) return null
    let best = this.samples[0]!
    let bestDistance = Math.abs(best.midi - midi)
    for (const sample of this.samples) {
      const distance = Math.abs(sample.midi - midi)
      if (distance < bestDistance) {
        best = sample
        bestDistance = distance
      }
    }
    return best
  }

  /**
   * Start a note.
   * `velocity` is the raw MIDI 1-127 value; we map it to gain on a curve
   * rather than linearly, because linear velocity feels dead at the quiet end.
   */
  noteOn(midi: number, velocity = 80, when = 0): void {
    if (!this.ready) return

    const sample = this.nearestSample(midi)
    if (!sample) return

    const time = when || this.context.currentTime

    const source = this.context.createBufferSource()
    source.buffer = sample.buffer
    source.playbackRate.value = Math.pow(2, (midi - sample.midi) / 12)

    const gain = this.context.createGain()
    // velocity^1.6 approximates the perceived loudness curve of a real action.
    const normalized = Math.max(1, Math.min(127, velocity)) / 127
    gain.gain.value = Math.pow(normalized, 1.6)

    source.connect(gain)
    gain.connect(this.master)
    source.start(time)

    const voice: Voice = { source, gain, note: midi, startedAt: time }
    const existing = this.voices.get(midi)
    if (existing) existing.push(voice)
    else this.voices.set(midi, [voice])

    source.onended = () => {
      const list = this.voices.get(midi)
      if (!list) return
      const index = list.indexOf(voice)
      if (index >= 0) list.splice(index, 1)
      if (list.length === 0) this.voices.delete(midi)
    }
  }

  /** Release a note, honouring the sustain pedal. */
  noteOff(midi: number): void {
    if (this.sustainDown) {
      this.sustained.add(midi)
      return
    }
    this.releaseNow(midi)
  }

  private releaseNow(midi: number): void {
    const voices = this.voices.get(midi)
    if (!voices) return
    const now = this.context.currentTime
    for (const voice of voices) {
      try {
        voice.gain.gain.cancelScheduledValues(now)
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now)
        // Exponential decay sounds like a damper; linear sounds like a gate.
        voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + this.releaseSeconds)
        voice.source.stop(now + this.releaseSeconds + 0.02)
      } catch {
        // Already stopped — nothing to do.
      }
    }
  }

  setSustain(down: boolean): void {
    this.sustainDown = down
    if (!down) {
      for (const midi of this.sustained) this.releaseNow(midi)
      this.sustained.clear()
    }
  }

  /** Stop everything immediately — used when leaving a lesson. */
  allNotesOff(): void {
    this.sustainDown = false
    this.sustained.clear()
    for (const midi of [...this.voices.keys()]) this.releaseNow(midi)
  }

  setTailSeconds(seconds: number): void {
    this.tailSeconds = seconds
  }

  dispose(): void {
    this.allNotesOff()
    this.samples = []
    this.ready = false
  }
}
