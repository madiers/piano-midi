import { useAppStore } from '../store/appStore'
import { PianoKeyboard } from '../components/PianoKeyboard'
import { MidiStatusBar } from '../components/MidiStatusBar'
import { noteName } from '../music/pitch'
import { identifyChord, chordName } from '../music/chords'
import { intervalName, semitoneInterval } from '../music/intervals'

/**
 * Free play: the sandbox. It is also the first thing that has to work — if a
 * key press here doesn't light up and make a sound, nothing else matters.
 */
export function FreePlayView(): React.JSX.Element {
  const held = useAppStore((s) => s.heldNotes)
  const audio = useAppStore((s) => s.audio)
  const settings = useAppStore((s) => s.settings)

  const sounding = [...held.keys()].sort((a, b) => a - b)
  const chord = sounding.length >= 3 ? identifyChord(sounding) : null
  const interval =
    sounding.length === 2 ? semitoneInterval(sounding[0]!, sounding[1]!) : null

  const low = 48
  const high = 72

  return (
    <div className="flex h-full flex-col bg-ink-900">
      <MidiStatusBar />

      <main className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="mb-2 h-20 text-center">
          {sounding.length === 0 ? (
            <p className="pt-6 text-sm text-ink-400">
              Play a key on your MIDI keyboard, or click the keys below.
            </p>
          ) : (
            <>
              <p className="font-mono text-3xl font-semibold text-ink-100">
                {sounding.map((m) => noteName(m)).join('  ')}
              </p>
              <p className="mt-1 text-sm text-brand-400">
                {chord
                  ? chordName(chord)
                  : interval
                    ? intervalName(interval)
                    : sounding.length === 1
                      ? 'single note'
                      : `${sounding.length} notes`}
              </p>
            </>
          )}
        </div>
      </main>

      <footer className="px-6 pb-8">
        <PianoKeyboard
          low={low}
          high={high}
          held={held}
          showCNames
          showNames={settings.practice.showNoteNames}
          height={168}
          onKeyDown={(midi) => {
            void audio.resume()
            audio.noteOn(midi, 90)
          }}
          onKeyUp={(midi) => audio.noteOff(midi)}
        />
      </footer>
    </div>
  )
}
