import { useEffect, useRef } from 'react'
import type { Phrase } from '@shared/types'
import { buildKeyboardGeometry } from './keyGeometry'
import type { NoteOutcome } from '../lessons/grading'

export interface FallingNotesProps {
  phrase: Phrase
  low: number
  high: number
  /**
   * Returns the current playback position in beats. Read every frame rather
   * than passed as a prop, so the animation never re-renders React.
   */
  getPositionBeats: () => number
  outcomes?: Map<string, NoteOutcome>
  /** Beats visible above the keyboard at once — the "lookahead" height. */
  windowBeats?: number
  height?: number
  className?: string
}

const HAND_COLORS = {
  right: { fill: '#38bdf8', edge: '#7dd3fc' },
  left: { fill: '#a78bfa', edge: '#c4b5fd' }
}

const OUTCOME_COLORS: Partial<Record<NoteOutcome, { fill: string; edge: string }>> = {
  perfect: { fill: '#34d399', edge: '#6ee7b7' },
  good: { fill: '#34d399', edge: '#6ee7b7' },
  ok: { fill: '#fbbf24', edge: '#fcd34d' },
  'wrong-pitch': { fill: '#f87171', edge: '#fca5a5' },
  missed: { fill: '#3d4858', edge: '#5a6678' }
}

/**
 * Synthesia-style falling notes.
 *
 * Drawn on a canvas from an animation loop that reads the transport clock
 * directly. It deliberately does not take the playhead as a React prop: doing
 * so would re-render the tree sixty times a second, and the same main thread is
 * handling incoming MIDI.
 *
 * This view is a practice aid, never the only way a piece is played. A student
 * who only ever watches falling bars finishes a course unable to read music —
 * the well-known failure mode of the big commercial apps — so every reading
 * lesson also has a staff-only pass.
 */
export function FallingNotes({
  phrase,
  low,
  high,
  getPositionBeats,
  outcomes,
  windowBeats = 8,
  height = 260,
  className = ''
}: FallingNotesProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const outcomesRef = useRef(outcomes)
  outcomesRef.current = outcomes

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const geometry = buildKeyboardGeometry(low, high)
    let width = 0
    let displayHeight = 0

    const resize = (): void => {
      const ratio = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      displayHeight = rect.height
      canvas.width = Math.round(rect.width * ratio)
      canvas.height = Math.round(rect.height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const draw = (): void => {
      frameRef.current = requestAnimationFrame(draw)
      if (width === 0) return

      const position = getPositionBeats()
      context.clearRect(0, 0, width, displayHeight)

      // Guide lines on each C, so the eye has something to anchor to.
      context.strokeStyle = 'rgba(255,255,255,0.06)'
      context.lineWidth = 1
      for (let midi = low; midi <= high; midi++) {
        if (midi % 12 !== 0) continue
        const rect = geometry.keys.get(midi)
        if (!rect) continue
        const x = Math.round(rect.left * width) + 0.5
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, displayHeight)
        context.stroke()
      }

      // The hit line: where a note must be played.
      context.strokeStyle = 'rgba(56,189,248,0.55)'
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(0, displayHeight - 1)
      context.lineTo(width, displayHeight - 1)
      context.stroke()

      const pixelsPerBeat = displayHeight / windowBeats

      for (const note of phrase.notes) {
        // Distance in beats from now until this note must be played.
        const untilHit = note.startBeats - position
        if (untilHit > windowBeats) continue
        if (untilHit + note.durationBeats < -0.5) continue

        const noteHeight = Math.max(6, note.durationBeats * pixelsPerBeat - 3)
        const bottom = displayHeight - untilHit * pixelsPerBeat
        const top = bottom - noteHeight

        const outcome = outcomesRef.current?.get(note.id)
        const palette =
          (outcome && OUTCOME_COLORS[outcome]) ??
          HAND_COLORS[note.hand] ??
          HAND_COLORS.right

        for (const midi of note.midi) {
          const rect = geometry.keys.get(midi)
          if (!rect) continue

          const x = rect.left * width + 2
          const w = Math.max(4, rect.width * width - 4)

          context.fillStyle = palette.fill
          context.strokeStyle = palette.edge
          context.lineWidth = 1.5
          roundedRect(context, x, top, w, noteHeight, 4)
          context.fill()
          context.stroke()
        }
      }
    }

    frameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frameRef.current)
      observer.disconnect()
    }
  }, [phrase, low, high, getPositionBeats, windowBeats])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height }}
      aria-label="Falling notes"
    />
  )
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}
