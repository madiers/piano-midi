/**
 * MIDI input via the Web MIDI API.
 *
 * We use Web MIDI (built into Chromium) rather than a native module like
 * node-midi on purpose: no node-gyp, no prebuilds, no electron-rebuild, and no
 * architecture-specific binaries to notarize. Chromium's implementation sits on
 * CoreMIDI/WinMM/ALSA underneath, so we lose nothing that matters for note input.
 *
 * Auto-detection works in two layers:
 *   1. On start we enumerate inputs and, if the user has no explicit preference,
 *      pick the most plausible keyboard.
 *   2. We subscribe to `statechange`, so plugging a keyboard in mid-session
 *      attaches it without the user touching anything.
 */

import type {
  MidiDeviceChange,
  MidiDeviceInfo,
  MidiEvent,
  MidiStatus
} from './types'

// MIDI status bytes (upper nibble).
const NOTE_OFF = 0x80
const NOTE_ON = 0x90
const CONTROL_CHANGE = 0xb0
const PITCH_BEND = 0xe0

const CC_SUSTAIN = 64

type EventListener = (event: MidiEvent) => void
type DeviceListener = (devices: MidiDeviceInfo[], change?: MidiDeviceChange) => void
type StatusListener = (status: MidiStatus, detail?: string) => void

export interface MidiEngineOptions {
  /** Semitones added to every incoming note, for octave shifting on short keyboards. */
  transpose?: number
}

export class MidiEngine {
  private access: MIDIAccess | null = null
  private status: MidiStatus = 'idle'
  private statusDetail: string | undefined

  /** Device the user explicitly chose. Null means "decide automatically". */
  private preferredDeviceId: string | null = null
  /** The device we are actually listening to right now. */
  private activeDeviceId: string | null = null

  private transpose = 0

  private readonly eventListeners = new Set<EventListener>()
  private readonly deviceListeners = new Set<DeviceListener>()
  private readonly statusListeners = new Set<StatusListener>()

  /** Bound handler kept so we can detach cleanly when switching devices. */
  private readonly boundMessage = (e: Event): void => this.handleMessage(e as MIDIMessageEvent)

  constructor(options: MidiEngineOptions = {}) {
    this.transpose = options.transpose ?? 0
  }

  // ------------------------------------------------------------------ lifecycle

  /**
   * Request access and start listening. Safe to call more than once.
   *
   * We deliberately request WITHOUT sysex: sysex triggers a stricter permission
   * path and we have no use for it. Note input needs nothing more.
   */
  async start(): Promise<MidiStatus> {
    if (this.status === 'ready') return this.status

    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      this.setStatus('unsupported', 'This build has no Web MIDI support.')
      return this.status
    }

    this.setStatus('requesting')

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Chromium reports a SecurityError when the permission is refused.
      const denied = err instanceof DOMException && err.name === 'SecurityError'
      this.setStatus(denied ? 'denied' : 'error', message)
      return this.status
    }

    this.access.onstatechange = (event) => this.handleStateChange(event as MIDIConnectionEvent)

    this.setStatus('ready')
    this.autoAttach()
    this.emitDevices()
    return this.status
  }

  /** Detach from hardware and drop listeners. */
  stop(): void {
    this.detachActive()
    if (this.access) this.access.onstatechange = null
    this.access = null
    this.setStatus('idle')
  }

  // -------------------------------------------------------------------- devices

  listDevices(): MidiDeviceInfo[] {
    if (!this.access) return []
    const out: MidiDeviceInfo[] = []
    this.access.inputs.forEach((input) => {
      out.push({
        id: input.id,
        name: input.name ?? 'Unknown device',
        manufacturer: input.manufacturer ?? '',
        state: input.state === 'connected' ? 'connected' : 'disconnected',
        connection: input.connection
      })
    })
    return out
  }

  getActiveDeviceId(): string | null {
    return this.activeDeviceId
  }

  getPreferredDeviceId(): string | null {
    return this.preferredDeviceId
  }

  getStatus(): { status: MidiStatus; detail?: string } {
    return { status: this.status, detail: this.statusDetail }
  }

  /**
   * Choose a device explicitly. Passing null returns to automatic selection,
   * which is what the "Auto-detect" option in settings does.
   */
  selectDevice(deviceId: string | null): void {
    this.preferredDeviceId = deviceId
    this.detachActive()
    if (deviceId) {
      this.attach(deviceId)
    } else {
      this.autoAttach()
    }
    this.emitDevices()
  }

  setTranspose(semitones: number): void {
    this.transpose = semitones
  }

  getTranspose(): number {
    return this.transpose
  }

  // ------------------------------------------------------------------ listeners

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  onDevices(listener: DeviceListener): () => void {
    this.deviceListeners.add(listener)
    return () => this.deviceListeners.delete(listener)
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  // -------------------------------------------------------------------- internal

  /**
   * Pick a device when the user hasn't chosen one.
   *
   * Preference order: the remembered device if it is back, then the first port
   * that doesn't look like a software/virtual port (IAC, loopback and "Through"
   * ports are almost never what a student means), then whatever is left.
   */
  private autoAttach(): void {
    if (!this.access) return

    const devices = this.listDevices().filter((d) => d.state === 'connected')
    if (devices.length === 0) {
      this.activeDeviceId = null
      return
    }

    if (this.preferredDeviceId) {
      const preferred = devices.find((d) => d.id === this.preferredDeviceId)
      if (preferred) {
        this.attach(preferred.id)
        return
      }
    }

    const physical = devices.find((d) => !isLikelyVirtualPort(d))
    this.attach((physical ?? devices[0]!).id)
  }

  private attach(deviceId: string): void {
    if (!this.access) return
    const input = this.access.inputs.get(deviceId)
    if (!input) return

    if (this.activeDeviceId === deviceId) return
    this.detachActive()

    input.addEventListener('midimessage', this.boundMessage)
    // `open()` resolves asynchronously but listening works regardless; we call
    // it so the port reports connection: 'open' in the device list.
    void input.open?.()
    this.activeDeviceId = deviceId
  }

  private detachActive(): void {
    if (!this.access || !this.activeDeviceId) {
      this.activeDeviceId = null
      return
    }
    const input = this.access.inputs.get(this.activeDeviceId)
    input?.removeEventListener('midimessage', this.boundMessage)
    this.activeDeviceId = null
  }

  private handleStateChange(event: MIDIConnectionEvent): void {
    const port = event.port
    if (!port || port.type !== 'input') {
      this.emitDevices()
      return
    }

    const info: MidiDeviceInfo = {
      id: port.id,
      name: port.name ?? 'Unknown device',
      manufacturer: port.manufacturer ?? '',
      state: port.state === 'connected' ? 'connected' : 'disconnected',
      connection: port.connection
    }

    if (port.state === 'disconnected' && port.id === this.activeDeviceId) {
      // Hardware went away. Drop it and see if anything else is usable.
      this.detachActive()
      this.autoAttach()
    } else if (port.state === 'connected' && !this.activeDeviceId) {
      // Something was just plugged in and we had nothing — grab it.
      this.autoAttach()
    } else if (port.state === 'connected' && port.id === this.preferredDeviceId) {
      // The user's chosen device came back; switch to it.
      this.attach(port.id)
    }

    this.emitDevices({
      device: info,
      reason: port.state === 'connected' ? 'connected' : 'disconnected'
    })
  }

  private handleMessage(event: MIDIMessageEvent): void {
    const data = event.data
    if (!data || data.length < 2) return

    const statusByte = data[0]!
    const command = statusByte & 0xf0
    const channel = statusByte & 0x0f
    // event.timeStamp is on the same clock as performance.now().
    const time = event.timeStamp || performance.now()
    const deviceId = this.activeDeviceId ?? ''

    switch (command) {
      case NOTE_ON: {
        const rawNote = data[1]!
        const velocity = data[2] ?? 0
        // A note-on with velocity 0 is a note-off — many keyboards use it as
        // running status, so treating it as a note-on leaves stuck notes.
        if (velocity === 0) {
          this.emit({
            type: 'noteoff',
            note: rawNote + this.transpose,
            rawNote,
            channel,
            time,
            deviceId
          })
        } else {
          this.emit({
            type: 'noteon',
            note: rawNote + this.transpose,
            rawNote,
            velocity,
            channel,
            time,
            deviceId
          })
        }
        break
      }

      case NOTE_OFF: {
        const rawNote = data[1]!
        this.emit({
          type: 'noteoff',
          note: rawNote + this.transpose,
          rawNote,
          channel,
          time,
          deviceId
        })
        break
      }

      case CONTROL_CHANGE: {
        const controller = data[1]!
        const value = data[2] ?? 0
        if (controller === CC_SUSTAIN) {
          this.emit({ type: 'sustain', down: value >= 64, channel, time, deviceId })
        }
        this.emit({ type: 'cc', controller, value, channel, time, deviceId })
        break
      }

      case PITCH_BEND: {
        const lsb = data[1]!
        const msb = data[2] ?? 0
        const raw = (msb << 7) | lsb // 0..16383, centred at 8192
        this.emit({ type: 'pitchbend', value: (raw - 8192) / 8192, channel, time, deviceId })
        break
      }

      default:
        break
    }
  }

  private emit(event: MidiEvent): void {
    for (const listener of this.eventListeners) listener(event)
  }

  private emitDevices(change?: MidiDeviceChange): void {
    const devices = this.listDevices()
    for (const listener of this.deviceListeners) listener(devices, change)
  }

  private setStatus(status: MidiStatus, detail?: string): void {
    this.status = status
    this.statusDetail = detail
    for (const listener of this.statusListeners) listener(status, detail)
  }
}

/**
 * Ports we should not auto-select.
 *
 * Two kinds get filtered. Software buses (macOS IAC, loopMIDI, a DAW's virtual
 * output) are never what a student means. And many controllers expose a second
 * "editor"/"control" port alongside the keys — an Alesis V25, for example,
 * shows both "V25 Out" and "V25 EDITOR Out", and only the first carries notes.
 * Picking the editor port looks exactly like a dead keyboard.
 */
function isLikelyVirtualPort(device: MidiDeviceInfo): boolean {
  const haystack = `${device.name} ${device.manufacturer}`.toLowerCase()
  return (
    haystack.includes('iac') ||
    haystack.includes('through') ||
    haystack.includes('loopback') ||
    haystack.includes('loopmidi') ||
    haystack.includes('virtual') ||
    haystack.includes('network') ||
    haystack.includes('editor') ||
    haystack.includes('daw ctrl') ||
    haystack.includes('control surface')
  )
}
