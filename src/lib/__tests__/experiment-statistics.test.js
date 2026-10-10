import { describe, it, expect } from 'vitest'
import {
  summarizeExperiment,
  groupExperimentHistory,
  dedupeSessions,
} from '../experiment-statistics.js'
import { spiritualityProbOneSided } from '../statistics.js'

function revealed(index, correct, condition) {
  return { id: `r${index}`, index, status: 'REVEALED', correct, target: 1, guess: correct ? 1 : 2, condition }
}

function abandoned(index) {
  return { id: `r${index}`, index, status: 'ABANDONED', correct: null, target: null }
}

function session(overrides = {}) {
  return {
    id: 's1',
    experimentType: 'hidden',
    protocolVersion: 2,
    chanceBaseline: 0.2,
    status: 'COMPLETED',
    createdAt: 1000,
    completedAt: 2000,
    rounds: [],
    ...overrides,
  }
}

it('keeps sender-choice v3 separate and never assumes a uniform chance baseline', () => {
  const chosen = session({ id: 'v3', experimentType: 'telepathy', protocolVersion: 3, chanceBaseline: null, rounds: [revealed(0, true), revealed(1, false)] })
  const summary = summarizeExperiment(chosen)
  expect(summary.accuracy).toBe(0.5)
  expect(summary.baseline).toBeNull()
  expect(summary.excess).toBeNull()
  expect(summary.probAboveChance).toBeNull()
  expect(summary.conditions).toBeUndefined()
  const groups = groupExperimentHistory([chosen, session({ id: 'v2', experimentType: 'telepathy' })])
  expect(groups).toHaveLength(2)
  expect(groups.find(g => g.protocolVersion === 3).summary.n).toBe(2)
})

it('separates history groups by candidate set and treats old missing sets as digits', () => {
  const groups = groupExperimentHistory([
    session({ id: 'old' }), session({ id: 'numbers', settings: { candidateSet: 'digits' } }),
    session({ id: 'letters', settings: { candidateSet: 'letters' }, rounds: [revealed(0, true)] }),
  ])
  expect(groups).toHaveLength(2)
  expect(groups.find(g => g.candidateSet === 'digits').count).toBe(2)
  expect(groups.find(g => g.candidateSet === 'letters').summary.k).toBe(1)
})

describe('summarizeExperiment — counting and nulls', () => {
  it('counts only REVEALED and never treats ABANDONED as wrong', () => {
    const s = session({
      rounds: [revealed(0, true), revealed(1, false), abandoned(2), { id: 'r3', index: 3, status: 'TARGET_READY' }],
    })
    const r = summarizeExperiment(s)
    expect(r.n).toBe(2)
    expect(r.k).toBe(1)
    expect(r.accuracy).toBeCloseTo(0.5)
    expect(r.excess).toBeCloseTo(0.3)
  })

  it('returns null rates/probabilities/intervals with no revealed rounds', () => {
    const r = summarizeExperiment(session({ rounds: [abandoned(0)] }))
    expect(r.n).toBe(0)
    expect(r.accuracy).toBe(null)
    expect(r.excess).toBe(null)
    expect(r.probAboveChance).toBe(null)
    expect(r.credible).toBe(null)
    expect(r.baseline).toBeCloseTo(0.2)
  })

  it('probAboveChance uses the session baseline threshold', () => {
    const s = session({ chanceBaseline: 0.25, rounds: [revealed(0, true), revealed(1, false), revealed(2, true), revealed(3, false)] })
    const r = summarizeExperiment(s)
    expect(r.probAboveChance).toBeCloseTo(spiritualityProbOneSided(2, 4, 0.25), 12)
  })
})

describe('summarizeExperiment — telepathy conditions', () => {
  it('splits terminal sessions into sending/control with an observed difference', () => {
    const s = session({
      experimentType: 'telepathy',
      status: 'COMPLETED',
      rounds: [
        revealed(0, true, 'sending'),
        revealed(1, false, 'sending'),
        revealed(2, true, 'control'),
        revealed(3, true, 'control'),
      ],
    })
    const { conditions } = summarizeExperiment(s)
    expect(conditions.sending.accuracy).toBeCloseTo(0.5)
    expect(conditions.control.accuracy).toBeCloseTo(1)
    expect(conditions.difference).toBeCloseTo(-0.5)
  })

  it('omits conditions for non-terminal telepathy', () => {
    const s = session({ experimentType: 'telepathy', status: 'IN_PROGRESS' })
    expect(summarizeExperiment(s).conditions).toBeUndefined()
  })

  it('difference is null when an arm has no data', () => {
    const s = session({
      experimentType: 'telepathy',
      status: 'ABANDONED',
      rounds: [revealed(0, true, 'sending')],
    })
    const { conditions } = summarizeExperiment(s)
    expect(conditions.sending.n).toBe(1)
    expect(conditions.control.n).toBe(0)
    expect(conditions.control.accuracy).toBe(null)
    expect(conditions.difference).toBe(null)
  })
})

describe('groupExperimentHistory', () => {
  it('deduplicates by id keeping the longer record', () => {
    const short = session({ id: 'dup', createdAt: 1000, completedAt: 5000, rounds: [revealed(0, true)] })
    const long = session({ id: 'dup', createdAt: 1000, completedAt: 1000, rounds: [revealed(0, true), revealed(1, false), revealed(2, true)] })
    const deduped = dedupeSessions([short, long])
    expect(deduped).toHaveLength(1)
    expect(deduped[0].rounds).toHaveLength(3)

    const groups = groupExperimentHistory([short, long])
    expect(groups).toHaveLength(1)
    expect(groups[0].count).toBe(1)
    expect(groups[0].summary.n).toBe(3)
  })

  it('groups by experimentType + protocolVersion + baseline and excludes v1', () => {
    const legacy = session({ id: 'legacy', protocolVersion: 1, experimentType: 'hidden' })
    const groups = groupExperimentHistory([
      session({ id: 'a', experimentType: 'hidden', chanceBaseline: 0.2 }),
      session({ id: 'b', experimentType: 'hidden', chanceBaseline: 0.25 }),
      session({ id: 'c', experimentType: 'precognition', chanceBaseline: 0.2 }),
      legacy,
    ])
    const keys = groups.map((g) => g.key).sort()
    expect(keys).toEqual(['hidden|v2|0.2', 'hidden|v2|0.25', 'precognition|v2|0.2'])
    expect(groups.every((g) => g.protocolVersion === 2)).toBe(true)
  })

  it('aggregates telepathy condition arms across terminal sessions only', () => {
    const terminal = session({
      id: 't1',
      experimentType: 'telepathy',
      status: 'COMPLETED',
      rounds: [revealed(0, true, 'sending'), revealed(1, false, 'control')],
    })
    const active = session({
      id: 't2',
      experimentType: 'telepathy',
      status: 'IN_PROGRESS',
      rounds: [revealed(0, true, 'sending')],
    })
    const [group] = groupExperimentHistory([terminal, active])
    expect(group.summary.conditions.sending.n).toBe(1)
    expect(group.summary.conditions.control.n).toBe(1)
    // terminal arm: sending 1/1, control 0/1 → difference 1
    expect(group.summary.conditions.difference).toBeCloseTo(1)
  })
})
