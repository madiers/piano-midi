import { describe, expect, it } from 'vitest'
import { generatePhrase, makeRng, phraseFitsRange, phraseFromSpec, phraseLengthBeats } from './generator'
import type { PhraseGeneratorSpec } from '@shared/types'

const cPositionRH: PhraseGeneratorSpec = {
  bars: 4,
  timeSignature: [4, 4],
  tempoBpm: 72,
  keySignatureFifths: 0,
  pool: [60, 62, 64, 65, 67], // C position, C4-G4
  hand: 'right',
  durations: [1, 2],
  maxLeap: 2,
  restProbability: 0
}

describe('phrase generator', () => {
  it('is deterministic for a seed', () => {
    const a = generatePhrase(cPositionRH, 1234)
    const b = generatePhrase(cPositionRH, 1234)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('produces different phrases for different seeds', () => {
    const a = generatePhrase(cPositionRH, 1)
    const b = generatePhrase(cPositionRH, 2)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('fills every bar exactly', () => {
    for (const seed of [1, 7, 99, 4242, 31337]) {
      const phrase = generatePhrase(cPositionRH, seed)
      expect(phraseLengthBeats(phrase)).toBe(cPositionRH.bars * cPositionRH.timeSignature[0])
    }
  })

  it('never leaves the note pool, so it stays inside the hand position', () => {
    for (const seed of [3, 17, 512, 90210]) {
      const phrase = generatePhrase(cPositionRH, seed)
      expect(phraseFitsRange(phrase, 60, 67)).toBe(true)
      for (const note of phrase.notes) {
        for (const midi of note.midi) expect(cPositionRH.pool).toContain(midi)
      }
    }
  })

  it('respects the maximum leap so beginners are not asked to jump', () => {
    const spec = { ...cPositionRH, maxLeap: 1 } // steps only
    for (const seed of [5, 55, 555]) {
      const phrase = generatePhrase(spec, seed)
      const melody = phrase.notes.map((n) => n.midi[0]!)
      for (let i = 1; i < melody.length; i++) {
        const stepsApart = Math.abs(
          spec.pool.indexOf(melody[i]!) - spec.pool.indexOf(melody[i - 1]!)
        )
        expect(stepsApart).toBeLessThanOrEqual(1)
      }
    }
  })

  it('generates both hands when asked', () => {
    const phrase = generatePhrase({ ...cPositionRH, hand: 'both', pool: [48, 50, 52, 53, 55, 60, 62, 64, 65, 67] }, 11)
    expect(phrase.notes.some((n) => n.hand === 'left')).toBe(true)
    expect(phrase.notes.some((n) => n.hand === 'right')).toBe(true)
  })

  it('only emits durations that fit the bar', () => {
    const spec = { ...cPositionRH, durations: [1, 2, 4], timeSignature: [3, 4] as [number, number] }
    for (const seed of [2, 22, 222]) {
      const phrase = generatePhrase(spec, seed)
      for (const note of phrase.notes) {
        const barStart = Math.floor(note.startBeats / 3) * 3
        expect(note.startBeats + note.durationBeats).toBeLessThanOrEqual(barStart + 3 + 0.001)
      }
    }
  })
})

describe('authored phrases', () => {
  it('lays hands out on independent timelines', () => {
    const phrase = phraseFromSpec(
      [
        { midi: 60, beats: 1, hand: 'right' },
        { midi: 62, beats: 1, hand: 'right' },
        { midi: [48, 55], beats: 2, hand: 'left' }
      ],
      { tempoBpm: 72 }
    )
    const right = phrase.notes.filter((n) => n.hand === 'right')
    const left = phrase.notes.filter((n) => n.hand === 'left')
    expect(right.map((n) => n.startBeats)).toEqual([0, 1])
    expect(left[0]!.startBeats).toBe(0)
    expect(left[0]!.midi).toEqual([48, 55])
  })
})

describe('rng', () => {
  it('is uniform enough to not bias exercises', () => {
    const rng = makeRng(42)
    const buckets = new Array(10).fill(0)
    for (let i = 0; i < 20000; i++) buckets[Math.floor(rng() * 10)]! += 1
    for (const count of buckets) {
      expect(count).toBeGreaterThan(1500)
      expect(count).toBeLessThan(2500)
    }
  })
})

describe('two-hand generation (regression)', () => {
  const bothHands: PhraseGeneratorSpec = {
    bars: 4,
    timeSignature: [4, 4],
    tempoBpm: 69,
    keySignatureFifths: 0,
    // Left-hand and right-hand C positions together.
    pool: [48, 50, 52, 53, 55, 60, 62, 64, 65, 67],
    hand: 'both',
    durations: [1, 2],
    maxLeap: 2,
    restProbability: 0
  }

  it('keeps each hand in its own register', () => {
    for (const seed of [99, 7, 12345]) {
      const phrase = generatePhrase(bothHands, seed)
      for (const note of phrase.notes) {
        for (const midi of note.midi) {
          if (note.hand === 'left') expect(midi).toBeLessThan(60)
          else expect(midi).toBeGreaterThanOrEqual(60)
        }
      }
    }
  })

  it('never asks both hands for the same key at the same instant', () => {
    // Sharing one pool across hands produced exactly this: two simultaneous
    // events on the same key, which no one can play and which the grader
    // then reported as a missed note.
    for (const seed of [99, 7, 12345, 2024, 5]) {
      const phrase = generatePhrase(bothHands, seed)
      const byOnset = new Map<number, number[]>()
      for (const note of phrase.notes) {
        const at = byOnset.get(note.startBeats) ?? []
        at.push(...note.midi)
        byOnset.set(note.startBeats, at)
      }
      for (const [onset, pitches] of byOnset) {
        expect(new Set(pitches).size, `duplicate pitch at beat ${onset}`).toBe(pitches.length)
      }
    }
  })

  it('respects an explicit hand split', () => {
    const phrase = generatePhrase({ ...bothHands, handSplit: 55 }, 4)
    for (const note of phrase.notes) {
      for (const midi of note.midi) {
        if (note.hand === 'left') expect(midi).toBeLessThan(55)
        else expect(midi).toBeGreaterThanOrEqual(55)
      }
    }
  })
})
