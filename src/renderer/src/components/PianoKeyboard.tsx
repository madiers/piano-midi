import { useMemo, type CSSProperties } from 'react'
import { noteName, pitchClass, pitchClassName } from '../music/pitch'
import { buildKeyboardGeometry } from './keyGeometry'

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

  // Geometry is shared with the falling-note lane so the two always line up.
  const geometry = useMemo(() => buildKeyboardGeometry(low, high), [low, high])

  const whites = useMemo(
    () => [...geometry.keys.values()].filter((k) => !k.black).sort((a, b) => a.midi - b.midi),
    [geometry]
  )
  const blacks = useMemo(
    () => [...geometry.keys.values()].filter((k) => k.black).sort((a, b) => a.midi - b.midi),
    [geometry]
  )

  if (whites.length === 0) return <div className={className} />

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
        {whites.map(({ midi, width: keyWidth }) => {
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
                // Width comes from the shared geometry, not from flex, so the
                // keys line up with the falling-note lane exactly.
                'relative shrink-0 rounded-b-md border border-ink-600 border-t-0',
                'transition-colors duration-75 flex flex-col justify-end items-center pb-1.5',
                active
                  ? 'bg-brand-500 shadow-inner'
                  : mark
                    ? MARK_WHITE[mark]
                    : outside
                      ? 'bg-ink-300'
                      : 'bg-ink-100 hover:bg-white'
              ].join(' ')}
              style={{ width: `${keyWidth * 100}%` }}
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
        {blacks.map(({ midi, left, width: keyWidth }) => {
          const mark = marks?.get(midi)
          const active = isHeld(midi)
          const outside = !inDeviceRange(midi)
          const finger = fingers?.get(midi)

          const style: CSSProperties = {
            left: `${left * 100}%`,
            width: `${keyWidth * 100}%`,
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
