import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { PianoKeyboard } from '../components/PianoKeyboard'
import { MidiStatusBar } from '../components/MidiStatusBar'
import { noteName } from '../music/pitch'
import { identifyChord, chordName } from '../music/chords'
import { intervalName, semitoneInterval } from '../music/intervals'

/**
 * Free play: the sandbox, and the app's smoke test. If a key press here does
 * not light up and make a sound, nothing else in the app matters.
 *
 * It doubles as a live theory readout — naming the chord or interval under your
 * hands turns idle noodling into something you learn from.
 */
export function FreePlayView({ onExit }: { onExit?: () => void }): React.JSX.Element {
  const held = useAppStore((s) => s.heldNotes)
  const audio = useAppStore((s) => s.audio)
  const settings = useAppStore((s) => s.settings)
  const calibration = useAppStore((s) => s.settings.calibration)

  const [metronomeOn, setMetronomeOn] = useState(false)
  const [bpm, setBpm] = useState(90)

  const sounding = [...held.keys()].sort((a, b) => a - b)
  const chord = sounding.length >= 3 ? identifyChord(sounding) : null
  const interval = sounding.length === 2 ? semitoneInterval(sounding[0]!, sounding[1]!) : null

  const deviceRange: [number, number] | null = calibration
    ? [calibration.deviceLow + settings.midi.transpose, calibration.deviceHigh + settings.midi.transpose]
    : null

  const toggleMetronome = (): void => {
    void audio.resume()
    if (metronomeOn) {
      audio.metronome.stop()
      setMetronomeOn(false)
    } else {
      audio.metronome.setTempo(bpm)
      audio.metronome.setTimeSignature(4)
      audio.metronome.start()
      setMetronomeOn(true)
    }
  }

  return (
    <div className="flex h-full flex-col bg-ink-900">
      <MidiStatusBar />

      <div className="flex items-center gap-3 border-b border-ink-700 bg-ink-850 px-6 py-2">
        {onExit && (
          <button
            onClick={onExit}
            className="rounded-md border border-ink-600 bg-ink-800 px-3 py-1 text-xs text-ink-200 hover:bg-ink-700"
          >
            ← Lessons
          </button>
        )}
        <button
          onClick={toggleMetronome}
          className={`rounded-md px-3 py-1 text-xs ${
            metronomeOn
              ? 'bg-brand-600 text-white'
              : 'border border-ink-600 bg-ink-800 text-ink-200 hover:bg-ink-700'
          }`}
        >
          {metronomeOn ? 'Stop metronome' : 'Metronome'}
        </button>
        <input
          type="range"
          min={40}
          max={200}
          value={bpm}
          onChange={(e) => {
            const next = Number(e.target.value)
            setBpm(next)
            audio.metronome.setTempo(next)
          }}
          className="w-40"
        />
        <span className="w-16 font-mono text-xs text-ink-400">{bpm} BPM</span>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="h-24 text-center">
          {sounding.length === 0 ? (
            <p className="pt-8 text-sm text-ink-400">
              Play a key on your MIDI keyboard, or click the keys below.
            </p>
          ) : (
            <>
              <p className="font-mono text-3xl font-semibold text-ink-100">
                {sounding.map((m) => noteName(m)).join('  ')}
              </p>
              <p className="mt-2 text-sm text-brand-400">
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
          low={48}
          high={72}
          held={held}
          showCNames
          showNames={settings.practice.showNoteNames}
          deviceRange={deviceRange}
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
