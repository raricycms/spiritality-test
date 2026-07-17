import { describe, it, expect, vi } from 'vitest'
import * as sm from '../state-machine.js'
import * as rng from '../rng.js'

describe('state-machine — inviolable target timing', () => {
  it('enterNewRound is the only producer of round.target', () => {
    const spy = vi.spyOn(rng, 'generateTarget').mockImplementation((id) => 3)
    let session = sm.beginSession()
    session = sm.enterNewRound(session)
    expect(spy).toHaveBeenCalledTimes(1)
    session = sm.previewGuess(session, session.rounds[0].id, 1)
    expect(spy).toHaveBeenCalledTimes(1)
    session = sm.submitGuess(session, session.rounds[0].id, 1)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('a 30-round session calls generateTarget exactly 30 times', () => {
    const spy = vi.spyOn(rng, 'generateTarget').mockImplementation((id) =>
      Math.floor(Math.random() * 5) + 1,
    )
    let session = sm.beginSession({ roundsPerSession: 30 })
    for (let i = 0; i < 30; i++) {
      session = sm.enterNewRound(session)
      const id = session.rounds[i].id
      // User does a single previewGuess, then submitGuess; previewGuess +
      // submitGuess must not regenerate.
      session = sm.previewGuess(session, id, i % 5 + 1)
      session = sm.submitGuess(session, id, i % 5 + 1)
    }
    expect(spy).toHaveBeenCalledTimes(30)
  })

  it('target is frozen after enterNewRound; never mutates', () => {
    const fixed = [3, 1, 4, 5, 2]
    let i = 0
    vi.spyOn(rng, 'generateTarget').mockImplementation(() => fixed[i++ % fixed.length])
    let session = sm.beginSession({ roundsPerSession: 5 })
    const targets = []
    for (let r = 0; r < 5; r++) {
      session = sm.enterNewRound(session)
      const t = session.rounds[r].target
      targets.push(t)
      session = sm.submitGuess(session, session.rounds[r].id, 1)
    }
    // target sequence must match fixed generator output
    expect(targets).toEqual(fixed)
    // Object.freeze sanity: subsequent operations don't change target
    expect(session.rounds[0].target).toBe(3)
  })

  it('illegal state transitions throw', () => {
    vi.spyOn(rng, 'generateTarget').mockImplementation(() => 2)
    let session = sm.beginSession()
    session = sm.enterNewRound(session)
    const id = session.rounds[0].id
    session = sm.submitGuess(session, id, 2) // -> REVEALED
    expect(() => sm.previewGuess(session, id, 1)).toThrow(/status REVEALED/)
    expect(() => sm.submitGuess(session, id, 3)).toThrow(/status REVEALED/)
  })

  it('previewGuess can update an already-GUESSING round (change of mind before submit)', () => {
    vi.spyOn(rng, 'generateTarget').mockImplementation(() => 2)
    let session = sm.beginSession()
    session = sm.enterNewRound(session)
    const id = session.rounds[0].id
    session = sm.previewGuess(session, id, 1) // TARGET_READY -> GUESSING(1)
    expect(session.rounds[0].status).toBe('GUESSING')
    expect(session.rounds[0].guess).toBe(1)
    // User changes mind: must succeed, not throw.
    session = sm.previewGuess(session, id, 4)
    expect(session.rounds[0].status).toBe('GUESSING')
    expect(session.rounds[0].guess).toBe(4)
    // Target is untouched across previews.
    expect(session.rounds[0].target).toBe(2)
  })

  it('previewGuess(null) on a GUESSING round clears back to TARGET_READY', () => {
    vi.spyOn(rng, 'generateTarget').mockImplementation(() => 3)
    let session = sm.beginSession()
    session = sm.enterNewRound(session)
    const id = session.rounds[0].id
    session = sm.previewGuess(session, id, 2)
    expect(session.rounds[0].status).toBe('GUESSING')
    session = sm.previewGuess(session, id, null)
    expect(session.rounds[0].status).toBe('TARGET_READY')
    expect(session.rounds[0].guess).toBeNull()
  })

  it('abandonRound marks non-terminal round; completeSession requires IN_PROGRESS session status', () => {
    vi.spyOn(rng, 'generateTarget').mockImplementation(() => 1)
    let session = sm.beginSession({ roundsPerSession: 2 })
    session = sm.enterNewRound(session)
    const id = session.rounds[0].id
    session = sm.abandonRound(session, id)
    expect(session.rounds[0].status).toBe('ABANDONED')
    // Session is still IN_PROGRESS; completeSession succeeds.
    expect(session.status).toBe('IN_PROGRESS')
    const completed = sm.completeSession(session, {
      total: 0, correct: 0, accuracy: 0, computedAt: 0,
      spiritualityEffectiveProb: 0,
    })
    expect(completed.status).toBe('COMPLETED')
    // But completing an already-COMPLETED session throws.
    expect(() =>
      sm.completeSession(completed, {
        total: 0, correct: 0, accuracy: 0, computedAt: 0,
        spiritualityEffectiveProb: 0,
      }),
    ).toThrow(/status COMPLETED/)
  })

  it('abandonSession aborts remaining rounds and flips session status', () => {
    vi.spyOn(rng, 'generateTarget').mockImplementation(() => 1)
    let session = sm.beginSession({ roundsPerSession: 3 })
    session = sm.enterNewRound(session)
    session = sm.enterNewRound(session)
    session = sm.enterNewRound(session)
    session = sm.abandonSession(session)
    expect(session.status).toBe('ABANDONED')
    for (const r of session.rounds) expect(r.status).toBe('ABANDONED')
    expect(() =>
      sm.completeSession(session, {
        total: 0, correct: 0, accuracy: 0, computedAt: 0,
        spiritualityEffectiveProb: 0,
      }),
    ).toThrow(/status ABANDONED/)
  })

  it('end-of-session: after revealing last round, can complete', () => {
    vi.spyOn(rng, 'generateTarget').mockImplementation(() => 5)
    let session = sm.beginSession({ roundsPerSession: 3 })
    for (let i = 0; i < 3; i++) {
      session = sm.enterNewRound(session)
      session = sm.submitGuess(session, session.rounds[i].id, 1)
    }
    session = sm.completeSession(session, {
      total: 3, correct: 0, accuracy: 0, computedAt: 0,
      spiritualityEffectiveProb: 0,
    })
    expect(session.status).toBe('COMPLETED')
  })

  it('findActiveRound: returns the most recent REVEALED round after submit', () => {
    vi.spyOn(rng, 'generateTarget').mockImplementation(() => 3)
    let session = sm.beginSession({ roundsPerSession: 30 })
    session = sm.enterNewRound(session)
    expect(sm.findActiveRound(session)?.status).toBe('TARGET_READY')
    session = sm.submitGuess(session, session.rounds[0].id, 1)
    // After submit the only round is REVEALED; UI must stay on it (this
    // is the bug we just fixed: previously REVEALED was treated as
    // "no active round", kicking the user back to the hero screen).
    const ar = sm.findActiveRound(session)
    expect(ar).not.toBeNull()
    expect(ar.status).toBe('REVEALED')
    expect(ar.id).toBe(session.rounds[0].id)
  })

  it('findActiveRound: prefers a fresh TARGET_READY over an older REVEALED round', () => {
    vi.spyOn(rng, 'generateTarget').mockImplementation(() => 1)
    let session = sm.beginSession({ roundsPerSession: 30 })
    session = sm.enterNewRound(session)
    session = sm.submitGuess(session, session.rounds[0].id, 1)
    // User clicks "下一题" — but we want to test that even without clicking,
    // a new TARGET_READY round wins when it appears.
    session = sm.enterNewRound(session)
    const ar = sm.findActiveRound(session)
    expect(ar.status).toBe('TARGET_READY')
    expect(ar.index).toBe(1)
  })

  it('endAndArchive-like behaviour: already-COMPLETED session must not call completeSession twice', () => {
    // Regression: useSession.endAndArchive used to call completeSession on an
    // already-COMPLETED session, which threw. Now it should be a no-op (i.e.,
    // the calling code checks status before calling completeSession).
    vi.spyOn(rng, 'generateTarget').mockImplementation(() => 1)
    let session = sm.beginSession({ roundsPerSession: 2 })
    session = sm.enterNewRound(session)
    session = sm.submitGuess(session, session.rounds[0].id, 1)
    session = sm.enterNewRound(session)
    session = sm.submitGuess(session, session.rounds[1].id, 1)
    session = sm.completeSession(session, {
      total: 2,
      correct: 1,
      accuracy: 0.5,
      computedAt: 0,
      spiritualityEffectiveProb: 0.5,
    })
    expect(session.status).toBe('COMPLETED')
    // Calling completeSession on COMPLETED must throw — that's the contract
    // the fix relies on.
    expect(() =>
      sm.completeSession(session, {
        total: 2, correct: 1, accuracy: 0.5, computedAt: 0,
        spiritualityEffectiveProb: 0.5,
      }),
    ).toThrow(/COMPLETED/)
  })
})
