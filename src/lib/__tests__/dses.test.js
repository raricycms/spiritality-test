import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DSES_STORAGE_KEY,
  DSES_SCHEMA_VERSION,
  DSES_METHOD,
  DSES_ITEM_COUNT,
  DSES_MAIN_OPTIONS,
  DSES_FINAL_OPTIONS,
  isValidAnswer,
  sanitizeAnswers,
  validateAnswers,
  computeDsesScore,
  createDsesRecord,
  mergeDsesRecords,
  loadDsesRecords,
  saveDsesRecords,
  clearDsesRecords,
  exportDsesRecords,
  parseDsesRecords,
  saveDsesDraft,
  loadDsesDraft,
  clearDsesDraft,
} from '../dses.js'

function fullAnswers() {
  return [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 1, 2, 3, 5]
}

function blobText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe('DSES scoring — verified January 2022 (non-reversed)', () => {
  it('exposes the expected answer scales and 16 themes', () => {
    expect(DSES_MAIN_OPTIONS.map((o) => o.value)).toEqual([1, 2, 3, 4, 5, 6])
    expect(DSES_FINAL_OPTIONS.map((o) => o.value)).toEqual([1, 3, 5, 6])
    expect(DSES_ITEM_COUNT).toBe(16)
  })

  it('computes the mean over all 16 answered items', () => {
    // sum = 53 across 16 items
    const score = computeDsesScore(fullAnswers())
    expect(score.answered).toBe(16)
    expect(score.missing).toBe(0)
    expect(score.sum).toBe(53)
    expect(score.mean).toBeCloseTo(53 / 16, 10)
  })

  it('maps item 16 only onto 1/3/5/6 and rejects 2/4 there', () => {
    expect(isValidAnswer(15, 1)).toBe(true)
    expect(isValidAnswer(15, 3)).toBe(true)
    expect(isValidAnswer(15, 5)).toBe(true)
    expect(isValidAnswer(15, 6)).toBe(true)
    expect(isValidAnswer(15, 2)).toBe(false)
    expect(isValidAnswer(15, 4)).toBe(false)
    // Items 1..15 use the full 1..6 range.
    expect(isValidAnswer(14, 2)).toBe(true)
    expect(isValidAnswer(14, 4)).toBe(true)
    expect(isValidAnswer(0, 6)).toBe(true)

    const answers = new Array(16).fill(null)
    answers[15] = 2
    expect(() => validateAnswers(answers)).toThrow(/第 16 题/)
  })
})

describe('DSES missing answers — blank never scores as 0', () => {
  it('counts answered/missing and means over answered items only', () => {
    const answers = new Array(16).fill(null)
    answers[0] = 6
    answers[15] = 6
    const score = computeDsesScore(answers)
    expect(score.answered).toBe(2)
    expect(score.missing).toBe(14)
    expect(score.sum).toBe(12)
    expect(score.mean).toBe(6)
  })

  it('treats 0 / null / invalid entries as unanswered in scoring', () => {
    const answers = fullAnswers().slice()
    answers[0] = 0
    answers[1] = null
    const score = computeDsesScore(answers)
    expect(score.answered).toBe(14)
    expect(score.missing).toBe(2)
    // item 1 (value 1) and item 2 (value 2) were dropped.
    expect(score.sum).toBe(53 - 1 - 2)
  })
})

describe('DSES no data / invalid values', () => {
  it('does not score or save an all-blank sheet', () => {
    const blank = new Array(16).fill(null)
    expect(computeDsesScore(blank)).toEqual({ answered: 0, missing: 16, sum: 0, mean: null })
    expect(computeDsesScore(new Array(16).fill(0)).mean).toBeNull()
    expect(createDsesRecord(blank)).toBeNull()
    expect(createDsesRecord(new Array(16).fill(0))).toBeNull()
  })

  it('rejects wrong length and out-of-range values', () => {
    expect(() => validateAnswers([1, 2, 3])).toThrow(/16 项/)
    const outOfRange = fullAnswers()
    outOfRange[3] = 7
    expect(() => validateAnswers(outOfRange)).toThrow(/第 4 题/)
    const zero = fullAnswers()
    zero[0] = 0
    expect(() => validateAnswers(zero)).toThrow(/第 1 题/)
  })

  it('sanitizes invalid entries to null without throwing', () => {
    const dirty = [0, 7, '3', 2.5, null, undefined, '', 6, 5, 4, 3, 2, 1, 5, 6, 2]
    const clean = sanitizeAnswers(dirty)
    expect(clean).toHaveLength(16)
    expect(clean.slice(0, 4)).toEqual([null, null, null, null])
    expect(clean.slice(4, 7)).toEqual([null, null, null])
    // index 7 (item 8) is a valid 6; index 15 (item 16) is an invalid 2 -> null
    expect(clean[7]).toBe(6)
    expect(clean[15]).toBeNull()
  })
})

describe('DSES independent persistence — sanitized and failure-aware', () => {
  it('round-trips sanitized records and derives scores from answers', () => {
    const record = createDsesRecord(fullAnswers(), { id: 'r1', createdAt: 1000 })
    expect(record.method).toBe(DSES_METHOD)
    expect(record.schemaVersion).toBe(DSES_SCHEMA_VERSION)
    expect(record).not.toHaveProperty('mean')

    expect(saveDsesRecords([record])).toBe(true)
    const loaded = loadDsesRecords()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('r1')
    expect(computeDsesScore(loaded[0].answers).mean).toBeCloseTo(53 / 16, 10)
  })

  it('clears only the DSES key and keeps other namespaces untouched', () => {
    localStorage.setItem('spirituality:v1:sessions', JSON.stringify([{ id: 'v1' }]))
    localStorage.setItem('spirituality:v2:history', JSON.stringify([{ id: 'h1' }]))
    saveDsesRecords([createDsesRecord(fullAnswers(), { id: 'r1' })])
    saveDsesDraft(fullAnswers())

    expect(clearDsesRecords()).toBe(true)
    expect(localStorage.getItem(DSES_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('spirituality:v1:sessions')).not.toBeNull()
    expect(localStorage.getItem('spirituality:v2:history')).not.toBeNull()
  })

  it('surfaces storage failure and malformed data instead of throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(saveDsesRecords([createDsesRecord(fullAnswers(), { id: 'r1' })])).toBe(false)
    spy.mockRestore()

    localStorage.setItem(DSES_STORAGE_KEY, '{not json')
    expect(loadDsesRecords()).toEqual([])
  })

  it('keeps its draft in a separate key', () => {
    saveDsesDraft([null, 6])
    expect(localStorage.getItem(DSES_STORAGE_KEY)).toBeNull()
    expect(loadDsesDraft()[1]).toBe(6)
    expect(loadDsesDraft()).toHaveLength(16)
    clearDsesDraft()
    expect(loadDsesDraft().every((v) => v === null)).toBe(true)
  })
})

describe('DSES import — strict validation and merge by id', () => {
  it('round-trips an exported payload and ignores arbitrary aggregate values', async () => {
    const record = createDsesRecord(fullAnswers(), { id: 'r1', createdAt: 1000 })
    const blob = exportDsesRecords([record])
    const payload = JSON.parse(await blobText(blob))
    expect(payload.schemaVersion).toBe(DSES_SCHEMA_VERSION)
    expect(payload.method).toBe(DSES_METHOD)

    // Tamper: add a bogus stored mean; parse must ignore it and recompute.
    payload.records[0].mean = 99
    const parsed = parseDsesRecords(JSON.stringify(payload))
    expect(parsed).toHaveLength(1)
    expect(parsed[0].answers).toHaveLength(16)
    expect(computeDsesScore(parsed[0].answers).mean).toBeCloseTo(53 / 16, 10)
    expect(parsed[0]).not.toHaveProperty('mean')
  })

  it('rejects wrong schemaVersion, wrong method and invalid answers', () => {
    const base = {
      schemaVersion: DSES_SCHEMA_VERSION,
      method: DSES_METHOD,
      records: [{ id: 'r1', createdAt: 1, answers: fullAnswers() }],
    }
    expect(() => parseDsesRecords(JSON.stringify({ ...base, schemaVersion: 2 }))).toThrow(/schemaVersion/)
    expect(() => parseDsesRecords(JSON.stringify({ ...base, method: 'old-reversed' }))).toThrow(/method/)

    const bad = JSON.parse(JSON.stringify(base))
    bad.records[0].answers[0] = 99
    expect(() => parseDsesRecords(JSON.stringify(bad))).toThrow(/第 1 题/)

    const short = JSON.parse(JSON.stringify(base))
    short.records[0].answers = [1, 2, 3]
    expect(() => parseDsesRecords(JSON.stringify(short))).toThrow(/16 项/)

    expect(() => parseDsesRecords('{not json')).toThrow(/JSON/)
  })

  it('merges records by id, keeping the newer createdAt', () => {
    const older = createDsesRecord(fullAnswers(), { id: 'dup', createdAt: 100 })
    const newer = createDsesRecord([...fullAnswers().slice(0, 15), 6], { id: 'dup', createdAt: 200 })
    const merged = mergeDsesRecords([older], [newer])
    expect(merged).toHaveLength(1)
    expect(merged[0].createdAt).toBe(200)
    expect(merged[0].answers[15]).toBe(6)
  })
})
