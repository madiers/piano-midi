import { useEffect, useRef } from 'react'
import {
  Accidental,
  Beam,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice
} from 'vexflow'
import type { Phrase, PhraseNote } from '@shared/types'
import { keySignature, spellInKey } from '../music/scales'
import type { NoteOutcome } from '../lessons/grading'

export interface StaffViewProps {
  phrase: Phrase
  /** Per-note colouring as the student plays. */
  outcomes?: Map<string, NoteOutcome>
  /** The note the student should play next, drawn highlighted. */
  currentNoteId?: string | null
  showFingers?: boolean
  width?: number
  className?: string
}

const OUTCOME_COLORS: Record<NoteOutcome, string> = {
  perfect: '#34d399',
  good: '#34d399',
  ok: '#fbbf24',
  'wrong-pitch': '#f87171',
  missed: '#5a6678',
  extra: '#f87171'
}

// The staff is drawn on a light background, so notes must be DARK. Using the
// app's light foreground colour here renders near-white notes on a near-white
// stave — invisible, and not obvious from the code alone.
const INK = '#12171f'
const HIGHLIGHT = '#0284c7'

/**
 * Renders a phrase as grand-staff notation with VexFlow.
 *
 * VexFlow 4 is used deliberately rather than 5: v4 embeds its music glyphs as
 * SVG outline paths, so notation draws with no webfont and no network access.
 * VexFlow 5 loads glyphs through the FontFace API and defaults its font host to
 * a CDN, which in a packaged offline app under CSP means blank staves.
 */
export function StaffView({
  phrase,
  outcomes,
  currentNoteId,
  showFingers = false,
  width = 720,
  className = ''
}: StaffViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''

    const key = keySignature(phrase.keySignatureFifths)
    const hasLeft = phrase.notes.some((n) => n.hand === 'left')
    const hasRight = phrase.notes.some((n) => n.hand === 'right')
    const grand = hasLeft && hasRight

    const beatsPerBar = phrase.timeSignature[0]
    const bars = Math.max(1, phrase.bars)

    // Wrap bars onto successive systems rather than running off the right edge.
    // Real sheet music does this, and a 16-bar piece on one scrolling line is
    // unreadable — the student cannot see where the phrase is going.
    const LEFT_PAD = 20
    const RIGHT_PAD = 20
    const MIN_BAR_WIDTH = 150
    const usable = width - LEFT_PAD - RIGHT_PAD
    const barsPerSystem = Math.max(1, Math.min(bars, Math.floor(usable / MIN_BAR_WIDTH)))
    const systemCount = Math.ceil(bars / barsPerSystem)
    const barWidth = usable / barsPerSystem

    const systemHeight = grand ? 240 : 130
    const height = systemCount * systemHeight + 30

    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(width, height)
    const context = renderer.getContext()
    context.setFont('sans-serif', 10)

    const treble: Stave[] = []
    const bass: Stave[] = []

    for (let bar = 0; bar < bars; bar++) {
      const system = Math.floor(bar / barsPerSystem)
      const column = bar % barsPerSystem
      // Clef, time and key signature repeat at the start of every system,
      // which is what makes a wrapped line readable.
      const isSystemStart = column === 0

      const x = LEFT_PAD + column * barWidth
      const y = 20 + system * systemHeight

      const upper = new Stave(x, y, barWidth)
      if (isSystemStart) {
        upper.addClef('treble')
        if (phrase.keySignatureFifths !== 0) upper.addKeySignature(key.tonic)
        if (system === 0) {
          upper.addTimeSignature(`${phrase.timeSignature[0]}/${phrase.timeSignature[1]}`)
        }
      }
      upper.setContext(context).draw()
      treble.push(upper)

      if (grand) {
        const lower = new Stave(x, y + 110, barWidth)
        if (isSystemStart) {
          lower.addClef('bass')
          if (phrase.keySignatureFifths !== 0) lower.addKeySignature(key.tonic)
          if (system === 0) {
            lower.addTimeSignature(`${phrase.timeSignature[0]}/${phrase.timeSignature[1]}`)
          }
        }
        lower.setContext(context).draw()
        bass.push(lower)

        if (isSystemStart) {
          new StaveConnector(upper, lower).setType('brace').setContext(context).draw()
          new StaveConnector(upper, lower).setType('singleLeft').setContext(context).draw()
        }
      }
    }

    /** Build the VexFlow notes for one hand, bar by bar. */
    const buildHand = (hand: 'left' | 'right', staves: Stave[]): void => {
      const clef = hand === 'right' ? 'treble' : 'bass'
      const notes = phrase.notes
        .filter((n) => n.hand === hand)
        .sort((a, b) => a.startBeats - b.startBeats)
      if (notes.length === 0) return

      for (let bar = 0; bar < bars; bar++) {
        const stave = staves[bar]
        if (!stave) continue

        const barStart = bar * beatsPerBar
        const barNotes = notes.filter(
          (n) => n.startBeats >= barStart && n.startBeats < barStart + beatsPerBar
        )
        if (barNotes.length === 0) continue

        const staveNotes = barNotes.map((note) => buildStaveNote(note, clef, key.fifths))

        // Colour each note by how it was played.
        barNotes.forEach((note, index) => {
          const staveNote = staveNotes[index]
          if (!staveNote) return
          const outcome = outcomes?.get(note.id)
          const color = note.id === currentNoteId ? HIGHLIGHT : outcome ? OUTCOME_COLORS[outcome] : INK
          staveNote.setStyle({ fillStyle: color, strokeStyle: color })
          if (note.id === currentNoteId) {
            staveNote.setStyle({ fillStyle: color, strokeStyle: color, lineWidth: 2 })
          }
        })

        const voice = new Voice({
          num_beats: phrase.timeSignature[0],
          beat_value: phrase.timeSignature[1]
        })
        // Bars may be partially filled while a phrase is being generated.
        voice.setStrict(false)
        voice.addTickables(staveNotes)

        const beams = Beam.generateBeams(staveNotes)
        // Use the stave's actual note area: bars that carry a clef and key
        // signature have noticeably less room than the rest.
        new Formatter()
          .joinVoices([voice])
          .format([voice], Math.max(40, stave.getNoteEndX() - stave.getNoteStartX() - 15))
        voice.draw(context, stave)
        for (const beam of beams) beam.setContext(context).draw()
      }
    }

    buildHand('right', treble)
    if (grand) buildHand('left', bass)

    // VexFlow draws at a fixed pixel size; let it scale down on narrow windows.
    const svg = container.querySelector('svg')
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      svg.style.width = '100%'
      svg.style.height = 'auto'
      svg.style.maxHeight = `${height}px`
    }

    return () => {
      container.innerHTML = ''
    }
  }, [phrase, outcomes, currentNoteId, showFingers, width])

  return <div ref={containerRef} className={className} aria-label="Sheet music" />
}

/** VexFlow duration codes, keyed by length in beats (quarter = 1). */
function durationCode(beats: number): { duration: string; dots: number } {
  const table: Array<[number, string, number]> = [
    [4, 'w', 0],
    [3, 'h', 1],
    [2, 'h', 0],
    [1.5, 'q', 1],
    [1, 'q', 0],
    [0.75, '8', 1],
    [0.5, '8', 0],
    [0.25, '16', 0]
  ]
  let best = table[table.length - 1]!
  let bestDelta = Infinity
  for (const entry of table) {
    const delta = Math.abs(entry[0] - beats)
    if (delta < bestDelta) {
      best = entry
      bestDelta = delta
    }
  }
  return { duration: best[1], dots: best[2] }
}

function buildStaveNote(note: PhraseNote, clef: string, fifths: number): StaveNote {
  const key = keySignature(fifths)
  const spelled = note.midi.map((midi) => spellInKey(midi, key))

  const { duration, dots } = durationCode(note.durationBeats)

  const staveNote = new StaveNote({
    keys: spelled.map((p) => `${p.letter.toLowerCase()}${accidentalSuffix(p.accidental)}/${p.octave}`),
    duration: duration + (dots > 0 ? 'd'.repeat(dots) : ''),
    clef
  })

  // Accidentals are attached per note-head, not baked into the key string.
  spelled.forEach((p, index) => {
    if (p.accidental !== 0) {
      staveNote.addModifier(new Accidental(accidentalGlyph(p.accidental)), index)
    }
  })

  return staveNote
}

function accidentalSuffix(accidental: number): string {
  // VexFlow key strings take the accidental inline, e.g. "f#/4".
  switch (accidental) {
    case -2:
      return 'bb'
    case -1:
      return 'b'
    case 1:
      return '#'
    case 2:
      return '##'
    default:
      return ''
  }
}

function accidentalGlyph(accidental: number): string {
  switch (accidental) {
    case -2:
      return 'bb'
    case -1:
      return 'b'
    case 1:
      return '#'
    case 2:
      return '##'
    default:
      return 'n'
  }
}
