import { useMemo } from 'react'
import type { Phrase } from '@shared/types'
import type { NoteOutcome } from '../lessons/grading'

export interface PreStaffViewProps {
  phrase: Phrase
  outcomes?: Map<string, NoteOutcome>
  currentNoteId?: string | null
  className?: string
}

const OUTCOME_STYLE: Record<NoteOutcome, string> = {
  perfect: 'border-good-500 bg-good-500/20 text-good-500',
  good: 'border-good-500 bg-good-500/20 text-good-500',
  ok: 'border-warn-500 bg-warn-500/20 text-warn-500',
  'wrong-pitch': 'border-bad-500 bg-bad-500/20 text-bad-500',
  missed: 'border-ink-600 bg-ink-800 text-ink-500',
  extra: 'border-bad-500 bg-bad-500/20 text-bad-500'
}

/**
 * Pre-staff notation: finger numbers in sequence, no staff.
 *
 * Units 3 and 4 deliberately come before the staff is introduced — the student
 * builds five-finger control with zero notation load, which is how every
 * mainstream method sequences it. Rendering a staff there teaches the student
 * to ignore something they cannot yet read, and one of those lessons literally
 * promises "no staff yet".
 *
 * Duration is shown by the width of each card plus a note-value glyph, so
 * rhythm is still visible without requiring staff reading.
 */
export function PreStaffView({
  phrase,
  outcomes,
  currentNoteId,
  className = ''
}: PreStaffViewProps): React.JSX.Element {
  /**
   * Finger numbers for a five-finger position, derived from the phrase itself:
   * the lowest note is the right hand's thumb, or the left hand's little
   * finger. The hands mirror, so the numbering runs opposite ways.
   */
  const fingerFor = useMemo(() => {
    const byHand = new Map<'left' | 'right', number[]>()
    for (const note of phrase.notes) {
      const list = byHand.get(note.hand) ?? []
      for (const midi of note.midi) if (!list.includes(midi)) list.push(midi)
      byHand.set(note.hand, list)
    }
    for (const list of byHand.values()) list.sort((a, b) => a - b)

    return (hand: 'left' | 'right', midi: number): number | null => {
      const list = byHand.get(hand)
      if (!list) return null
      const index = list.indexOf(midi)
      if (index < 0 || list.length > 5) return null
      return hand === 'right' ? index + 1 : list.length - index
    }
  }, [phrase])

  const hands: Array<'right' | 'left'> = []
  if (phrase.notes.some((n) => n.hand === 'right')) hands.push('right')
  if (phrase.notes.some((n) => n.hand === 'left')) hands.push('left')

  const beatsPerBar = phrase.timeSignature[0]

  return (
    <div className={className}>
      {hands.map((hand) => {
        const notes = phrase.notes
          .filter((n) => n.hand === hand)
          .sort((a, b) => a.startBeats - b.startBeats)

        return (
          <div key={hand} className="mb-4 last:mb-0">
            {hands.length > 1 && (
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-400">
                {hand === 'right' ? 'Right hand' : 'Left hand'}
              </p>
            )}
            <div className="flex flex-wrap items-stretch gap-1.5">
              {notes.map((note, index) => {
                const previous = notes[index - 1]
                // A visible gap where a new bar starts, so the pulse is legible.
                const newBar =
                  previous !== undefined &&
                  Math.floor(note.startBeats / beatsPerBar) >
                    Math.floor(previous.startBeats / beatsPerBar)

                const finger = fingerFor(hand, note.midi[0]!)
                const outcome = outcomes?.get(note.id)
                const isCurrent = note.id === currentNoteId

                return (
                  <div key={note.id} className="flex items-stretch">
                    {newBar && <span className="mr-1.5 w-px self-stretch bg-ink-600" />}
                    <div
                      className={[
                        'flex flex-col items-center justify-center rounded-lg border-2 py-3',
                        'transition-colors duration-100',
                        isCurrent
                          ? 'border-brand-400 bg-brand-500/25 text-brand-400'
                          : outcome
                            ? OUTCOME_STYLE[outcome]
                            : 'border-ink-600 bg-ink-800 text-ink-100'
                      ].join(' ')}
                      // Width tracks duration so a half note plainly lasts
                      // twice as long as a quarter.
                      style={{ width: 34 + note.durationBeats * 22 }}
                    >
                      <span className="text-2xl font-bold leading-none">
                        {finger ?? note.midi.length}
                      </span>
                      <span className="mt-1.5 opacity-80">
                        <DurationGlyph beats={note.durationBeats} />
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="mt-3 text-xs text-ink-500">
        Finger numbers, left to right. Wider means hold it longer. No staff yet — that arrives in
        Unit 5.
      </p>
    </div>
  )
}

/**
 * A note-value glyph, drawn rather than typed.
 *
 * The Unicode musical symbols for half and whole notes (U+1D15D/U+1D15E) live
 * in a plane most system fonts do not cover, so they render as tofu boxes. A
 * few SVG primitives always draw.
 */
function DurationGlyph({ beats }: { beats: number }): React.JSX.Element {
  const hollow = beats >= 2
  const stem = beats < 4
  const dotted = beats === 3 || beats === 1.5
  const flag = beats < 1

  return (
    <svg width="18" height="20" viewBox="0 0 18 20" aria-label={`${beats} beat note`} role="img">
      <ellipse
        cx="6"
        cy="14"
        rx="4.6"
        ry="3.4"
        transform="rotate(-20 6 14)"
        fill={hollow ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {stem && <line x1="10.4" y1="13" x2="10.4" y2="2" stroke="currentColor" strokeWidth="1.5" />}
      {flag && (
        <path
          d="M10.4 2 q4 2 3 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
      {dotted && <circle cx="14.5" cy="14" r="1.3" fill="currentColor" />}
    </svg>
  )
}
