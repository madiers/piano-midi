import { useEffect, useState } from 'react'
import { ANCHORS, type OctaveAnchor } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { noteName } from '../music/pitch'

/**
 * Checks that the keyboard is sitting in the octave this lesson needs.
 *
 * We never transpose the music to fit the hardware. Doing so would silently
 * break the link between a written note and the key under the student's
 * finger, which is precisely the skill being built. Instead we ask for an
 * octave shift and verify it by watching what the keyboard actually sends.
 */
export function AnchorCheck({ anchor }: { anchor: OctaveAnchor }): React.JSX.Element | null {
  const spec = ANCHORS[anchor]
  const calibration = useAppStore((s) => s.settings.calibration)
  const transpose = useAppStore((s) => s.settings.midi.transpose)
  const addMidiTap = useAppStore((s) => s.addMidiTap)

  const [lowestSeen, setLowestSeen] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setLowestSeen(null)
    setDismissed(false)
  }, [anchor])

  useEffect(() => {
    return addMidiTap((event) => {
      if (event.type !== 'noteon') return
      setLowestSeen((previous) => (previous === null ? event.note : Math.min(previous, event.note)))
    })
  }, [addMidiTap])

  // Without calibration we cannot know where the keyboard sits, so stay quiet
  // rather than nagging about something we are guessing at.
  if (!calibration) return null
  if (dismissed) return null

  const deviceLow = calibration.deviceLow + transpose
  const deviceHigh = calibration.deviceHigh + transpose
  const covered = deviceLow <= spec.low && deviceHigh >= spec.high

  if (covered) return null

  const octavesOff = Math.round((spec.low - deviceLow) / 12)

  return (
    <div className="mb-6 rounded-xl border border-warn-500/40 bg-warn-500/10 p-4">
      <h3 className="text-sm font-semibold text-warn-500">Shift your keyboard&apos;s octave</h3>
      <p className="mt-1 text-sm text-ink-200">
        This unit uses {spec.label} — {spec.description} Your keyboard is currently sending{' '}
        {noteName(deviceLow)} to {noteName(deviceHigh)}.
      </p>
      <p className="mt-2 text-sm text-ink-200">
        {octavesOff === 0
          ? 'Your range does not quite cover this unit. You can still play, but some notes will be out of reach.'
          : `Press Octave ${octavesOff > 0 ? '+' : '−'} on your keyboard ${Math.abs(octavesOff)} time${
              Math.abs(octavesOff) === 1 ? '' : 's'
            }, or use the octave control at the top of the window.`}
      </p>
      {lowestSeen !== null && (
        <p className="mt-2 text-xs text-ink-400">
          Lowest note played since opening this lesson: {noteName(lowestSeen)}
          {lowestSeen === spec.low && ' — that matches. You are good to go.'}
        </p>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="mt-3 rounded border border-ink-600 bg-ink-800 px-3 py-1 text-xs text-ink-300 hover:bg-ink-700"
      >
        Continue anyway
      </button>
    </div>
  )
}
