/**
 * Exercise generators.
 *
 * Everything is driven by an explicit seed so a phrase can be reproduced for
 * playback and review. Note the rule the lesson runner must follow: a RETRY of
 * a sight-reading exercise has to resample the seed. Replaying the same phrase
 * turns sight-reading into memorisation, which is the one thing the exercise
 * exists to prevent.
 */

import type { Phrase, PhraseGeneratorSpec, PhraseNote } from '@shared/types'

/**
 * Small deterministic PRNG (mulberry32). Math.random gives no reproducibility,
 * and we need the same seed to yield the same phrase for playback.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!
}

/**
 * Generate a melodic phrase.
 *
 * Two musical constraints keep generated material playable and sensible for a
 * beginner rather than a random note-spray:
 *  - motion is biased toward steps and small skips, bounded by `maxLeap`
 *  - bars are filled exactly, so the notation is well-formed
 */
export function generatePhrase(spec: PhraseGeneratorSpec, seed: number): Phrase {
  const rng = makeRng(seed)
  const beatsPerBar = spec.timeSignature[0]
  const pool = [...spec.pool].sort((a, b) => a - b)
  if (pool.length === 0) throw new Error('generator pool is empty')

  const notes: PhraseNote[] = []
  let counter = 0

  const hands: Array<'left' | 'right'> =
    spec.hand === 'both' ? ['right', 'left'] : [spec.hand]

  /**
   * Each hand draws from its own part of the pool.
   *
   * Sharing one pool across both hands produces material nobody can play: the
   * left hand gets assigned notes from the right hand's register, and — worse —
   * both hands can be given the SAME key at the same instant. The split point
   * defaults to Middle C, which is how the two staves divide the keyboard.
   */
  const split = spec.handSplit ?? 60
  const poolFor = (hand: 'left' | 'right'): number[] => {
    if (spec.hand !== 'both') return pool
    const part = hand === 'left' ? pool.filter((n) => n < split) : pool.filter((n) => n >= split)
    // If a lesson's pool sits entirely on one side of the split, fall back to
    // the whole pool rather than generating nothing.
    return part.length > 0 ? part : pool
  }

  for (const hand of hands) {
    const handPool = poolFor(hand)
    let poolIndex = Math.floor(handPool.length / 2)

    for (let bar = 0; bar < spec.bars; bar++) {
      let remaining = beatsPerBar
      let beat = bar * beatsPerBar

      while (remaining > 0.001) {
        // Only choose a duration that fits in what's left of the bar.
        const options = spec.durations.filter((d) => d <= remaining + 0.001)
        const duration = options.length > 0 ? pick(rng, options) : remaining

        if (rng() < spec.restProbability && remaining - duration > 0.001) {
          beat += duration
          remaining -= duration
          continue
        }

        // Move by a step or small skip rather than jumping anywhere in range.
        const leap = 1 + Math.floor(rng() * spec.maxLeap)
        const direction = rng() < 0.5 ? -1 : 1
        poolIndex = clampIndex(poolIndex + direction * leap, handPool.length)

        const midi: number[] = [handPool[poolIndex]!]

        // Optional harmonic interval on top, for chord-reading exercises.
        if (spec.maxChordSize && spec.maxChordSize > 1 && rng() < 0.3) {
          const extra = clampIndex(poolIndex + 2, handPool.length)
          if (extra !== poolIndex) midi.push(handPool[extra]!)
        }

        notes.push({
          id: `n${counter++}`,
          midi: midi.sort((a, b) => a - b),
          startBeats: beat,
          durationBeats: duration,
          hand
        })

        beat += duration
        remaining -= duration
      }
    }
  }

  return {
    timeSignature: spec.timeSignature,
    keySignatureFifths: spec.keySignatureFifths,
    tempoBpm: spec.tempoBpm,
    bars: spec.bars,
    notes: notes.sort((a, b) => a.startBeats - b.startBeats),
    gradedHands: spec.hand === 'both' ? 'both' : spec.hand === 'left' ? 'left' : 'right'
  }
}

function clampIndex(index: number, length: number): number {
  if (index < 0) return Math.min(length - 1, -index)
  if (index >= length) return Math.max(0, length - 1 - (index - length + 1))
  return index
}

/**
 * Rhythm-only phrase: a single repeated pitch, so the student can tap the
 * rhythm on any key without pitch getting in the way.
 */
export function generateRhythm(spec: PhraseGeneratorSpec, seed: number): Phrase {
  const pitch = spec.pool[Math.floor(spec.pool.length / 2)] ?? 60
  const phrase = generatePhrase({ ...spec, maxLeap: 1, maxChordSize: 1 }, seed)
  return {
    ...phrase,
    notes: phrase.notes.map((n) => ({ ...n, midi: [pitch] }))
  }
}

/** Turn a list of MIDI notes into an even, playable phrase — used for scales. */
export function phraseFromNotes(
  midiNotes: number[],
  options: {
    tempoBpm: number
    hand: 'left' | 'right'
    durationBeats?: number
    timeSignature?: [number, number]
    keySignatureFifths?: number
    fingers?: number[]
  }
): Phrase {
  const duration = options.durationBeats ?? 1
  const timeSignature = options.timeSignature ?? [4, 4]
  const notes: PhraseNote[] = midiNotes.map((midi, index) => ({
    id: `n${index}`,
    midi: [midi],
    startBeats: index * duration,
    durationBeats: duration,
    hand: options.hand,
    fingers: options.fingers ? [options.fingers[index] ?? 0] : undefined
  }))

  const totalBeats = midiNotes.length * duration
  return {
    timeSignature,
    keySignatureFifths: options.keySignatureFifths ?? 0,
    tempoBpm: options.tempoBpm,
    bars: Math.max(1, Math.ceil(totalBeats / timeSignature[0])),
    notes,
    gradedHands: options.hand
  }
}

/** Build a phrase from explicit note names, for authored lesson pieces. */
export function phraseFromSpec(
  spec: Array<{
    midi: number | number[]
    beats: number
    hand?: 'left' | 'right'
    fingers?: number[]
  }>,
  options: {
    tempoBpm: number
    timeSignature?: [number, number]
    keySignatureFifths?: number
    gradedHands?: Phrase['gradedHands']
  }
): Phrase {
  const timeSignature = options.timeSignature ?? [4, 4]
  const cursor = { right: 0, left: 0 }
  const notes: PhraseNote[] = []

  spec.forEach((entry, index) => {
    const hand = entry.hand ?? 'right'
    notes.push({
      id: `n${index}`,
      midi: Array.isArray(entry.midi) ? [...entry.midi].sort((a, b) => a - b) : [entry.midi],
      startBeats: cursor[hand],
      durationBeats: entry.beats,
      hand,
      fingers: entry.fingers
    })
    cursor[hand] += entry.beats
  })

  const totalBeats = Math.max(cursor.right, cursor.left)
  return {
    timeSignature,
    keySignatureFifths: options.keySignatureFifths ?? 0,
    tempoBpm: options.tempoBpm,
    bars: Math.max(1, Math.ceil(totalBeats / timeSignature[0])),
    notes: notes.sort((a, b) => a.startBeats - b.startBeats),
    gradedHands: options.gradedHands ?? 'both'
  }
}

/** Total length of a phrase in beats. */
export function phraseLengthBeats(phrase: Phrase): number {
  return phrase.notes.reduce((max, n) => Math.max(max, n.startBeats + n.durationBeats), 0)
}

/** Does every note fit inside the playable range? */
export function phraseFitsRange(phrase: Phrase, low: number, high: number): boolean {
  return phrase.notes.every((n) => n.midi.every((m) => m >= low && m <= high))
}
