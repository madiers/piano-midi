/** Shared MIDI-layer types. */

export interface MidiDeviceInfo {
  id: string
  name: string
  manufacturer: string
  /** Web MIDI port state. 'disconnected' ports are remembered but unusable. */
  state: 'connected' | 'disconnected'
  connection: 'open' | 'closed' | 'pending'
}

export interface NoteOnEvent {
  type: 'noteon'
  /** MIDI note number, already octave-shifted by the user's transpose setting. */
  note: number
  /** The note number exactly as the hardware sent it, before transposition. */
  rawNote: number
  /** 1-127. Note-on with velocity 0 is normalised to a noteoff, never delivered here. */
  velocity: number
  channel: number
  /** performance.now() timestamp, in ms. */
  time: number
  deviceId: string
}

export interface NoteOffEvent {
  type: 'noteoff'
  note: number
  rawNote: number
  channel: number
  time: number
  deviceId: string
}

export interface ControlChangeEvent {
  type: 'cc'
  controller: number
  value: number
  channel: number
  time: number
  deviceId: string
}

export interface PitchBendEvent {
  type: 'pitchbend'
  /** -1..1 */
  value: number
  channel: number
  time: number
  deviceId: string
}

export interface SustainEvent {
  type: 'sustain'
  down: boolean
  channel: number
  time: number
  deviceId: string
}

export type MidiEvent =
  | NoteOnEvent
  | NoteOffEvent
  | ControlChangeEvent
  | PitchBendEvent
  | SustainEvent

export type MidiStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'unsupported'
  | 'denied'
  | 'error'

/** Controller-change reasons, surfaced so the UI can explain what happened. */
export interface MidiDeviceChange {
  device: MidiDeviceInfo
  reason: 'connected' | 'disconnected'
}
