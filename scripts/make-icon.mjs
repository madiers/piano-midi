#!/usr/bin/env node
/**
 * Generates the app icons: build/icon.png, build/icon.ico and (on macOS)
 * build/icon.icns.
 *
 * Written as a tiny software rasteriser plus a hand-rolled PNG/ICO encoder so
 * it has ZERO dependencies and runs identically on a developer Mac and in
 * Linux CI. An earlier version rendered an SVG inside Electron; offscreen
 * rendering never painted and capturePage() hung indefinitely.
 *
 * The design is deliberately geometric — rounded rectangles only — because
 * that is what a from-scratch rasteriser does well, and because a piano
 * keyboard under falling notes reads clearly at 32px, which is the size that
 * actually matters in a dock or task bar.
 *
 * Run with: npm run icon
 */

import { deflateSync } from 'node:zlib'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { platform } from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUILD_DIR = resolve(__dirname, '..', 'build')

/** Render at 4x and box-filter down, which gives clean edges without a library. */
const SIZE = 1024
const SS = 2
const W = SIZE * SS

// ---------------------------------------------------------------- raster

const buffer = new Float32Array(W * W * 4)

function srgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function blend(x, y, [r, g, b], alpha) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= W || y >= W) return
  const i = (y * W + x) * 4
  const a = Math.min(1, alpha)
  buffer[i] = buffer[i] * (1 - a) + r * a
  buffer[i + 1] = buffer[i + 1] * (1 - a) + g * a
  buffer[i + 2] = buffer[i + 2] * (1 - a) + b * a
  buffer[i + 3] = Math.min(255, buffer[i + 3] * (1 - a) + 255 * a)
}

/** Signed distance to a rounded rectangle; negative means inside. */
function roundedRectSdf(px, py, x, y, w, h, r) {
  const cx = Math.abs(px - (x + w / 2)) - (w / 2 - r)
  const cy = Math.abs(py - (y + h / 2)) - (h / 2 - r)
  const dx = Math.max(cx, 0)
  const dy = Math.max(cy, 0)
  return Math.min(Math.max(cx, cy), 0) + Math.sqrt(dx * dx + dy * dy) - r
}

/**
 * Fill a rounded rect. `color` may be a single colour or a function of the
 * vertical position, which is how the background gradient is drawn.
 */
function fillRoundedRect(x, y, w, h, r, color, clip) {
  const x0 = Math.max(0, Math.floor(x - 2))
  const x1 = Math.min(W, Math.ceil(x + w + 2))
  const y0 = Math.max(0, Math.floor(y - 2))
  const y1 = Math.min(W, Math.ceil(y + h + 2))

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const d = roundedRectSdf(px + 0.5, py + 0.5, x, y, w, h, r)
      // One-pixel smooth edge.
      const coverage = Math.min(1, Math.max(0, 0.5 - d))
      if (coverage <= 0) continue
      if (clip && clip(px + 0.5, py + 0.5) > 0) continue
      const c = typeof color === 'function' ? color(px, py) : color
      blend(px, py, c, coverage)
    }
  }
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

// ---------------------------------------------------------------- design

const S = (n) => n * SS // design units (1024-space) -> supersampled pixels

const BG_TOP = srgb('#0ea5e9')
const BG_MID = srgb('#0369a1')
const BG_BOTTOM = srgb('#082c45')
const WHITE_KEY = srgb('#eef3f9')
const WHITE_KEY_SHADE = srgb('#c9d6e4')
const BLACK_KEY = srgb('#0a1520')
const NOTE_RIGHT = srgb('#38bdf8')
const NOTE_LEFT = srgb('#a78bfa')

const RADIUS = S(228)

// Background, with a vertical gradient.
fillRoundedRect(0, 0, W, W, RADIUS, (_px, py) => {
  const t = py / W
  return t < 0.55 ? mix(BG_TOP, BG_MID, t / 0.55) : mix(BG_MID, BG_BOTTOM, (t - 0.55) / 0.45)
})

// Anything outside the rounded background must stay transparent.
const clipOutside = (px, py) => roundedRectSdf(px, py, 0, 0, W, W, RADIUS)

// Falling note bars, descending toward the keyboard.
const KEY_TOP = S(614)
const notes = [
  { col: 0, top: S(300), height: S(250), color: NOTE_RIGHT },
  { col: 2, top: S(210), height: S(340), color: NOTE_LEFT },
  { col: 4, top: S(330), height: S(220), color: NOTE_RIGHT },
  { col: 6, top: S(250), height: S(300), color: NOTE_LEFT }
]

const KB_X = S(128)
const KB_W = S(768)
const WHITE_W = KB_W / 7

for (const note of notes) {
  const x = KB_X + note.col * WHITE_W + WHITE_W * 0.16
  const w = WHITE_W * 0.68
  fillRoundedRect(x, note.top, w, note.height, S(18), note.color, clipOutside)
}

// White keys.
fillRoundedRect(KB_X, KEY_TOP, KB_W, S(268), S(26), WHITE_KEY, clipOutside)

// Key separators.
for (let i = 1; i < 7; i++) {
  fillRoundedRect(KB_X + i * WHITE_W - S(2.5), KEY_TOP, S(5), S(268), S(2), WHITE_KEY_SHADE, clipOutside)
}

// Black keys, in the real 2-then-3 grouping.
const BLACK_W = WHITE_W * 0.56
for (const i of [0, 1, 3, 4, 5]) {
  const x = KB_X + (i + 1) * WHITE_W - BLACK_W / 2
  fillRoundedRect(x, KEY_TOP, BLACK_W, S(166), S(12), BLACK_KEY, clipOutside)
}

// ---------------------------------------------------------------- encode

/** Box-downsample the supersampled buffer to `size`. */
function downsample(size) {
  const out = Buffer.alloc(size * size * 4)
  const factor = W / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      const sx0 = Math.floor(x * factor)
      const sy0 = Math.floor(y * factor)
      const sx1 = Math.min(W, Math.ceil((x + 1) * factor))
      const sy1 = Math.min(W, Math.ceil((y + 1) * factor))
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * W + sx) * 4
          r += buffer[i]
          g += buffer[i + 1]
          b += buffer[i + 2]
          a += buffer[i + 3]
          n++
        }
      }
      const o = (y * size + x) * 4
      out[o] = Math.round(r / n)
      out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n)
      out[o + 3] = Math.round(a / n)
    }
  }
  return out
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(rgba, size) {
  // Each scanline is prefixed with filter type 0 (none).
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** ICO containers may hold PNG payloads directly, which keeps this simple. */
function encodeIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)

  const directory = Buffer.alloc(16 * entries.length)
  let offset = 6 + directory.length

  entries.forEach((entry, index) => {
    const at = index * 16
    directory[at] = entry.size >= 256 ? 0 : entry.size
    directory[at + 1] = entry.size >= 256 ? 0 : entry.size
    directory[at + 2] = 0 // palette
    directory[at + 3] = 0
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32BE(0, at + 8)
    directory.writeUInt32LE(entry.png.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += entry.png.length
  })

  return Buffer.concat([header, directory, ...entries.map((e) => e.png)])
}

function run(cmd, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: 'ignore' })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${cmd} exited ${code}`))
    )
  })
}

await mkdir(BUILD_DIR, { recursive: true })

const png1024 = encodePng(downsample(1024), 1024)
await writeFile(join(BUILD_DIR, 'icon.png'), png1024)
console.log(`wrote build/icon.png (${(png1024.length / 1024).toFixed(1)} KB)`)

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const ico = encodeIco(icoSizes.map((size) => ({ size, png: encodePng(downsample(size), size) })))
await writeFile(join(BUILD_DIR, 'icon.ico'), ico)
console.log(`wrote build/icon.ico (${icoSizes.length} sizes)`)

if (platform === 'darwin') {
  const iconset = join(BUILD_DIR, 'icon.iconset')
  await rm(iconset, { recursive: true, force: true })
  await mkdir(iconset, { recursive: true })

  for (const size of [16, 32, 128, 256, 512]) {
    await writeFile(join(iconset, `icon_${size}x${size}.png`), encodePng(downsample(size), size))
    const retina = size * 2
    await writeFile(
      join(iconset, `icon_${size}x${size}@2x.png`),
      encodePng(downsample(retina), retina)
    )
  }

  await run('iconutil', ['-c', 'icns', iconset, '-o', join(BUILD_DIR, 'icon.icns')])
  await rm(iconset, { recursive: true, force: true })
  console.log('wrote build/icon.icns')
}
