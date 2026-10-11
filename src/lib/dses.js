/**
 * DSES (Daily Spiritual Experience Scale) — scoring, provenance and storage.
 *
 * This module is intentionally self-contained and independent from the three
 * ability experiments: it never touches `spirituality:v1:*` or
 * `spirituality:v2:history`, and its scores are frequency self-reports only.
 * No psychic/paranormal ability is inferred and no high/mid/low band exists.
 *
 * Copyright & provenance
 * ----------------------
 * The DSES is © Lynn G. Underwood (https://www.dsescale.org/). The authoritative
 * item wording (including the introduction) lives only in the original English
 * PDF at `public/dses/DSES-original-en.pdf`, downloaded from the author's site.
 * The Chinese strings here are *thematic paraphrases for guidance only* — they
 * are NOT a validated Chinese translation and must never be treated as the
 * questionnaire itself. The author's site requires registration / permission
 * before use; this project does not claim that a licence has been acquired.
 *
 * Scoring follows the author's January 2022 update (verified, non-reversed):
 *   - items 1..15 : 1 Never, 2 Once in a while, 3 Some days, 4 Most days,
 *                   5 Every day, 6 Many times a day
 *   - item 16     : 1 Not at all, 3 Somewhat close, 5 Very close,
 *                   6 As close as possible
 * A higher mean means a more frequently reported experience; blank answers are
 * `null` (never 0) and the mean is taken over answered items only.
 *
 * Exports
 * -------
 * Constants : DSES_STORAGE_KEY, DSES_DRAFT_STORAGE_KEY, DSES_SCHEMA_VERSION,
 *             DSES_METHOD, DSES_LANGUAGE, DSES_VALIDATED_CHINESE_TRANSLATION,
 *             DSES_ITEM_COUNT, DSES_PDF, DSES_MAIN_OPTIONS, DSES_FINAL_OPTIONS,
 *             DSES_ITEM_THEMES
 * Helpers   : answerOptionsFor, isValidAnswer, sanitizeAnswers, validateAnswers,
 *             hasAnyAnswer, computeDsesScore, createDsesRecord, sanitizeRecord,
 *             sanitizeRecords, mergeDsesRecords
 * Storage   : loadDsesRecords, saveDsesRecords, clearDsesRecords,
 *             exportDsesRecords, parseDsesRecords,
 *             loadDsesDraft, saveDsesDraft, clearDsesDraft
 */

/** Independent finished-record storage namespace. */
export const DSES_STORAGE_KEY = 'spirituality:v2:dses'

/** Optional local draft for an unfinished answer sheet. */
export const DSES_DRAFT_STORAGE_KEY = 'spirituality:v2:dses:draft'

/** Schema version for the exported / persisted record payload. */
export const DSES_SCHEMA_VERSION = 1

/** Verified scoring method identifier (January 2022 update). */
export const DSES_METHOD = 'underwood-2022'

/** Original wording is English; Chinese text is guidance only. */
export const DSES_LANGUAGE = 'en-with-zh-guidance'

/** This project has not obtained or verified a Chinese translation. */
export const DSES_VALIDATED_CHINESE_TRANSLATION = false

/** Number of items in the scale. */
export const DSES_ITEM_COUNT = 16

/** Original PDF provenance (local copy is byte-for-byte unmodified). */
export const DSES_PDF = Object.freeze({
  path: '/dses/DSES-original-en.pdf',
  sourceUrl: 'https://www.dsescale.org/DSES.pdf',
  officialSite: 'https://www.dsescale.org/',
  translationsUrl: 'https://www.dsescale.org/translations/',
  scoringUrl:
    'https://www.dsescale.org/scoring-of-the-daily-spiritual-experience-scale/',
  downloadedAt: '2026-10-10',
  bytes: 74218,
  sha256: '62AF1FD5F36EC6D71812942FD008426C5948F47DF62D039AA34D54589D47A181',
  copyrightHolder: 'Lynn G. Underwood',
})

/**
 * Shared choices for items 1..15. `value` is the score.
 * Chinese labels are answer-sheet guidance, not translated item wording.
 */
export const DSES_MAIN_OPTIONS = Object.freeze([
  Object.freeze({ value: 1, zh: '从未', en: 'Never' }),
  Object.freeze({ value: 2, zh: '偶尔', en: 'Once in a while' }),
  Object.freeze({ value: 3, zh: '有些日子', en: 'Some days' }),
  Object.freeze({ value: 4, zh: '大多数日子', en: 'Most days' }),
  Object.freeze({ value: 5, zh: '每天', en: 'Every day' }),
  Object.freeze({ value: 6, zh: '每天多次', en: 'Many times a day' }),
])

/** Special choices for item 16 (non-contiguous scores). */
export const DSES_FINAL_OPTIONS = Object.freeze([
  Object.freeze({ value: 1, zh: '完全不亲近', en: 'Not at all' }),
  Object.freeze({ value: 3, zh: '有些亲近', en: 'Somewhat close' }),
  Object.freeze({ value: 5, zh: '很亲近', en: 'Very close' }),
  Object.freeze({ value: 6, zh: '尽可能亲近', en: 'As close as possible' }),
])

/**
 * Brief Chinese *topic* summaries, one per original item number (index 0 = item 1).
 * These are paraphrased themes to help orientation only: they are not item
 * wording, are not a validated translation, and must not replace the PDF.
 */
export const DSES_ITEM_THEMES = Object.freeze([
  '神圣的临在感',
  '与生命的联结',
  '超越日常烦忧的喜悦',
  '精神力量',
  '安慰',
  '内在平静与和谐',
  '日常中的求助',
  '日常中的引导',
  '直接感受到的神圣之爱',
  '通过他人感受到的爱',
  '自然之美的触动',
  '感恩',
  '无私的关爱',
  '接纳他人',
  '与神圣更亲近的愿望',
  '整体亲近程度',
])

const MAIN_VALUES = Object.freeze(DSES_MAIN_OPTIONS.map((o) => o.value))
const FINAL_VALUES = Object.freeze(DSES_FINAL_OPTIONS.map((o) => o.value))

// ---------------------------------------------------------------------------
// Answer validation / sanitization
// ---------------------------------------------------------------------------

/** Options to render for a 0-based item index. */
export function answerOptionsFor(index) {
  return index === DSES_ITEM_COUNT - 1 ? DSES_FINAL_OPTIONS : DSES_MAIN_OPTIONS
}

/** True when `value` is a valid score for 0-based item `index`. */
export function isValidAnswer(index, value) {
  if (!Number.isInteger(index) || index < 0 || index >= DSES_ITEM_COUNT) return false
  if (index === DSES_ITEM_COUNT - 1) return FINAL_VALUES.includes(value)
  return MAIN_VALUES.includes(value)
}

/**
 * Coerce any input into a length-16 array where every entry is either a valid
 * score or `null`. Blank / `0` / out-of-range / non-integer values become
 * `null` (never 0). Never throws.
 */
export function sanitizeAnswers(answers) {
  const src = Array.isArray(answers) ? answers : []
  const out = new Array(DSES_ITEM_COUNT).fill(null)
  for (let i = 0; i < DSES_ITEM_COUNT; i += 1) {
    const v = src[i]
    if (v === null || v === undefined || v === '') continue
    if (isValidAnswer(i, v)) out[i] = v
  }
  return out
}

/**
 * Strictly validate an answers array; throws an Error describing the problem.
 * Requires exactly 16 entries, each `null` or a valid in-range score.
 */
export function validateAnswers(answers, at = 'answers') {
  if (!Array.isArray(answers)) throw new Error(`${at} 必须为数组`)
  if (answers.length !== DSES_ITEM_COUNT) {
    throw new Error(`${at} 必须为 ${DSES_ITEM_COUNT} 项（当前 ${answers.length} 项）`)
  }
  answers.forEach((v, i) => {
    if (v === null || v === undefined) return
    if (i === DSES_ITEM_COUNT - 1) {
      if (!FINAL_VALUES.includes(v)) {
        throw new Error(`${at}[${i}] 第 16 题只允许 1/3/5/6，收到 ${String(v)}`)
      }
    } else if (!MAIN_VALUES.includes(v)) {
      throw new Error(`${at}[${i}] 第 ${i + 1} 题只允许 1-6，收到 ${String(v)}`)
    }
  })
  return answers
}

/** True when at least one item has a valid non-null answer. */
export function hasAnyAnswer(answers) {
  return computeDsesScore(answers).answered > 0
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute the scale score over answered items only.
 *
 * @returns {{ answered: number, missing: number, sum: number, mean: number|null }}
 *   `mean` is `null` when nothing was answered (zero answers never scores).
 */
export function computeDsesScore(answers) {
  const clean = sanitizeAnswers(answers)
  let answered = 0
  let sum = 0
  for (let i = 0; i < DSES_ITEM_COUNT; i += 1) {
    if (clean[i] == null) continue
    answered += 1
    sum += clean[i]
  }
  return {
    answered,
    missing: DSES_ITEM_COUNT - answered,
    sum,
    mean: answered > 0 ? sum / answered : null,
  }
}

// ---------------------------------------------------------------------------
// Record construction / sanitization
// ---------------------------------------------------------------------------

function makeId() {
  try {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fall through
  }
  return `dses-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Build a finished record. Returns `null` when nothing was answered (so an
 * all-blank sheet is never scored or saved). Aggregate values are deliberately
 * NOT stored — they are always recomputed from `answers`.
 */
export function createDsesRecord(answers, { id, createdAt } = {}) {
  const clean = sanitizeAnswers(answers)
  if (computeDsesScore(clean).answered === 0) return null
  return {
    schemaVersion: DSES_SCHEMA_VERSION,
    method: DSES_METHOD,
    language: DSES_LANGUAGE,
    validatedChineseTranslation: DSES_VALIDATED_CHINESE_TRANSLATION,
    id: typeof id === 'string' && id.length > 0 ? id : makeId(),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    answers: clean,
  }
}

/**
 * Loosely sanitize a stored record (write/load path): requires a string id, a
 * length-16 answers array with at least one answer, and coerces invalid entries
 * to `null`. Returns `null` for unusable input.
 */
export function sanitizeRecord(record) {
  if (!record || typeof record !== 'object') return null
  if (typeof record.id !== 'string' || record.id.length === 0) return null
  if (!Array.isArray(record.answers) || record.answers.length !== DSES_ITEM_COUNT) return null
  const answers = sanitizeAnswers(record.answers)
  if (computeDsesScore(answers).answered === 0) return null
  return {
    schemaVersion: DSES_SCHEMA_VERSION,
    method: DSES_METHOD,
    language: DSES_LANGUAGE,
    validatedChineseTranslation: DSES_VALIDATED_CHINESE_TRANSLATION,
    id: record.id,
    createdAt: Number.isFinite(record.createdAt) ? record.createdAt : null,
    answers,
  }
}

/** Sanitize a list, dropping unusable entries. */
export function sanitizeRecords(records) {
  if (!Array.isArray(records)) return []
  return records.map(sanitizeRecord).filter(Boolean)
}

function newestFirst(a, b) {
  return (b.createdAt ?? 0) - (a.createdAt ?? 0)
}

function answeredCount(record) {
  return computeDsesScore(record.answers).answered
}

/**
 * Merge collections by id. For a duplicate id the record with the newer
 * `createdAt` wins; ties keep the one with more answers, then the existing one.
 */
export function mergeDsesRecords(existing, incoming) {
  const byId = new Map()
  for (const rec of sanitizeRecords(existing)) byId.set(rec.id, rec)
  for (const rec of sanitizeRecords(incoming)) {
    const prev = byId.get(rec.id)
    if (!prev) {
      byId.set(rec.id, rec)
      continue
    }
    const prevTime = prev.createdAt ?? 0
    const nextTime = rec.createdAt ?? 0
    if (nextTime > prevTime) byId.set(rec.id, rec)
    else if (nextTime === prevTime && answeredCount(rec) > answeredCount(prev)) {
      byId.set(rec.id, rec)
    }
  }
  return [...byId.values()].sort(newestFirst)
}

// ---------------------------------------------------------------------------
// Safe storage primitives (independent of the experiment history namespace)
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
      console.warn(`dses: unreadable data in ${key}`, e)
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
      console.warn(`dses: failed to write ${key}`, e)
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
// Public storage API
// ---------------------------------------------------------------------------

/** Load sanitized finished records, newest first. Safe on malformed storage. */
export function loadDsesRecords() {
  const raw = readJSONSafe(DSES_STORAGE_KEY, [])
  if (!Array.isArray(raw)) return []
  return sanitizeRecords(raw).sort(newestFirst)
}

/** Persist only sanitized records. Returns success boolean. */
export function saveDsesRecords(records) {
  return writeJSONSafe(DSES_STORAGE_KEY, sanitizeRecords(records))
}

/** True when the finished-record key exists (used to surface storage state). */
export function hasStoredDsesRecords() {
  const storage = getStorage()
  if (!storage) return false
  try {
    return storage.getItem(DSES_STORAGE_KEY) != null
  } catch {
    return false
  }
}

/** Remove only the DSES key. v1 / history keys are untouched. */
export function clearDsesRecords() {
  return removeSafe(DSES_STORAGE_KEY)
}

/** Build a JSON Blob for download (schemaVersion + method + records only). */
export function exportDsesRecords(records) {
  const payload = {
    schemaVersion: DSES_SCHEMA_VERSION,
    method: DSES_METHOD,
    language: DSES_LANGUAGE,
    validatedChineseTranslation: DSES_VALIDATED_CHINESE_TRANSLATION,
    exportedAt: Date.now(),
    records: sanitizeRecords(records).map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      answers: r.answers,
    })),
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

function fail(message) {
  throw new Error(message)
}

function validateRecordStrict(record, i) {
  const at = `records[${i}]`
  if (!record || typeof record !== 'object') fail(`${at} 格式错误`)
  if (typeof record.id !== 'string' || record.id.length === 0) fail(`${at}.id 无效`)
  if (!Number.isFinite(record.createdAt)) fail(`${at}.createdAt 无效`)
  if (record.method !== undefined && record.method !== DSES_METHOD) {
    fail(`${at}.method 必须为 ${DSES_METHOD}`)
  }
  if (record.schemaVersion !== undefined && record.schemaVersion !== DSES_SCHEMA_VERSION) {
    fail(`${at}.schemaVersion 必须为 ${DSES_SCHEMA_VERSION}`)
  }
  validateAnswers(record.answers, `${at}.answers`)
  const answers = sanitizeAnswers(record.answers)
  if (computeDsesScore(answers).answered === 0) fail(`${at} 没有有效作答`)
  return {
    schemaVersion: DSES_SCHEMA_VERSION,
    method: DSES_METHOD,
    language: DSES_LANGUAGE,
    validatedChineseTranslation: DSES_VALIDATED_CHINESE_TRANSLATION,
    id: record.id,
    createdAt: record.createdAt,
    answers,
  }
}

/**
 * Strictly parse an exported DSES payload (JSON string or object).
 *
 * Requires an explicit `schemaVersion`, `method === 'underwood-2022'` and a
 * records array whose answers are valid; aggregate values (if any) are ignored
 * and recomputed from the answers. Throws on any violation.
 */
export function parseDsesRecords(text) {
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

  if (!data || typeof data !== 'object') fail('导入失败：格式错误')
  if (data.schemaVersion !== DSES_SCHEMA_VERSION) {
    fail(`导入失败：需要 schemaVersion ${DSES_SCHEMA_VERSION}`)
  }
  if (data.method !== DSES_METHOD) fail(`导入失败：需要 method ${DSES_METHOD}`)
  if (!Array.isArray(data.records)) fail('导入失败：缺少 records 数组')

  const parsed = data.records.map((r, i) => validateRecordStrict(r, i))
  return mergeDsesRecords([], parsed)
}

// ---------------------------------------------------------------------------
// Optional local draft
// ---------------------------------------------------------------------------

/** Load a saved draft answers array (sanitized), or an all-null 16-array. */
export function loadDsesDraft() {
  const raw = readJSONSafe(DSES_DRAFT_STORAGE_KEY, null)
  if (raw && typeof raw === 'object' && Array.isArray(raw.answers)) {
    return sanitizeAnswers(raw.answers)
  }
  return new Array(DSES_ITEM_COUNT).fill(null)
}

/** Persist a draft locally. Never uploads. Returns success boolean. */
export function saveDsesDraft(answers) {
  return writeJSONSafe(DSES_DRAFT_STORAGE_KEY, {
    schemaVersion: DSES_SCHEMA_VERSION,
    savedAt: Date.now(),
    answers: sanitizeAnswers(answers),
  })
}

/** Remove the local draft. Returns success boolean. */
export function clearDsesDraft() {
  return removeSafe(DSES_DRAFT_STORAGE_KEY)
}
