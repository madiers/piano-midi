import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import type { GradingProfileId } from '@shared/types'
import { noteName } from '../music/pitch'
import { UpdatePanel } from '../components/UpdatePanel'
import { CalibrationPanel } from '../components/CalibrationPanel'

export function SettingsView(): React.JSX.Element {
  const {
    settings,
    updateSettings,
    devices,
    activeDeviceId,
    selectDevice,
    audio,
    audioStatus,
    appInfo,
    resetProgress
  } = useAppStore()

  const [samplerInfo, setSamplerInfo] = useState(audio.getSamplerInfo())
  useEffect(() => setSamplerInfo(audio.getSamplerInfo()), [audio, audioStatus])

  const calibration = settings.calibration

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-8 pb-16">
      <h1 className="text-xl font-bold text-ink-100">Settings</h1>

      <Section title="MIDI keyboard">
        <Row label="Device">
          <select
            className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1.5 text-sm text-ink-200"
            value={settings.midi.preferredDeviceId ?? ''}
            onChange={(e) => selectDevice(e.target.value || null)}
          >
            <option value="">Auto-detect</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id} disabled={d.state !== 'connected'}>
                {d.name}
                {d.state !== 'connected' ? ' (disconnected)' : ''}
              </option>
            ))}
          </select>
        </Row>
        <Row
          label="Octave shift"
          hint="Moves your keyboard, not the music. Written notes always mean the same key."
        >
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm text-ink-200 hover:bg-ink-700"
              onClick={() => void updateSettings({ midi: { transpose: settings.midi.transpose - 12 } })}
            >
              −
            </button>
            <span className="w-16 text-center font-mono text-sm text-ink-200">
              {settings.midi.transpose === 0
                ? 'none'
                : `${settings.midi.transpose > 0 ? '+' : ''}${settings.midi.transpose / 12} oct`}
            </span>
            <button
              className="rounded border border-ink-600 bg-ink-800 px-2 py-1 text-sm text-ink-200 hover:bg-ink-700"
              onClick={() => void updateSettings({ midi: { transpose: settings.midi.transpose + 12 } })}
            >
              +
            </button>
          </div>
        </Row>
        {calibration && (
          <Row label="Detected range">
            <span className="font-mono text-sm text-ink-300">
              {noteName(calibration.deviceLow)} – {noteName(calibration.deviceHigh)} (
              {calibration.keyCount} keys)
            </span>
          </Row>
        )}
        {activeDeviceId === null && devices.length === 0 && (
          <p className="text-xs text-warn-500">
            No keyboard connected. Plug one in — it will be picked up automatically.
          </p>
        )}
      </Section>

      <CalibrationPanel />

      <Section title="Sound">
        <Row label="Volume">
          <Slider
            value={settings.audio.masterVolume}
            onChange={(v) => void updateSettings({ audio: { masterVolume: v } })}
          />
        </Row>
        <Row label="Metronome volume">
          <Slider
            value={settings.audio.metronomeVolume}
            onChange={(v) => void updateSettings({ audio: { metronomeVolume: v } })}
          />
        </Row>
        <Row
          label="Note length"
          hint="How much of each recorded sample is kept in memory. Shorter uses less RAM; longer rings on."
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={settings.audio.sampleTailSeconds}
              onChange={(e) =>
                void updateSettings({ audio: { sampleTailSeconds: Number(e.target.value) } })
              }
              className="w-40"
            />
            <span className="w-20 font-mono text-xs text-ink-400">
              {settings.audio.sampleTailSeconds}s
            </span>
          </div>
        </Row>
        <Row label="Engine">
          <div className="text-sm text-ink-300">
            {audioStatus === 'ready-samples' && samplerInfo
              ? `Sampled piano · ${samplerInfo.samples} samples · ${samplerInfo.memoryMB} MB · ${audio.getLatencyMs()} ms latency`
              : audioStatus === 'ready-synth'
                ? 'Synthesised tone (no sample pack found)'
                : 'Loading…'}
          </div>
        </Row>
        <p className="text-xs text-ink-500">
          Piano samples: Salamander Grand Piano V3 by Alexander Holm, licensed CC BY 3.0.
        </p>
      </Section>

      <Section title="Practice">
        <Row label="Difficulty" hint="Sets how tight the timing windows are.">
          <div className="flex gap-2">
            {(['beginner', 'standard', 'strict'] as GradingProfileId[]).map((profile) => (
              <button
                key={profile}
                onClick={() => void updateSettings({ practice: { gradingProfile: profile } })}
                className={`rounded px-3 py-1.5 text-xs capitalize ${
                  settings.practice.gradingProfile === profile
                    ? 'bg-brand-600 text-white'
                    : 'border border-ink-600 bg-ink-800 text-ink-300 hover:bg-ink-700'
                }`}
              >
                {profile}
              </button>
            ))}
          </div>
        </Row>
        <Toggle
          label="Metronome during exercises"
          checked={settings.practice.metronomeEnabled}
          onChange={(v) => void updateSettings({ practice: { metronomeEnabled: v } })}
        />
        <Toggle
          label="Show note names on keys"
          checked={settings.practice.showNoteNames}
          onChange={(v) => void updateSettings({ practice: { showNoteNames: v } })}
        />
        <Toggle
          label="Show finger numbers"
          checked={settings.practice.showFingerNumbers}
          onChange={(v) => void updateSettings({ practice: { showFingerNumbers: v } })}
        />
        <Toggle
          label="Show falling notes"
          hint="Reading lessons always keep a staff-only pass, so this cannot replace reading."
          checked={settings.practice.showFallingNotes}
          onChange={(v) => void updateSettings({ practice: { showFallingNotes: v } })}
        />
        <Row label="Count-in">
          <select
            className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1.5 text-sm text-ink-200"
            value={settings.practice.countInBars}
            onChange={(e) =>
              void updateSettings({ practice: { countInBars: Number(e.target.value) } })
            }
          >
            <option value={0}>None</option>
            <option value={1}>1 bar</option>
            <option value={2}>2 bars</option>
          </select>
        </Row>
      </Section>

      <UpdatePanel />

      <Section title="About">
        {appInfo && (
          <div className="space-y-1 font-mono text-xs text-ink-400">
            <div>Piano MIDI {appInfo.version}</div>
            <div>
              Electron {appInfo.electron} · Chromium {appInfo.chrome} · Node {appInfo.node}
            </div>
            <div>
              {appInfo.platform} {appInfo.arch}
              {appInfo.isPackaged ? '' : ' · development build'}
            </div>
          </div>
        )}
        <button
          onClick={() => {
            if (confirm('Reset all lesson progress? This cannot be undone.')) void resetProgress()
          }}
          className="mt-3 rounded border border-bad-500/40 bg-bad-500/10 px-3 py-1.5 text-xs text-bad-500 hover:bg-bad-500/20"
        >
          Reset all progress
        </button>
      </Section>
    </div>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="rounded-xl border border-ink-700 bg-ink-850 p-5">
      <h2 className="mb-4 text-sm font-semibold text-ink-100">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Row({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="text-sm text-ink-200">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-ink-500">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}): React.JSX.Element {
  return (
    <Row label={label} hint={hint}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-ink-600'}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </Row>
  )
}

function Slider({
  value,
  onChange
}: {
  value: number
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40"
      />
      <span className="w-10 font-mono text-xs text-ink-400">{Math.round(value * 100)}</span>
    </div>
  )
}
