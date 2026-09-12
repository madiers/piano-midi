import type { Lesson, TempoStep } from '@shared/types'
import type { PerformanceResult } from '../lessons/PerformanceGrader'
import { ERROR_HINTS, type ErrorKind } from '../lessons/grading'

export interface ResultPanelProps {
  result: PerformanceResult
  lesson: Lesson
  tempo: TempoStep
  onRetry: () => void
  onNext?: () => void
}

export function ResultPanel({
  result,
  lesson,
  tempo,
  onRetry,
  onNext
}: ResultPanelProps): React.JSX.Element {
  const tempoPercent = tempo === 'wait' ? 0 : tempo
  const passed =
    result.final >= lesson.mastery.minScore && tempoPercent >= lesson.mastery.minTempoPercent

  // The most frequent mistake is worth one specific sentence of teaching.
  const topError = mostCommon(result.errorKinds)

  return (
    <section className="mt-6 rounded-xl border border-ink-700 bg-ink-850 p-6">
      <div className="flex items-start gap-6">
        <div className="text-center">
          <div className="flex gap-1">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`text-2xl ${n <= result.stars ? 'text-warn-500' : 'text-ink-700'}`}
              >
                ★
              </span>
            ))}
          </div>
          <p className="mt-1 font-mono text-2xl font-bold text-ink-100">
            {Math.round(result.final * 100)}%
          </p>
        </div>

        <div className="flex-1">
          <h2 className="text-base font-semibold text-ink-100">
            {passed ? 'Passed' : tempo === 'wait' ? 'Nice work — now try it in time' : 'Not quite yet'}
          </h2>
          <p className="mt-1 text-sm text-ink-300">
            {result.correct} of {result.totalExpected} notes correct
            {result.wrong > 0 && `, ${result.wrong} wrong`}
            {result.missed > 0 && `, ${result.missed} missed`}
            {result.extras > 0 && `, ${result.extras} extra`}.
          </p>

          {tempo === 'wait' && (
            <p className="mt-2 text-xs text-ink-400">
              Wait mode does not grade timing, so it cannot complete this lesson. Step up to 60%
              when the notes feel comfortable.
            </p>
          )}

          {/* A consistent early or late bias is a habit, and worth naming. */}
          {tempo !== 'wait' && Math.abs(result.meanTimingErrorMs) > 45 && (
            <p className="mt-2 text-xs text-warn-500">
              You are playing about {Math.abs(Math.round(result.meanTimingErrorMs))} ms{' '}
              {result.meanTimingErrorMs < 0 ? 'ahead of' : 'behind'} the beat, fairly consistently.
              {result.meanTimingErrorMs < 0
                ? ' Anticipating is very common — try listening to the click rather than playing with it.'
                : ' Try counting one bar ahead so your hand is ready.'}
            </p>
          )}

          {result.maxChordSpreadMs > 90 && (
            <p className="mt-2 text-xs text-warn-500">
              Your chords are rolling by up to {Math.round(result.maxChordSpreadMs)} ms. Drop all
              the fingers together from just above the keys.
            </p>
          )}

          {topError && (
            <p className="mt-2 text-xs text-ink-300">
              <span className="font-semibold text-ink-200">Most common slip: </span>
              {ERROR_HINTS[topError]}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={onRetry}
          className="rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-ink-200 hover:bg-ink-700"
        >
          Try again
        </button>
        {onNext && (
          <button
            onClick={onNext}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              passed
                ? 'bg-brand-600 text-white hover:bg-brand-500'
                : 'border border-ink-600 bg-ink-800 text-ink-300 hover:bg-ink-700'
            }`}
          >
            {passed ? 'Next lesson →' : 'Skip ahead anyway'}
          </button>
        )}
      </div>
    </section>
  )
}

function mostCommon(kinds: ErrorKind[]): ErrorKind | null {
  if (kinds.length === 0) return null
  const counts = new Map<ErrorKind, number>()
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  let best: ErrorKind | null = null
  let bestCount = 0
  for (const [kind, count] of counts) {
    if (count > bestCount) {
      best = kind
      bestCount = count
    }
  }
  return best
}
