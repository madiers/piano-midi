/**
 * Global app state.
 *
 * The MIDI engine and audio engine are long-lived singletons that live OUTSIDE
 * React — they must not be torn down and rebuilt by a re-render, and an
 * AudioContext is expensive to recreate. The store holds references to them and
 * mirrors only the parts React needs to draw.
 */

import { create } from 'zustand'
import type { AppSettings, UserProgress } from '@shared/types'
import { DEFAULT_SETTINGS, createEmptyProgress } from '@shared/types'
import type { AppInfo, DeepPartial, UpdateState } from '@shared/ipc'
import { MidiEngine } from '../midi/MidiEngine'
import type { MidiDeviceInfo, MidiEvent, MidiStatus } from '../midi/types'
import { AudioEngine, type AudioEngineStatus } from '../audio/AudioEngine'

/** Extra listeners that want raw MIDI (lesson runners, calibration). */
type MidiTap = (event: MidiEvent) => void

interface AppState {
  // Engines (stable references, never replaced)
  midi: MidiEngine
  audio: AudioEngine

  // Mirrored MIDI state
  midiStatus: MidiStatus
  midiStatusDetail: string | undefined
  devices: MidiDeviceInfo[]
  activeDeviceId: string | null
  /** Notes currently held down, for the on-screen keyboard. */
  heldNotes: Map<number, number>
  lastNote: { midi: number; velocity: number } | null
  sustainDown: boolean

  // Audio
  audioStatus: AudioEngineStatus
  audioProgress: { loaded: number; total: number } | null
  audioError: string | null

  // Persisted
  settings: AppSettings
  progress: UserProgress
  appInfo: AppInfo | null
  updateState: UpdateState | null

  bootstrapped: boolean

  // Actions
  bootstrap: () => Promise<void>
  selectDevice: (deviceId: string | null) => void
  setTranspose: (semitones: number) => void
  updateSettings: (patch: DeepPartial<AppSettings>) => Promise<void>
  saveProgress: (progress: UserProgress) => Promise<void>
  resetProgress: () => Promise<void>
  addMidiTap: (tap: MidiTap) => () => void
}

// DeepPartial comes from the shared IPC contract so both sides agree.

/** Taps live outside the store so adding one never triggers a re-render. */
const midiTaps = new Set<MidiTap>()

export const useAppStore = create<AppState>((set, get) => {
  const midi = new MidiEngine()
  const audio = new AudioEngine()

  return {
    midi,
    audio,

    midiStatus: 'idle',
    midiStatusDetail: undefined,
    devices: [],
    activeDeviceId: null,
    heldNotes: new Map(),
    lastNote: null,
    sustainDown: false,

    audioStatus: 'idle',
    audioProgress: null,
    audioError: null,

    settings: DEFAULT_SETTINGS,
    progress: createEmptyProgress(),
    appInfo: null,
    updateState: null,

    bootstrapped: false,

    async bootstrap() {
      if (get().bootstrapped) return

      const [settings, progress, appInfo, manifest] = await Promise.all([
        window.api.getSettings(),
        window.api.getProgress(),
        window.api.getAppInfo(),
        window.api.getAudioManifest()
      ])

      set({ settings, progress, appInfo })

      // ---- audio ----
      audio.setMasterVolume(settings.audio.masterVolume)
      audio.setMetronomeVolume(settings.audio.metronomeVolume)
      set({ audioStatus: 'loading' })

      void audio
        .loadSamples(
          settings.audio.engine === 'synth' ? null : manifest,
          appInfo.audioBaseUrl,
          settings.audio.sampleTailSeconds,
          (p) => set({ audioProgress: p })
        )
        .then(() => {
          set({
            audioStatus: audio.getStatus(),
            audioError: audio.getError(),
            audioProgress: null
          })
        })

      // ---- midi ----
      midi.setTranspose(settings.midi.transpose)

      midi.onStatus((status, detail) => set({ midiStatus: status, midiStatusDetail: detail }))

      midi.onDevices((devices) =>
        set({ devices, activeDeviceId: midi.getActiveDeviceId() })
      )

      midi.onEvent((event) => {
        // Keep this handler cheap: it runs on the renderer main thread, the
        // same one drawing the falling notes.
        switch (event.type) {
          case 'noteon': {
            audio.noteOn(event.note, event.velocity)
            const held = new Map(get().heldNotes)
            held.set(event.note, event.velocity)
            set({ heldNotes: held, lastNote: { midi: event.note, velocity: event.velocity } })
            break
          }
          case 'noteoff': {
            audio.noteOff(event.note)
            const held = new Map(get().heldNotes)
            held.delete(event.note)
            set({ heldNotes: held })
            break
          }
          case 'sustain': {
            audio.setSustain(event.down)
            set({ sustainDown: event.down })
            break
          }
          default:
            break
        }

        for (const tap of midiTaps) tap(event)
      })

      if (settings.midi.preferredDeviceId) {
        midi.selectDevice(settings.midi.preferredDeviceId)
      }
      await midi.start()
      set({ devices: midi.listDevices(), activeDeviceId: midi.getActiveDeviceId() })

      // ---- updates ----
      window.api.onUpdateState((updateState) => set({ updateState }))

      set({ bootstrapped: true })
    },

    selectDevice(deviceId) {
      get().midi.selectDevice(deviceId)
      set({ activeDeviceId: get().midi.getActiveDeviceId(), devices: get().midi.listDevices() })
      void get().updateSettings({ midi: { preferredDeviceId: deviceId } })
    },

    setTranspose(semitones) {
      get().midi.setTranspose(semitones)
      void get().updateSettings({ midi: { transpose: semitones } })
    },

    async updateSettings(patch) {
      const settings = await window.api.setSettings(patch)
      set({ settings })

      const { audio: audioEngine, midi: midiEngine } = get()
      audioEngine.setMasterVolume(settings.audio.masterVolume)
      audioEngine.setMetronomeVolume(settings.audio.metronomeVolume)
      audioEngine.setSampleTailSeconds(settings.audio.sampleTailSeconds)
      midiEngine.setTranspose(settings.midi.transpose)
    },

    async saveProgress(progress) {
      const saved = await window.api.setProgress(progress)
      set({ progress: saved })
    },

    async resetProgress() {
      const fresh = await window.api.resetProgress()
      set({ progress: fresh })
    },

    addMidiTap(tap) {
      midiTaps.add(tap)
      return () => {
        midiTaps.delete(tap)
      }
    }
  }
})
