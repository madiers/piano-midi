/**
 * Tiny JSON-file store for settings and progress.
 *
 * Deliberately not `electron-store`: v11 is ESM-only, which is awkward to
 * require from a CJS main bundle, and the feature we need is "write an object
 * to a file atomically". Atomic write (temp file + rename) matters because a
 * crash mid-write would otherwise leave the user with no progress at all.
 */

import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log'

export class JsonStore<T extends object> {
  private readonly file: string
  private cache: T | null = null

  constructor(
    fileName: string,
    private readonly defaults: T,
    /** Runs on load; use it to migrate older schema versions. */
    private readonly migrate?: (raw: unknown) => T | null
  ) {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.file = join(dir, fileName)
  }

  get path(): string {
    return this.file
  }

  read(): T {
    if (this.cache) return this.cache

    if (!existsSync(this.file)) {
      this.cache = structuredClone(this.defaults)
      return this.cache
    }

    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as unknown
      const migrated = this.migrate ? this.migrate(raw) : (raw as T)
      if (migrated) {
        // Merge over defaults so a setting added in a later version still has
        // a value when reading a file written by an older build.
        this.cache = deepMerge(structuredClone(this.defaults), migrated)
        return this.cache
      }
      log.warn(`[store] ${this.file} could not be migrated; falling back to defaults`)
    } catch (err) {
      log.error(`[store] failed to read ${this.file}:`, err)
      // Keep the damaged file around rather than silently destroying data.
      try {
        renameSync(this.file, `${this.file}.corrupt-${Date.now()}`)
      } catch {
        /* nothing more we can do */
      }
    }

    this.cache = structuredClone(this.defaults)
    return this.cache
  }

  write(value: T): T {
    this.cache = value
    const tmp = `${this.file}.tmp`
    try {
      writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
      renameSync(tmp, this.file)
    } catch (err) {
      log.error(`[store] failed to write ${this.file}:`, err)
      try {
        if (existsSync(tmp)) unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
    return value
  }

  patch(partial: DeepPartial<T>): T {
    const next = deepMerge(structuredClone(this.read()), partial as T)
    return this.write(next)
  }

  reset(): T {
    return this.write(structuredClone(this.defaults))
  }
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

/** Merge `source` into `target`, recursing into plain objects only. */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  for (const key of Object.keys(source) as Array<keyof T>) {
    const value = source[key]
    if (value === undefined) continue

    const existing = target[key]
    if (isPlainObject(existing) && isPlainObject(value)) {
      target[key] = deepMerge(existing as object, value as object) as T[keyof T]
    } else {
      target[key] = value as T[keyof T]
    }
  }
  return target
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
