/**
 * Shared keyboard geometry.
 *
 * The falling-note lane and the on-screen keyboard MUST compute key positions
 * from this one module. If they each do their own layout maths, the bars drift
 * out of alignment with the keys they point at — subtly, and permanently.
 */

import { isBlackKey, pitchClass } from '../music/pitch'

/** Horizontal nudge for each black key, as a fraction of a white key's width. */
const BLACK_KEY_OFFSET: Record<number, number> = {
  1: -0.18,
  3: 0.18,
  6: -0.22,
  8: 0,
  10: 0.22
}

export interface KeyRect {
  midi: number
  /** Left edge, as a fraction 0..1 of the keyboard width. */
  left: number
  /** Width, as a fraction of the keyboard width. */
  width: number
  black: boolean
}

export interface KeyboardGeometry {
  low: number
  high: number
  whiteCount: number
  keys: Map<number, KeyRect>
  /** Centre of a key as a fraction 0..1, or null if out of range. */
  centreOf(midi: number): number | null
}

export function buildKeyboardGeometry(low: number, high: number): KeyboardGeometry {
  const whites: number[] = []
  const blacks: Array<{ midi: number; whiteIndexBefore: number }> = []

  for (let midi = low; midi <= high; midi++) {
    if (isBlackKey(midi)) blacks.push({ midi, whiteIndexBefore: whites.length - 1 })
    else whites.push(midi)
  }

  const whiteCount = Math.max(1, whites.length)
  const whiteWidth = 1 / whiteCount
  const blackWidth = whiteWidth * 0.62

  const keys = new Map<number, KeyRect>()

  whites.forEach((midi, index) => {
    keys.set(midi, { midi, left: index * whiteWidth, width: whiteWidth, black: false })
  })

  for (const { midi, whiteIndexBefore } of blacks) {
    const offset = BLACK_KEY_OFFSET[pitchClass(midi)] ?? 0
    const boundary = (whiteIndexBefore + 1) * whiteWidth
    keys.set(midi, {
      midi,
      left: boundary - blackWidth / 2 + offset * whiteWidth,
      width: blackWidth,
      black: true
    })
  }

  return {
    low,
    high,
    whiteCount,
    keys,
    centreOf(midi: number): number | null {
      const rect = keys.get(midi)
      return rect ? rect.left + rect.width / 2 : null
    }
  }
}
