import { useMemo, type CSSProperties } from 'react'
import { isBlackKey, noteName, pitchClass, pitchClassName } from '../music/pitch'

export type KeyMark = 'target' | 'correct' | 'wrong' | 'hint' | 'ghost'

export interface PianoKeyboardProps {
  /** Inclusive MIDI range to draw. */
  low: number
  high: number
  /** Notes currently held, mapped to velocity. */
  held?: Map<number, number> | Set<number>
  /** Pedagogical highlights, e.g. "play this note next". */
  marks?: Map<number, KeyMark>
  /** Show the note name on every white key. */
  showNames?: boolean
  /** Show names only on C keys — the usual orientation aid. */
  showCNames?: boolean
  /** Finger numbers to print on specific keys. */
  fingers?: Map<number, number>
  onKeyDown?: (midi: number) => void
  onKeyUp?: (midi: number) => void
  /** Keys outside the connected device's range are dimmed. */
  deviceRange?: [number, number] | null
  height?: number
  className?: string
}

const MARK_WHITE: Record<KeyMark, string> = {
  target: 'bg-brand-400',
  correct: 'bg-good-500',
  wrong: 'bg-bad-500',
  hint: 'bg-warn-500',
  ghost: 'bg-ink-400'
}

const MARK_BLACK: Record<KeyMark, string> = {
  target: 'bg-brand-600',
  correct: 'bg-good-500',
  wrong: 'bg-bad-500',
  hint: 'bg-warn-500',
  ghost: 'bg-ink-500'
}

/**
 * How far a black key sits from the boundary between its neighbouring white
 * keys, as a fraction of a white key's width. Real pianos don't centre black
 * keys on the gap — C# sits left of centre, D# right — and copying that makes
 * the keyboard read correctly at a glance.
 */
const BLACK_KEY_OFFSET: Record<number, number> = {
  1: -0.18, // C#
  3: 0.18, // D#
  6: -0.22, // F#
  8: 0, // G#
  10: 0.22 // A#
}

export function PianoKeyboard({
  low,
  high,
  held,
  marks,
  showNames = false,
  showCNames = true,
  fingers,
  onKeyDown,
  onKeyUp,
  deviceRange = null,
  height = 150,
  className = ''
}: PianoKeyboardProps): React.JSX.Element {
  const isHeld = (midi: number): boolean =>
    held instanceof Set ? held.has(midi) : Boolean(held?.has(midi))

  const { whites, blacks, whiteCount } = useMemo(() => {
    const whiteKeys: number[] = []
    const blackKeys: Array<{ midi: number; whiteIndexBefore: number }> = []

    for (let midi = low; midi <= high; midi++) {
      if (isBlackKey(midi)) {
        blackKeys.push({ midi, whiteIndexBefore: whiteKeys.length - 1 })
      } else {
        whiteKeys.push(midi)
      }
    }
    return { whites: whiteKeys, blacks: blackKeys, whiteCount: whiteKeys.length }
  }, [low, high])

  if (whiteCount === 0) return <div className={className} />

  const whiteWidthPct = 100 / whiteCount
  const blackWidthPct = whiteWidthPct * 0.62
  const blackHeight = Math.round(height * 0.62)

  const inDeviceRange = (midi: number): boolean =>
    !deviceRange || (midi >= deviceRange[0] && midi <= deviceRange[1])

  return (
    <div
      className={`relative select-none-app ${className}`}
      style={{ height }}
      role="group"
      aria-label="Piano keyboard"
    >
      {/* White keys */}
      <div className="absolute inset-0 flex">
        {whites.map((midi) => {
          const mark = marks?.get(midi)
          const active = isHeld(midi)
          const outside = !inDeviceRange(midi)
          const isC = pitchClass(midi) === 0
          const finger = fingers?.get(midi)

          return (
            <button
              key={midi}
              type="button"
              tabIndex={-1}
              aria-label={noteName(midi)}
              onPointerDown={(e) => {
                e.preventDefault()
                onKeyDown?.(midi)
              }}
              onPointerUp={() => onKeyUp?.(midi)}
              onPointerLeave={(e) => {
                if (e.buttons > 0) onKeyUp?.(midi)
              }}
              className={[
                'relative flex-1 rounded-b-md border border-ink-600 border-t-0',
                'transition-colors duration-75 flex flex-col justify-end items-center pb-1.5',
                active
                  ? 'bg-brand-500 shadow-inner'
                  : mark
                    ? MARK_WHITE[mark]
                    : outside
                      ? 'bg-ink-300'
                      : 'bg-ink-100 hover:bg-white'
              ].join(' ')}
              style={{ width: `${whiteWidthPct}%` }}
            >
              {finger !== undefined && (
                <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-ink-100">
                  {finger}
                </span>
              )}
              {(showNames || (showCNames && isC)) && (
                <span
                  className={`text-[10px] font-semibold ${
                    active || mark ? 'text-ink-900' : 'text-ink-500'
                  }`}
                >
                  {showNames ? pitchClassName(midi) : noteName(midi)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Black keys, drawn on top */}
      <div className="pointer-events-none absolute inset-0">
        {blacks.map(({ midi, whiteIndexBefore }) => {
          const mark = marks?.get(midi)
          const active = isHeld(midi)
          const outside = !inDeviceRange(midi)
          const finger = fingers?.get(midi)

          // Position: the boundary after the preceding white key, nudged by the
          // per-note offset, then centred on the black key's own width.
          const offset = BLACK_KEY_OFFSET[pitchClass(midi)] ?? 0
          const boundaryPct = (whiteIndexBefore + 1) * whiteWidthPct
          const leftPct = boundaryPct - blackWidthPct / 2 + offset * whiteWidthPct

          const style: CSSProperties = {
            left: `${leftPct}%`,
            width: `${blackWidthPct}%`,
            height: blackHeight
          }

          return (
            <button
              key={midi}
              type="button"
              tabIndex={-1}
              aria-label={noteName(midi)}
              onPointerDown={(e) => {
                e.preventDefault()
                onKeyDown?.(midi)
              }}
              onPointerUp={() => onKeyUp?.(midi)}
              onPointerLeave={(e) => {
                if (e.buttons > 0) onKeyUp?.(midi)
              }}
              className={[
                'pointer-events-auto absolute top-0 rounded-b-md border border-ink-950',
                'transition-colors duration-75 flex flex-col justify-end items-center pb-1',
                active
                  ? 'bg-brand-600'
                  : mark
                    ? MARK_BLACK[mark]
                    : outside
                      ? 'bg-ink-600'
                      : 'bg-ink-950 hover:bg-ink-800'
              ].join(' ')}
              style={style}
            >
              {finger !== undefined && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink-100 text-[10px] font-bold text-ink-900">
                  {finger}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
