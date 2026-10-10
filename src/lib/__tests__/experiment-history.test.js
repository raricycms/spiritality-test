import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadExperimentHistory,
  saveExperimentHistory,
  mergeExperimentHistory,
  clearExperimentHistory,
  exportExperimentHistory,
  parseExperimentHistory,
  loadLegacyHistory,
  HISTORY_STORAGE_KEY,
} from '../experiment-history.js'

function blobText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

function terminalSession(overrides = {}) {
  return {
    id: 's1',
    experimentType: 'hidden',
    protocolVersion: 2,
    chanceBaseline: 0.2,
    status: 'COMPLETED',
    createdAt: 1000,
    completedAt: 2000,
    role: 'receiver',
    token: 'super-secret-token',
    roomCode: 'ABC123',
    activeRound: { id: 'r1', target: 4 },
    settings: { roundsPerSession: 30, sendingDurationMs: 15000, answerDurationMs: 15000 },
    rounds: [
      { id: 'r0', index: 0, status: 'REVEALED', correct: true, target: 3, guess: 3, revealedAt: 1500 },
      { id: 'r1', index: 1, status: 'ABANDONED', correct: null, target: null, guess: null },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

it('retains candidate sets through export/import and rejects unknown sets', async () => {
  const s = terminalSession({ settings: { roundsPerSession: 5, candidateSet: 'directions' } })
  const parsed = parseExperimentHistory(await blobText(exportExperimentHistory([s])))
  expect(parsed[0].settings.candidateSet).toBe('directions')
  expect(() => parseExperimentHistory({ schemaVersion: 2, sessions: [{ ...s, settings: { candidateSet: 'unknown' } }] })).toThrow(/candidateSet/)
})

it('retains v3 sender-choice records through save, export and strict import', async () => {
  const chosen = terminalSession({ experimentType: 'telepathy', protocolVersion: 3, chanceBaseline: null })
  saveExperimentHistory([chosen])
  expect(loadExperimentHistory()[0].protocolVersion).toBe(3)
  const records = parseExperimentHistory(await blobText(exportExperimentHistory([chosen])))
  expect(records[0].chanceBaseline).toBeNull()
  expect(records[0].rounds[0].target).toBe(3)
})

describe('experiment-history — persistence safety', () => {
  it('persists only sanitized terminal snapshots without tokens/room codes', () => {
    const active = terminalSession({ id: 'active', status: 'IN_PROGRESS', completedAt: null })
    saveExperimentHistory([terminalSession(), active])

    const stored = loadExperimentHistory()
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe('s1')

    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    expect(raw).not.toContain('super-secret-token')
    expect(raw).not.toContain('roomCode')
    expect(raw).not.toContain('activeRound')
    // Non-revealed targets are not persisted.
    expect(stored[0].rounds.find((r) => r.id === 'r1').target).toBeUndefined()
  })

  it('export Blob is schemaVersion 2 and excludes credentials', async () => {
    const blob = exportExperimentHistory([terminalSession(), terminalSession({ id: 'x', status: 'WAITING' })])
    const text = await blobText(blob)
    const payload = JSON.parse(text)

    expect(payload.schemaVersion).toBe(2)
    expect(payload.sessions).toHaveLength(1)
    expect(text).not.toContain('super-secret-token')
    expect(text).not.toContain('ABC123')
  })

  it('clearExperimentHistory removes only the v2 key', () => {
    localStorage.setItem('spirituality:v1:sessions', JSON.stringify([{ id: 'v1' }]))
    saveExperimentHistory([terminalSession()])
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).not.toBe(null)

    clearExperimentHistory()
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBe(null)
    expect(localStorage.getItem('spirituality:v1:sessions')).not.toBe(null)
  })

  it('mergeExperimentHistory deduplicates and keeps the longer record', () => {
    const short = terminalSession({ id: 'dup', rounds: [{ id: 'r0', index: 0, status: 'REVEALED', correct: true, target: 1, guess: 1 }] })
    const long = terminalSession({
      id: 'dup',
      rounds: [
        { id: 'r0', index: 0, status: 'REVEALED', correct: true, target: 1, guess: 1 },
        { id: 'r1', index: 1, status: 'REVEALED', correct: false, target: 2, guess: 3 },
      ],
    })
    const merged = mergeExperimentHistory([short], [long])
    expect(merged).toHaveLength(1)
    expect(merged[0].rounds).toHaveLength(2)
  })
})

describe('parseExperimentHistory — strict validation', () => {
  it('round-trips a valid exported payload', async () => {
    const text = await blobText(exportExperimentHistory([terminalSession()]))
    const sessions = parseExperimentHistory(text)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('s1')
  })

  it('rejects incomplete sessions', () => {
    const payload = {
      schemaVersion: 2,
      sessions: [terminalSession({ status: 'IN_PROGRESS' })],
    }
    expect(() => parseExperimentHistory(JSON.stringify(payload))).toThrow(/终态/)
  })

  it('rejects invalid digit guesses and targets', () => {
    const badGuess = {
      schemaVersion: 2,
      sessions: [terminalSession({ rounds: [{ id: 'r0', index: 0, status: 'REVEALED', correct: false, target: 3, guess: 9 }] })],
    }
    expect(() => parseExperimentHistory(JSON.stringify(badGuess))).toThrow(/guess/)

    const badTarget = {
      schemaVersion: 2,
      sessions: [terminalSession({ rounds: [{ id: 'r0', index: 0, status: 'LOCKED', correct: null, target: 7 }] })],
    }
    expect(() => parseExperimentHistory(JSON.stringify(badTarget))).toThrow(/target/)
  })

  it('rejects wrong schema version and malformed JSON', () => {
    expect(() => parseExperimentHistory(JSON.stringify({ schemaVersion: 1, sessions: [] }))).toThrow(/schemaVersion/)
    expect(() => parseExperimentHistory('{not json')).toThrow(/JSON/)
  })

  it('rejects live rounds, inconsistent scoring and duplicate round identifiers', () => {
    const parse = (rounds) => parseExperimentHistory({ schemaVersion: 2, sessions: [terminalSession({ rounds })] })
    expect(() => parse([{ id: 'r', index: 0, status: 'LOCKED' }])).toThrow(/终态/)
    expect(() => parse([{ id: 'r', index: 0, status: 'REVEALED', target: 1, guess: 2, correct: true }])).toThrow(/correct/)
    const round = { id: 'r', index: 0, status: 'REVEALED', target: 1, guess: 1, correct: true }
    expect(() => parse([round, { ...round, index: 1 }])).toThrow(/重复/)
  })
})

describe('loadLegacyHistory — read-only v1 section', () => {
  it('reads v1 sessions and leaves the v1 key untouched', () => {
    const v1 = [{ id: 'v1-a', status: 'COMPLETED', createdAt: 10, completedAt: 20, rounds: [{ id: 'x', status: 'REVEALED', correct: true, target: 2 }] }]
    localStorage.setItem('spirituality:v1:sessions', JSON.stringify(v1))

    const legacy = loadLegacyHistory()
    expect(legacy).toHaveLength(1)
    expect(legacy[0].protocolVersion).toBe(1)
    expect(legacy[0].legacy).toBe(true)

    expect(JSON.parse(localStorage.getItem('spirituality:v1:sessions'))).toHaveLength(1)
  })
})
