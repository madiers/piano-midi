#!/usr/bin/env node
/**
 * Fetches the piano samples the app ships with.
 *
 * The samples are Salamander Grand Piano V3 by Alexander Holm, licensed
 * CC BY 3.0. They are republished on npm by Jan Forst (darosh) as
 * @audio-samples/piano-mp3-velocity*, which is the cleanest legal and
 * practical way to get them — versioned, checksummed, and attributed.
 *
 * We deliberately keep this OUT of npm dependencies and out of git:
 *   - they are ~5 MB per velocity layer of binary data that would bloat clones
 *   - electron-builder ships them via `extraResources`, not from node_modules
 *
 * Run with `npm run assets`. It is idempotent: already-present layers are
 * skipped unless --force is passed.
 */

import { createWriteStream } from 'node:fs'
import { mkdir, readdir, rm, writeFile, access } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = join(ROOT, 'resources', 'audio', 'samples')

/**
 * Velocity layers available upstream: 1 (softest) .. 16 (loudest), published
 * in steps. We ship ONE mid-loud layer by default.
 *
 * Why one layer: each layer decodes to roughly 140 MB of Float32 AudioBuffer
 * because Salamander's bass samples run 20-26 seconds. Four layers would be
 * over half a gigabyte of resident audio, which is not a sensible trade for a
 * beginner practice app. The sampler applies velocity as gain instead, and
 * trims sample tails on decode (see PianoSampler.ts).
 */
const LAYERS = [
  { velocity: 10, pkg: '@audio-samples/piano-mp3-velocity10', version: '1.0.5' }
]

const FORCE = process.argv.includes('--force')

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => (stdout += d))
    child.stderr?.on('data', (d) => (stderr += d))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolvePromise(stdout.trim())
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\n${stderr}`))
    })
  })
}

async function fetchLayer(layer) {
  const targetDir = join(OUT_DIR, `v${layer.velocity}`)

  if (!FORCE && (await exists(targetDir))) {
    const files = await readdir(targetDir).catch(() => [])
    const mp3s = files.filter((f) => f.endsWith('.mp3'))
    if (mp3s.length >= 30) {
      console.log(`  velocity ${layer.velocity}: already present (${mp3s.length} samples), skipping`)
      return { ...layer, files: mp3s.length }
    }
  }

  console.log(`  velocity ${layer.velocity}: downloading ${layer.pkg}@${layer.version} ...`)

  const work = join(tmpdir(), `piano-midi-assets-${process.pid}-v${layer.velocity}`)
  await mkdir(work, { recursive: true })

  try {
    // `npm pack` resolves the registry, verifies the integrity hash, and
    // respects any proxy/registry config the user already has.
    const tarballName = await run('npm', ['pack', `${layer.pkg}@${layer.version}`, '--silent'], {
      cwd: work
    })
    const tarball = join(work, tarballName.split('\n').pop().trim())

    await run('tar', ['xzf', tarball], { cwd: work })

    const audioSrc = join(work, 'package', 'audio')
    if (!(await exists(audioSrc))) {
      throw new Error(`no audio/ directory inside ${layer.pkg}`)
    }

    await rm(targetDir, { recursive: true, force: true })
    await mkdir(targetDir, { recursive: true })
    await run('cp', ['-R', `${audioSrc}/.`, targetDir])

    const copied = (await readdir(targetDir)).filter((f) => f.endsWith('.mp3'))
    console.log(`  velocity ${layer.velocity}: ${copied.length} samples -> resources/audio/samples/v${layer.velocity}`)
    return { ...layer, files: copied.length }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

/**
 * Build the index the sampler reads at runtime: which MIDI notes we have real
 * recordings for, so it can pick the nearest one and pitch-shift the rest.
 */
function midiFromSampleName(fileName) {
  // Names look like "C4v10.mp3", "D#3v10.mp3", "A0v10.mp3".
  const m = /^([A-G])(#?)(-?\d+)v\d+\.mp3$/.exec(fileName)
  if (!m) return null
  const [, letter, sharp, octaveRaw] = m
  const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
  const octave = Number.parseInt(octaveRaw, 10)
  return (octave + 1) * 12 + semis + (sharp ? 1 : 0)
}

async function main() {
  console.log('Fetching piano samples (Salamander Grand Piano V3, CC BY 3.0, Alexander Holm)')
  await mkdir(OUT_DIR, { recursive: true })

  const layers = []
  for (const layer of LAYERS) {
    layers.push(await fetchLayer(layer))
  }

  // Write a manifest so the renderer never has to guess at filenames.
  const manifest = { layers: [], attribution: {} }

  for (const layer of layers) {
    const dir = join(OUT_DIR, `v${layer.velocity}`)
    const files = (await readdir(dir)).filter((f) => f.endsWith('.mp3')).sort()
    const samples = files
      .map((file) => ({ file, midi: midiFromSampleName(file) }))
      .filter((s) => s.midi !== null)
      .sort((a, b) => a.midi - b.midi)

    if (samples.length !== files.length) {
      const bad = files.filter((f) => midiFromSampleName(f) === null)
      console.warn(`  warning: could not parse note from: ${bad.join(', ')}`)
    }

    manifest.layers.push({
      velocity: layer.velocity,
      dir: `samples/v${layer.velocity}`,
      samples
    })
  }

  manifest.attribution = {
    name: 'Salamander Grand Piano V3',
    author: 'Alexander Holm',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    source: 'https://archive.org/details/SalamanderGrandPianoV3',
    repackagedBy: 'Jan Forst (darosh) — @audio-samples/piano-mp3-velocity*, MIT'
  }

  await writeFile(
    join(ROOT, 'resources', 'audio', 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  )

  // A human-readable notice that ships next to the audio, satisfying CC BY.
  await writeFile(
    join(ROOT, 'resources', 'audio', 'ATTRIBUTION.txt'),
    [
      'Piano samples bundled with Piano MIDI',
      '',
      'Salamander Grand Piano V3',
      'Copyright Alexander Holm',
      'Licensed under Creative Commons Attribution 3.0 (CC BY 3.0)',
      'https://creativecommons.org/licenses/by/3.0/',
      'Source: https://archive.org/details/SalamanderGrandPianoV3',
      '',
      'The samples were obtained via the @audio-samples/piano-mp3-velocity*',
      'npm packages by Jan Forst (https://github.com/darosh/samples-piano-mp3),',
      'which are MIT licensed. The underlying recordings remain CC BY 3.0.',
      '',
      'No changes were made to the recordings other than selecting a subset',
      'of velocity layers for distribution size.',
      ''
    ].join('\n')
  )

  const total = manifest.layers.reduce((n, l) => n + l.samples.length, 0)
  console.log(`\nDone. ${total} samples across ${manifest.layers.length} velocity layer(s).`)
  console.log('Manifest: resources/audio/manifest.json')
}

main().catch((err) => {
  console.error('\nFailed to fetch audio assets:', err.message)
  console.error('The app still runs — it falls back to a synthesized piano tone.')
  process.exitCode = 1
})
