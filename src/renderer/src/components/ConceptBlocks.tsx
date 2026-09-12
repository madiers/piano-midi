import type { ConceptBlock } from '@shared/types'
import { PianoKeyboard, type KeyMark } from './PianoKeyboard'
import { StaffView } from './StaffView'
import { noteName } from '../music/pitch'
import { intervalName, semitoneInterval } from '../music/intervals'

/** Renders the teaching content of a lesson. */
export function ConceptBlocks({ blocks }: { blocks: ConceptBlock[] }): React.JSX.Element {
  return (
    <div className="space-y-6">
      {blocks.map((block, index) => (
        <section key={index}>
          {block.heading && (
            <h2 className="mb-2 text-base font-semibold text-ink-100">{block.heading}</h2>
          )}
          <div className="space-y-3">
            {block.body.split('\n\n').map((paragraph, i) => (
              <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-ink-200">
                {paragraph}
              </p>
            ))}
          </div>
          {block.figure && <Figure figure={block.figure} />}
        </section>
      ))}
    </div>
  )
}

function Figure({ figure }: { figure: NonNullable<ConceptBlock['figure']> }): React.JSX.Element {
  switch (figure.type) {
    case 'keyboard': {
      const marks = new Map<number, KeyMark>()
      for (const midi of figure.highlight) marks.set(midi, 'target')

      const low = Math.min(48, ...figure.highlight) - 2
      const high = Math.max(72, ...figure.highlight) + 2

      return (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-950 p-4">
          <PianoKeyboard
            low={clampToC(low, 'down')}
            high={clampToC(high, 'up')}
            marks={marks}
            showCNames
            height={120}
          />
          {figure.labels && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(figure.labels).map(([midi, label]) => (
                <span key={midi} className="text-xs text-ink-300">
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand-400 align-middle" />
                  {label}{' '}
                  <span className="text-ink-500">({noteName(Number(midi))})</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )
    }

    case 'fingers':
      return (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-950 p-5">
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-400">
            {figure.hand === 'right' ? 'Right hand' : 'Left hand'}
          </p>
          <div className="flex items-end gap-3">
            {figure.numbers.map((n) => (
              <div key={n} className="flex flex-col items-center gap-2">
                <div
                  className="w-8 rounded-t-full bg-ink-700"
                  style={{ height: 20 + (n === 1 ? 0 : n === 3 ? 44 : n === 5 ? 16 : 34) }}
                />
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {n}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-400">
            1 is the thumb. The hands mirror each other, so both thumbs point inward.
          </p>
        </div>
      )

    case 'interval': {
      const interval = semitoneInterval(figure.from, figure.to)
      return (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-950 p-4 text-sm text-ink-200">
          {noteName(figure.from)} → {noteName(figure.to)} is{' '}
          <span className="font-semibold text-brand-400">a {intervalName(interval)}</span>
        </div>
      )
    }

    case 'staff':
      return (
        <div className="mt-4 overflow-x-auto rounded-lg bg-ink-100 p-3">
          <StaffView phrase={figure.phrase} width={700} />
        </div>
      )
  }
}

/** Round a range edge outward to the nearest C, so diagrams start sensibly. */
function clampToC(midi: number, direction: 'up' | 'down'): number {
  const offset = ((midi % 12) + 12) % 12
  if (offset === 0) return midi
  return direction === 'down' ? midi - offset : midi + (12 - offset)
}
