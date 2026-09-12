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

import { mkdir, readdir, rm, writeFile, access } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

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

/**
 * Downloads and unpacks an npm tarball with no subprocesses at all.
 *
 * Earlier versions shelled out to `npm pack` and `tar`. Both are portability
 * traps: on Windows npm is `npm.cmd`, and since Node's fix for CVE-2024-27980
 * spawning a `.cmd` without a shell throws EINVAL — so CI failed twice for two
 * different Windows-only reasons. Doing it in-process is shorter, works
 * everywhere, and lets us verify the registry's integrity hash ourselves.
 */
async function downloadPackage(name, version) {
  const meta = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`)
  if (!meta.ok) throw new Error(`registry lookup failed for ${name}@${version}: ${meta.status}`)
  const { dist } = await meta.json()
  if (!dist?.tarball) throw new Error(`no tarball listed for ${name}@${version}`)

  const response = await fetch(dist.tarball)
  if (!response.ok) throw new Error(`tarball download failed: ${response.status}`)
  const gz = Buffer.from(await response.arrayBuffer())

  // The registry publishes an integrity hash; check it rather than trusting
  // whatever arrived over the wire.
  if (dist.integrity?.startsWith('sha512-')) {
    const actual = createHash('sha512').update(gz).digest('base64')
    const expected = dist.integrity.slice('sha512-'.length)
    if (actual !== expected) {
      throw new Error(`integrity mismatch for ${name}@${version}`)
    }
  }

  return untar(gunzipSync(gz))
}

/**
 * Minimal tar reader — enough for an npm tarball, which is a flat ustar
 * archive with short paths. Returns a map of path -> contents.
 */
function untar(buf) {
  const files = new Map()
  let offset = 0

  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512)
    // Two consecutive zero blocks mark the end of the archive.
    if (header.every((b) => b === 0)) break

    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const sizeField = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim()
    const size = Number.parseInt(sizeField, 8) || 0
    const type = String.fromCharCode(header[156])

    offset += 512
    if (type === '0' || type === '\0' || type === '') {
      files.set(name, buf.subarray(offset, offset + size))
    }
    // File data is padded up to the next 512-byte boundary.
    offset += Math.ceil(size / 512) * 512
  }

  return files
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

  const files = await downloadPackage(layer.pkg, layer.version)

  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })

  let written = 0
  for (const [path, contents] of files) {
    if (!path.startsWith('package/audio/') || !path.endsWith('.mp3')) continue
    const name = path.slice('package/audio/'.length)
    // Refuse anything that tries to escape the target directory.
    if (name.includes('/') || name.includes('\\') || name.includes('..')) continue
    await writeFile(join(targetDir, name), contents)
    written += 1
  }

  if (written === 0) throw new Error(`no audio files found inside ${layer.pkg}`)

  console.log(
    `  velocity ${layer.velocity}: ${written} samples -> resources/audio/samples/v${layer.velocity}`
  )
  return { ...layer, files: written }
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
