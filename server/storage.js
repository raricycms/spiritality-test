/**
 * Persistence for the experiment service.
 *
 * The default file store keeps every real session and credential in a private
 * JSON file (`.data/experiments.json` by default) written with an atomic
 * temp-file + rename. Writes are serialized so they land in operation order.
 * The raw file is never served over HTTP.
 *
 * The interface is intentionally tiny so tests can inject an in-memory store:
 *   { load(): object|null, save(state): void|Promise<void> }
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export const DEFAULT_DATA_FILE = path.join('.data', 'experiments.json')

/**
 * Durable, atomic, ordered file storage.
 * @param {string} filePath
 */
export function createFileStorage(filePath = DEFAULT_DATA_FILE) {
  const resolved = path.resolve(filePath)
  let queue = Promise.resolve()

  function writeAtomic(payload) {
    const dir = path.dirname(resolved)
    fs.mkdirSync(dir, { recursive: true })
    const json = JSON.stringify(payload)
    const tmp = `${resolved}.${process.pid}.${randomUUID()}.tmp`
    const fd = fs.openSync(tmp, 'w', 0o600)
    try {
      fs.writeFileSync(fd, json)
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    // rename() replaces the destination atomically (MOVEFILE_REPLACE_EXISTING on Windows).
    fs.renameSync(tmp, resolved)
  }

  return {
    filePath: resolved,
    load() {
      try {
        const raw = fs.readFileSync(resolved, 'utf8')
        const state = JSON.parse(raw)
        if (state?.version !== 2 || !['sessions', 'tokens', 'roomCodes'].every((key) =>
          state[key] && typeof state[key] === 'object' && !Array.isArray(state[key]))) {
          throw new Error('Invalid experiment storage format')
        }
        return state
      } catch (err) {
        if (err && err.code === 'ENOENT') return null
        // Do not overwrite real sessions and credentials after a read failure.
        throw err
      }
    },
    save(state) {
      // Chain onto the previous write so saves are applied in call order.
      // Recover from a prior failure so one bad write does not block the rest.
      queue = queue.then(
        () => writeAtomic(state),
        () => writeAtomic(state),
      )
      return queue
    },
    /** Test helper: wait for pending writes. */
    flush() {
      return queue
    },
  }
}

/** Volatile storage for tests; optionally seeded with an existing state object. */
export function createMemoryStorage(initial = null) {
  let data = initial ? JSON.parse(JSON.stringify(initial)) : null
  return {
    load() {
      return data ? JSON.parse(JSON.stringify(data)) : null
    },
    save(state) {
      data = JSON.parse(JSON.stringify(state))
    },
    get data() {
      return data
    },
  }
}
