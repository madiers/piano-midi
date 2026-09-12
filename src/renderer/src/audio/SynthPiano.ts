/**
 * Oscillator fallback voice.
 *
 * This exists so the app is never silent: if the sample pack is missing (a
 * fresh clone where `npm run assets` hasn't run) or a sample fails to decode,
 * pressing a key still produces a pitched tone. It is a safety net, not an
 * instrument the user is meant to choose for its sound.
 */

interface SynthVoice {
  oscillators: OscillatorNode[]
  gain: GainNode
}

export class SynthPiano {
  private readonly voices = new Map<number, SynthVoice[]>()
  private readonly sustained = new Set<number>()
  private sustainDown = false

  constructor(
    private readonly context: AudioContext,
    private readonly master: GainNode
  ) {}

  private frequency(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12)
  }

  noteOn(midi: number, velocity = 80): void {
    const now = this.context.currentTime
    const frequency = this.frequency(midi)
    const amplitude = Math.pow(Math.max(1, Math.min(127, velocity)) / 127, 1.6) * 0.3

    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(amplitude, now + 0.005)
    // A piano-ish decay: fast initial drop, long tail.
    gain.gain.exponentialRampToValueAtTime(Math.max(amplitude * 0.3, 0.0001), now + 0.4)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 4)
    gain.connect(this.master)

    // Fundamental plus a quiet octave gives it a little more body than a
    // bare triangle wave.
    const oscillators: OscillatorNode[] = []
    for (const [type, ratio, level] of [
      ['triangle', 1, 1],
      ['sine', 2, 0.25]
    ] as Array<[OscillatorType, number, number]>) {
      const osc = this.context.createOscillator()
      osc.type = type
      osc.frequency.value = frequency * ratio

      const partialGain = this.context.createGain()
      partialGain.gain.value = level
      osc.connect(partialGain)
      partialGain.connect(gain)

      osc.start(now)
      osc.stop(now + 4.2)
      oscillators.push(osc)
    }

    const voice: SynthVoice = { oscillators, gain }
    const existing = this.voices.get(midi)
    if (existing) existing.push(voice)
    else this.voices.set(midi, [voice])

    oscillators[0]!.onended = () => {
      const list = this.voices.get(midi)
      if (!list) return
      const index = list.indexOf(voice)
      if (index >= 0) list.splice(index, 1)
      if (list.length === 0) this.voices.delete(midi)
    }
  }

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
        voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now)
        voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
        for (const osc of voice.oscillators) osc.stop(now + 0.32)
      } catch {
        // already stopped
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

  allNotesOff(): void {
    this.sustainDown = false
    this.sustained.clear()
    for (const midi of [...this.voices.keys()]) this.releaseNow(midi)
  }
}
