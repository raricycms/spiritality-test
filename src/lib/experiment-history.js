/**
 * v2 experiment history storage.
 *
 * Independent namespace `spirituality:v2:history`. Legacy v1 keys
 * (`spirituality:v1:*`) are never written or cleared here; `loadLegacyHistory()`
 * only *reads* them for the separate legacy section of the UI.
 *
 * Only sanitized terminal snapshots are persisted or exported:
 *   - session status must be COMPLETED or ABANDONED (waiting / in-progress
 *     sessions are dropped),
 *   - tokens, room codes, active-round state and any unknown server fields are
 *     never copied,
 *   - per-round targets are only kept for REVEALED rounds.
 *
 * All localStorage access is wrapped so storage failures (disabled storage,
 * quota, malformed JSON) degrade to safe defaults instead of throwing.
 */

import { DEFAULT_CHANCE_BASELINE, dedupeSessions, isSupportedSession } from './experiment-statistics.js'
import { loadSessions as loadLegacyV1Sessions } from './storage.js'
import { CANDIDATE_SET_IDS } from '../../shared/candidate-sets.js'

/** Independent v2 storage namespace. */
export const HISTORY_STORAGE_KEY = 'spirituality:v2:history'

/** Export schema version. */
export const HISTORY_SCHEMA_VERSION = 2

export const EXPERIMENT_TYPES = Object.freeze(['hidden', 'precognition', 'telepathy'])
export const TERMINAL_SESSION_STATUSES = Object.freeze(['COMPLETED', 'ABANDONED'])
export const ROUND_STATUSES = Object.freeze([
  'TARGET_READY',
  'SENDING',
  'GUESSING',
  'LOCKED',
  'REVEALED',
  'ABANDONED',
])
export const ROUND_CONDITIONS = Object.freeze(['sending', 'control'])

const TIMESTAMP_FIELDS = [
  'createdAt',
  'targetGeneratedAt',
  'guessLockedAt',
  'revealedAt',
  'sendingEndsAt',
  'revealAt',
]

// ---------------------------------------------------------------------------
// Safe storage primitives
// ---------------------------------------------------------------------------

function getStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage
  } catch {
    // Accessing localStorage can throw in hardened environments.
  }
  return null
}

function readJSONSafe(key, fallback) {
  const storage = getStorage()
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`experiment-history: unreadable data in ${key}`, e)
    }
    return fallback
  }
}

function writeJSONSafe(key, value) {
  const storage = getStorage()
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`experiment-history: failed to write ${key}`, e)
    }
    return false
  }
}

function removeSafe(key) {
  const storage = getStorage()
  if (!storage) return false
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Sanitization (write path)
// ---------------------------------------------------------------------------

/** A digit guess/target must be an integer in 1..5. */
export function isValidDigit(v) {
  return Number.isInteger(v) && v >= 1 && v <= 5
}

function isValidBaseline(v) {
  return Number.isFinite(v) && v > 0 && v < 1
}

/** Keep only known settings fields; returns undefined when empty. */
function sanitizeSettings(settings) {
  if (!settings || typeof settings !== 'object') return undefined
  const out = {}
  if (CANDIDATE_SET_IDS.includes(settings.candidateSet)) out.candidateSet = settings.candidateSet
  if (Number.isFinite(settings.roundsPerSession)) out.roundsPerSession = settings.roundsPerSession
  if (Number.isFinite(settings.sendingDurationMs)) out.sendingDurationMs = settings.sendingDurationMs
  if (Number.isFinite(settings.answerDurationMs)) out.answerDurationMs = settings.answerDurationMs
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Whitelist a single round for persistence.
 * Targets are only retained once the round is REVEALED.
 */
export function sanitizeRound(round) {
  if (!round || typeof round !== 'object') return null
  if (!ROUND_STATUSES.includes(round.status)) return null
  if (typeof round.id !== 'string' || round.id.length === 0) return null

  const out = {
    id: round.id,
    index: Number.isFinite(round.index) ? round.index : 0,
    status: round.status,
  }

  for (const field of TIMESTAMP_FIELDS) {
    if (Number.isFinite(round[field])) out[field] = round[field]
  }

  if (isValidDigit(round.guess)) out.guess = round.guess
  else if (round.guess === null || round.guess === undefined) out.guess = null

  if (typeof round.correct === 'boolean') out.correct = round.correct
  else if (round.correct === null || round.correct === undefined) out.correct = null

  if (Number.isFinite(round.confidence) && round.confidence >= 0 && round.confidence <= 100) {
    out.confidence = round.confidence
  } else if (round.confidence === null || round.confidence === undefined) {
    out.confidence = null
  }

  if (round.status === 'REVEALED' && isValidDigit(round.target)) out.target = round.target

  if (ROUND_CONDITIONS.includes(round.condition)) out.condition = round.condition

  if (typeof round.invalidReason === 'string') out.invalidReason = round.invalidReason

  return out
}

/**
 * Build a safe, whitelisted terminal snapshot.
 * Returns null when the session is not a valid terminal protocol-2 session.
 * Never copies `token`, `roomCode`, `activeRound` or unknown fields.
 */
export function sanitizeSession(session) {
  if (!session || typeof session !== 'object') return null
  if (!isSupportedSession(session)) return null
  if (!TERMINAL_SESSION_STATUSES.includes(session.status)) return null
  if (!EXPERIMENT_TYPES.includes(session.experimentType)) return null
  if (typeof session.id !== 'string' || session.id.length === 0) return null

  const out = {
    id: session.id,
    experimentType: session.experimentType,
    protocolVersion: session.protocolVersion,
    chanceBaseline: session.protocolVersion === 3 ? null : isValidBaseline(session.chanceBaseline)
      ? session.chanceBaseline
      : DEFAULT_CHANCE_BASELINE,
    status: session.status,
    createdAt: Number.isFinite(session.createdAt) ? session.createdAt : null,
    completedAt: Number.isFinite(session.completedAt) ? session.completedAt : null,
    rounds: (Array.isArray(session.rounds) ? session.rounds : [])
      .map(sanitizeRound)
      .filter(Boolean),
  }

  if (typeof session.role === 'string') out.role = session.role
  const settings = sanitizeSettings(session.settings)
  if (settings) out.settings = settings

  return out
}

/** Sanitize a list, dropping non-terminal / invalid entries. */
export function sanitizeSessions(sessions) {
  if (!Array.isArray(sessions)) return []
  return sessions.map(sanitizeSession).filter(Boolean)
}

function newestFirst(a, b) {
  return (b.completedAt ?? b.createdAt ?? 0) - (a.completedAt ?? a.createdAt ?? 0)
}

// ---------------------------------------------------------------------------
// Public storage API
// ---------------------------------------------------------------------------

/** Load sanitized v2 history (safe on malformed / missing storage). */
export function loadExperimentHistory() {
  const raw = readJSONSafe(HISTORY_STORAGE_KEY, [])
  if (!Array.isArray(raw)) return []
  return sanitizeSessions(raw).sort(newestFirst)
}

/** Persist only sanitized terminal snapshots. Returns success boolean. */
export function saveExperimentHistory(sessions) {
  return writeJSONSafe(HISTORY_STORAGE_KEY, sanitizeSessions(sessions))
}

/**
 * Merge two collections, deduplicating by id. Newer/longer/terminal data wins
 * (via `dedupeSessions`), so a later refresh cannot regress a longer record.
 */
export function mergeExperimentHistory(existing, incoming) {
  const merged = dedupeSessions([
    ...sanitizeSessions(existing),
    ...sanitizeSessions(incoming),
  ])
  return merged.sort(newestFirst)
}

/** Remove the v2 history key. v1 keys are untouched. Returns success boolean. */
export function clearExperimentHistory() {
  return removeSafe(HISTORY_STORAGE_KEY)
}

/** Build a JSON Blob for download. Contains schemaVersion:2 and sessions only. */
export function exportExperimentHistory(sessions) {
  const payload = {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    exportedAt: Date.now(),
    sessions: sanitizeSessions(sessions),
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

// ---------------------------------------------------------------------------
// Strict import validation (read path)
// ---------------------------------------------------------------------------

function fail(message) {
  throw new Error(message)
}

function requireTrue(cond, message) {
  if (!cond) fail(message)
}

function validateRound(round, at) {
  requireTrue(round && typeof round === 'object', `${at} 格式错误`)
  requireTrue(typeof round.id === 'string' && round.id.length > 0, `${at}.id 无效`)
  requireTrue(Number.isInteger(round.index) && round.index >= 0, `${at}.index 无效`)
  requireTrue(ROUND_STATUSES.includes(round.status), `${at}.status 无效`)

  if (round.guess !== null && round.guess !== undefined) {
    requireTrue(isValidDigit(round.guess), `${at}.guess 必须为 1-5 的整数或 null`)
  }
  if (round.target !== null && round.target !== undefined) {
    requireTrue(isValidDigit(round.target), `${at}.target 必须为 1-5 的整数或 null`)
  }
  if (round.condition !== null && round.condition !== undefined) {
    requireTrue(ROUND_CONDITIONS.includes(round.condition), `${at}.condition 无效`)
  }
  if (round.correct !== null && round.correct !== undefined) {
    requireTrue(typeof round.correct === 'boolean', `${at}.correct 必须为布尔或 null`)
  }
  if (round.confidence !== null && round.confidence !== undefined) {
    requireTrue(
      Number.isFinite(round.confidence) && round.confidence >= 0 && round.confidence <= 100,
      `${at}.confidence 必须为 0-100 或 null`,
    )
  }
  for (const field of TIMESTAMP_FIELDS) {
    if (round[field] !== null && round[field] !== undefined) {
      requireTrue(Number.isFinite(round[field]), `${at}.${field} 无效`)
    }
  }
  requireTrue(['REVEALED', 'ABANDONED'].includes(round.status), `${at}.status 必须为终态`)
  if (round.status === 'REVEALED') {
    requireTrue(isValidDigit(round.guess), `${at}.guess 必须为 1-5 的整数`)
    requireTrue(isValidDigit(round.target), `${at}.target 必须为 1-5 的整数`)
    requireTrue(round.correct === (round.guess === round.target), `${at}.correct 与答案不一致`)
  } else {
    requireTrue(round.correct == null, `${at}.correct 作废轮不能计分`)
  }
  return round
}

function validateSession(session, i) {
  const at = `sessions[${i}]`
  requireTrue(session && typeof session === 'object', `${at} 格式错误`)
  requireTrue(typeof session.id === 'string' && session.id.length > 0, `${at}.id 无效`)
  requireTrue(EXPERIMENT_TYPES.includes(session.experimentType), `${at}.experimentType 无效`)
  requireTrue(isSupportedSession(session), `${at}.protocolVersion 必须为 2 或双人协议 3`)
  if (session.settings?.candidateSet !== undefined) {
    requireTrue(CANDIDATE_SET_IDS.includes(session.settings.candidateSet), `${at}.settings.candidateSet 无效`)
  }
  requireTrue(Array.isArray(session.rounds), `${at}.rounds 必须为数组`)
  if (session.protocolVersion === 3) {
    requireTrue(session.chanceBaseline == null, `${at}.chanceBaseline 自选模式必须为空`)
    requireTrue(session.rounds.every(r => r?.condition == null || r.condition === 'sending'), `${at}.condition 自选模式不能包含对照轮`)
  }
  requireTrue(
    TERMINAL_SESSION_STATUSES.includes(session.status),
    `${at}.status 必须为终态（COMPLETED/ABANDONED），不接受未完成的伪造会话`,
  )
  if (session.chanceBaseline !== null && session.chanceBaseline !== undefined) {
    requireTrue(isValidBaseline(session.chanceBaseline), `${at}.chanceBaseline 无效`)
  }

  const rounds = session.rounds.map((r, j) => validateRound(r, `${at}.rounds[${j}]`))
  requireTrue(new Set(rounds.map((r) => r.id)).size === rounds.length, `${at}.rounds 存在重复 id`)
  requireTrue(new Set(rounds.map((r) => r.index)).size === rounds.length, `${at}.rounds 存在重复 index`)
  const clean = sanitizeSession({ ...session, rounds })
  requireTrue(clean, `${at} 无法通过安全化`)
  return clean
}

/**
 * Strictly parse an exported history payload.
 *
 * Accepts a JSON string or an already-parsed object; requires schemaVersion 2
 * and a sessions array. Any session that is not a valid terminal protocol-2
 * snapshot (or that carries an out-of-range digit/condition) rejects the whole
 * import with an Error. Returns sanitized, deduplicated sessions.
 */
export function parseExperimentHistory(text) {
  let data
  if (typeof text === 'string') {
    try {
      data = JSON.parse(text)
    } catch {
      fail('导入失败：不是有效的 JSON')
    }
  } else if (text && typeof text === 'object') {
    data = text
  } else {
    fail('导入失败：内容为空')
  }

  requireTrue(data && typeof data === 'object', '导入失败：格式错误')
  requireTrue(
    data.schemaVersion === HISTORY_SCHEMA_VERSION,
    `导入失败：需要 schemaVersion ${HISTORY_SCHEMA_VERSION}`,
  )
  requireTrue(Array.isArray(data.sessions), '导入失败：缺少 sessions 数组')

  const result = data.sessions.map((s, i) => validateSession(s, i))
  return dedupeSessions(result).sort(newestFirst)
}

// ---------------------------------------------------------------------------
// Legacy (v1) read-only access
// ---------------------------------------------------------------------------

/**
 * Read the existing v1 sessions for the separate legacy section.
 * Performs a read-only mapping (no v1 key is written or removed) and drops
 * unknown fields; each record is flagged with `protocolVersion: 1`.
 */
export function loadLegacyHistory() {
  let sessions
  try {
    sessions = loadLegacyV1Sessions()
  } catch {
    return []
  }
  if (!Array.isArray(sessions)) return []

  return sessions
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({
      id: typeof s.id === 'string' ? s.id : undefined,
      protocolVersion: 1,
      legacy: true,
      status: typeof s.status === 'string' ? s.status : null,
      createdAt: Number.isFinite(s.createdAt) ? s.createdAt : null,
      completedAt: Number.isFinite(s.completedAt) ? s.completedAt : null,
      rounds: Array.isArray(s.rounds)
        ? s.rounds.map((r) => ({
            id: r && r.id,
            index: r && r.index,
            status: r && r.status,
            correct: r && typeof r.correct === 'boolean' ? r.correct : null,
            target: r && r.status === 'REVEALED' ? r.target : undefined,
          }))
        : [],
    }))
}
