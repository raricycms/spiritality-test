/**
 * localStorage wrapper with safe error handling and migration.
 *
 * Keys are namespaced under "spirituality:v1:".
 */

import { DEFAULT_APP_SETTINGS, aggregateRounds, spiritualityProbPointNull } from './statistics.js'

const KEY_SESSIONS = 'spirituality:v1:sessions'
const KEY_SETTINGS = 'spirituality:v1:settings'
const KEY_SCHEMA = 'spirituality:v1:schemaVersion'

/** Safely write JSON, returning success boolean. */
export function writeSafe(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    // Quota exceeded or disabled
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`storage.writeSafe: failed for ${key}`, e)
    }
    return false
  }
}

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`storage.readJSON: bad JSON in ${key}, resetting`, e)
    }
    return fallback
  }
}

export function loadSessions() {
  const raw = readJSON(KEY_SESSIONS, [])
  if (!Array.isArray(raw)) return []
  return raw
}

export function saveSessions(sessions) {
  return writeSafe(KEY_SESSIONS, sessions)
}

export function loadSettings() {
  const raw = readJSON(KEY_SETTINGS, null)
  return { ...DEFAULT_APP_SETTINGS, ...(raw || {}) }
}

export function saveSettings(settings) {
  return writeSafe(KEY_SETTINGS, settings)
}

export function loadSchemaVersion() {
  return readJSON(KEY_SCHEMA, 0)
}

export function saveSchemaVersion(v) {
  return writeSafe(KEY_SCHEMA, v)
}

/** Compute effective storage usage estimate, in bytes. */
export function estimateUsageBytes() {
  let total = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('spirituality:')) continue
      const v = localStorage.getItem(k) || ''
      total += k.length + v.length
    }
  } catch {}
  return total * 2 // UTF-16 in browsers
}

/** Compute summary statistics for a session.
 *
 * @param {import('./schema.js').Session} session
 * @returns {import('./schema.js').SessionSummary}
 */
export function summarizeSession(session) {
  // Count correct/revealed across THIS session only (for the per-session card).
  const { k, n } = aggregateRounds(session.rounds)
  const accuracy = n === 0 ? 0 : k / n
  const prob = spiritualityProbPointNull(k, n) ?? 0
  return {
    total: n,
    correct: k,
    accuracy,
    computedAt: Date.now(),
    spiritualityEffectiveProb: prob,
  }
}

/** Compute summary across ALL sessions (for the global gauge). */
export function summarizeAll(sessions) {
  let k = 0, n = 0
  for (const s of sessions) {
    const a = aggregateRounds(s.rounds)
    k += a.k
    n += a.n
  }
  const accuracy = n === 0 ? 0 : k / n
  const prob = spiritualityProbPointNull(k, n) ?? 0
  return { k, n, accuracy, spiritualityEffectiveProb: prob }
}

/** Export everything as a Blob suitable for download. */
export function exportAll() {
  const payload = {
    schemaVersion: 1,
    exportedAt: Date.now(),
    sessions: loadSessions(),
    settings: loadSettings(),
  }
  return new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
}

/** Clear every spirituality:* key. */
export function clearAll() {
  const keys = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('spirituality:')) keys.push(k)
    }
  } catch {}
  for (const k of keys) {
    try {
      localStorage.removeItem(k)
    } catch {}
  }
  return keys.length
}
