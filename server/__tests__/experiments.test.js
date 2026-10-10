/**
 * Focused backend tests for the hidden / precognition / telepathy modules.
 *
 * Runs under Node's built-in test runner:
 *   node --test server/__tests__/experiments.test.js
 *
 * It also registers under Vitest (used by `npm test`) via a conditional import,
 * so it does not break the existing Jest-style/Vitest suite.
 */

import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createExperimentServer } from '../index.js'
import { createMemoryStorage, createFileStorage } from '../storage.js'
import { buildConditionSchedule } from '../service.js'

const { test } = process.env.VITEST
  ? await import('vitest')
  : await import('node:test')

const SEND = 1000
const ANS = 1000

function makeClock(start = 1_000_000) {
  let t = start
  return {
    now: () => t,
    advance: (ms) => {
      t += ms
    },
  }
}

function request(base, method, pathname, { token, body, raw } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, base)
    const payload = raw !== undefined
      ? Buffer.from(raw)
      : body !== undefined
        ? Buffer.from(JSON.stringify(body))
        : null
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          ...(payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let json = null
          try {
            json = text ? JSON.parse(text) : null
          } catch {
            json = null
          }
          resolve({ status: res.statusCode, json, text })
        })
      },
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function startApp(options = {}) {
  const app = createExperimentServer({
    distDir: path.join(os.tmpdir(), 'spirituality-no-dist'),
    storage: options.storage || createMemoryStorage(),
    clock: options.clock,
    random: options.random || (() => 0),
  })
  const { port } = await app.listen(0, '127.0.0.1')
  const base = `http://127.0.0.1:${port}`
  return { app, base }
}

const get = (base, id, token) => request(base, 'GET', `/api/experiments/${id}`, { token })
const create = (base, body) => request(base, 'POST', '/api/experiments', { body })
const guess = (base, id, token, body) => request(base, 'POST', `/api/experiments/${id}/guess`, { token, body })
const next = (base, id, token, roundId) => request(base, 'POST', `/api/experiments/${id}/next`, { token, body: { roundId } })
const abandon = (base, id, token) => request(base, 'POST', `/api/experiments/${id}/abandon`, { token })
const select = (base, id, token, roundId, target) => request(base, 'POST', `/api/experiments/${id}/target`, { token, body: { roundId, target } })

test('telepathy v3: sender chooses and locks; receiver cannot see or replace the choice', async () => {
  const clock = makeClock()
  const { app, base } = await startApp({ clock: clock.now })
  try {
    const created = (await create(base, { experimentType: 'telepathy', roundsPerSession: 5, sendingDurationMs: SEND, answerDurationMs: ANS })).json
    const joined = (await request(base, 'POST', '/api/rooms/join', { body: { code: created.snapshot.roomCode } })).json
    const id = created.sessionId
    const r = joined.snapshot.activeRound.id
    assert.equal(joined.snapshot.protocolVersion, 3)
    assert.equal(joined.snapshot.chanceBaseline, null)
    assert.equal(joined.snapshot.activeRound.status, 'SELECTING')
    clock.advance(SEND + ANS + 10)
    assert.equal((await get(base, id, joined.token)).json.activeRound.status, 'SELECTING', 'no timer starts before sender chooses')
    assert.equal((await guess(base, id, joined.token, { roundId: r, guess: 4 })).status, 409)
    assert.equal((await select(base, id, joined.token, r, 4)).status, 403)
    assert.equal((await select(base, id, created.token, r, 6)).status, 400)
    const chosen = await select(base, id, created.token, r, 4)
    assert.equal(chosen.status, 200)
    assert.equal(chosen.json.activeRound.target, 4)
    assert.equal(chosen.json.activeRound.sendingEndsAt, clock.now() + SEND)
    const originalReveal = chosen.json.activeRound.revealAt
    assert.equal((await select(base, id, created.token, r, 4)).status, 200)
    assert.equal((await select(base, id, created.token, r, 2)).status, 409)
    const hidden = (await get(base, id, joined.token)).json.activeRound
    assert.equal(hidden.target, undefined)
    clock.advance(SEND)
    const locked = await guess(base, id, joined.token, { roundId: r, guess: 4 })
    assert.equal(locked.json.activeRound.status, 'LOCKED')
    assert.equal(locked.json.activeRound.target, undefined)
    assert.equal((await get(base, id, created.token)).json.activeRound.guess, undefined)
    clock.advance(ANS)
    const revealed = (await get(base, id, joined.token)).json.activeRound
    assert.equal(revealed.target, 4)
    assert.equal(revealed.guess, 4)
    assert.equal(revealed.correct, true)
    assert.equal(revealed.revealedAt, originalReveal)
    const newer = (await next(base, id, joined.token, r)).json.activeRound
    assert.equal(newer.status, 'SELECTING')
    assert.equal((await select(base, id, created.token, r, 2)).status, 409)
    await select(base, id, created.token, newer.id, 5)
    clock.advance(SEND)
    await guess(base, id, joined.token, { roundId: newer.id, guess: 1 })
    clock.advance(ANS)
    assert.equal((await get(base, id, created.token)).json.activeRound.correct, false)
  } finally { await app.close() }
})

test('health endpoint reports ok', async () => {
  const { app, base } = await startApp()
  try {
    const res = await request(base, 'GET', '/api/health')
    assert.equal(res.status, 200)
    assert.equal(res.json.status, 'ok')
  } finally {
    await app.close()
  }
})

test('candidate sets: room creator selects the set; join and restore share it', async () => {
  const storage = createMemoryStorage()
  const { app, base } = await startApp({ storage })
  let created, joined
  try {
    assert.equal((await create(base, { experimentType: 'telepathy', candidateSet: 'invalid' })).status, 400)
    created = (await create(base, { experimentType: 'telepathy', candidateSet: 'cosmos', roundsPerSession: 5 })).json
    assert.equal(created.snapshot.settings.candidateSet, 'cosmos')
    joined = (await request(base, 'POST', '/api/rooms/join', { body: { code: created.snapshot.roomCode, candidateSet: 'letters' } })).json
    assert.equal(joined.snapshot.settings.candidateSet, 'cosmos', 'receiver cannot override room symbols')
    await select(base, created.sessionId, created.token, joined.snapshot.activeRound.id, 3)
    assert.equal((await get(base, created.sessionId, joined.token)).json.activeRound.target, undefined)
    for (const candidateSet of ['digits', 'letters', 'cosmos', 'colors', 'faces', 'directions']) {
      const solo = await create(base, { experimentType: 'hidden', candidateSet, roundsPerSession: 5 })
      assert.equal(solo.json.snapshot.settings.candidateSet, candidateSet)
      const result = await guess(base, solo.json.sessionId, solo.json.token, { roundId: solo.json.snapshot.activeRound.id, guess: 1 })
      assert.equal(result.json.activeRound.correct, true, 'display symbols do not alter position-based scoring')
    }
  } finally { await app.close() }
  const restored = await startApp({ storage })
  try {
    const snapshot = (await get(restored.base, created.sessionId, created.token)).json
    assert.equal(snapshot.settings.candidateSet, 'cosmos')
    assert.equal(snapshot.activeRound.target, 3)
  } finally { await restored.app.close() }
})

test('telepathy v3: the sender lock and deadlines survive a server restart', async () => {
  const clock = makeClock()
  const storage = createMemoryStorage()
  const first = await startApp({ storage, clock: clock.now })
  let created, joined, locked
  try {
    created = (await create(first.base, { experimentType: 'telepathy', roundsPerSession: 5, sendingDurationMs: SEND, answerDurationMs: ANS })).json
    joined = (await request(first.base, 'POST', '/api/rooms/join', { body: { code: created.snapshot.roomCode } })).json
    locked = (await select(first.base, created.sessionId, created.token, joined.snapshot.activeRound.id, 3)).json
  } finally { await first.app.close() }
  const second = await startApp({ storage, clock: clock.now })
  try {
    const restored = (await get(second.base, created.sessionId, created.token)).json
    assert.equal(restored.protocolVersion, 3)
    assert.equal(restored.activeRound.target, 3)
    assert.equal(restored.activeRound.revealAt, locked.activeRound.revealAt)
    assert.equal((await get(second.base, created.sessionId, joined.token)).json.activeRound.target, undefined)
    assert.equal((await select(second.base, created.sessionId, created.token, restored.activeRound.id, 1)).status, 409)
  } finally { await second.app.close() }
})

test('hidden: target hidden before guess, revealed after; auth is token-scoped', async () => {
  const { app, base } = await startApp()
  try {
    const created = await create(base, {
      experimentType: 'hidden',
      roundsPerSession: 5,
      role: 'sender', // must be ignored
    })
    assert.equal(created.status, 201)
    assert.equal(created.json.role, 'receiver')
    const { sessionId, token, snapshot } = created.json
    const round0 = snapshot.rounds[0]
    assert.equal(round0.status, 'TARGET_READY')
    assert.equal(round0.target, undefined)
    assert.equal(round0.guess, null)

    assert.equal((await get(base, sessionId)).status, 401)

    const other = await create(base, { experimentType: 'hidden', roundsPerSession: 5 })
    assert.equal((await get(base, sessionId, other.json.token)).status, 401)
    assert.equal((await get(base, sessionId, 'e30')).status, 401)

    const revealed = await guess(base, sessionId, token, { roundId: round0.id, guess: 1 })
    assert.equal(revealed.status, 200)
    assert.equal(revealed.json.rounds[0].status, 'REVEALED')
    assert.equal(revealed.json.rounds[0].target, 1)
    assert.equal(revealed.json.rounds[0].guess, 1)
    assert.equal(revealed.json.rounds[0].correct, true)

    const reread = await get(base, sessionId, token)
    assert.equal(reread.json.rounds[0].target, 1, 'target must not be rerolled on reload')
  } finally {
    await app.close()
  }
})

test('hidden: guess is locked and retries are idempotent', async () => {
  const { app, base } = await startApp()
  try {
    const { json } = await create(base, { experimentType: 'hidden', roundsPerSession: 5 })
    const { sessionId, token } = json
    const roundId = json.snapshot.rounds[0].id

    const first = await guess(base, sessionId, token, { roundId, guess: 2 })
    assert.equal(first.status, 200)
    assert.equal(first.json.rounds[0].correct, false)

    const retry = await guess(base, sessionId, token, { roundId, guess: 2 })
    assert.equal(retry.status, 200)
    assert.equal(retry.json.rounds[0].guess, 2)

    const changed = await guess(base, sessionId, token, { roundId, guess: 3 })
    assert.equal(changed.status, 409)
    assert.equal((await get(base, sessionId, token)).json.rounds[0].guess, 2)
  } finally {
    await app.close()
  }
})

test('precognition: RNG runs only after the guess is locked', async () => {
  let calls = 0
  const random = () => {
    calls += 1
    return 0
  }
  const { app, base } = await startApp({ random })
  try {
    const { json } = await create(base, { experimentType: 'precognition', roundsPerSession: 5 })
    const { sessionId, token } = json
    const round0 = json.snapshot.rounds[0]
    assert.equal(round0.status, 'GUESSING')
    assert.equal(round0.target, undefined, 'target must be absent before the guess')
    assert.equal(round0.targetGeneratedAt, undefined)
    assert.equal(calls, 0, 'no target may be generated at round creation')

    const revealed = await guess(base, sessionId, token, { roundId: round0.id, guess: 1 })
    const r = revealed.json.rounds[0]
    assert.equal(calls, 1, 'exactly one RNG call, after locking')
    assert.equal(r.status, 'REVEALED')
    assert.equal(r.target, 1)
    assert.equal(r.correct, true)
    assert.ok(r.targetGeneratedAt >= r.guessLockedAt, 'generation must follow the lock')
    assert.ok(r.revealedAt >= r.targetGeneratedAt)
  } finally {
    await app.close()
  }
})

test('next: requires a revealed round and is idempotent per roundId', async () => {
  const { app, base } = await startApp()
  try {
    const { json } = await create(base, { experimentType: 'hidden', roundsPerSession: 5 })
    const { sessionId, token } = json
    const r0 = json.snapshot.rounds[0].id

    assert.equal((await next(base, sessionId, token, r0)).status, 409, 'cannot advance before reveal')

    await guess(base, sessionId, token, { roundId: r0, guess: 1 })
    const advanced = await next(base, sessionId, token, r0)
    assert.equal(advanced.status, 200)
    assert.equal(advanced.json.rounds.length, 2)
    const r1 = advanced.json.activeRound.id
    assert.equal(advanced.json.activeRound.index, 1)

    const duplicate = await next(base, sessionId, token, r0)
    assert.equal(duplicate.status, 200)
    assert.equal(duplicate.json.rounds.length, 2, 'duplicate next must not create a round')

    assert.equal((await next(base, sessionId, token, r1)).status, 409, 'active round is not terminal')
  } finally {
    await app.close()
  }
})

test('telepathy: creator is sender, join is one-time receiver, roles are enforced', async () => {
  const { app, base } = await startApp()
  try {
    const created = await create(base, {
      experimentType: 'telepathy',
      roundsPerSession: 5,
      sendingDurationMs: SEND,
      answerDurationMs: ANS,
    })
    assert.equal(created.status, 201)
    assert.equal(created.json.role, 'sender')
    assert.equal(created.json.snapshot.status, 'WAITING')
    assert.equal(created.json.snapshot.rounds.length, 0)
    assert.ok(created.json.snapshot.roomCode, 'sender sees its room code')

    const { sessionId } = created.json
    const senderToken = created.json.token
    const code = created.json.snapshot.roomCode

    const joined = await request(base, 'POST', '/api/rooms/join', { body: { code } })
    assert.equal(joined.status, 201)
    assert.equal(joined.json.role, 'receiver')
    assert.equal(joined.json.snapshot.status, 'IN_PROGRESS')
    assert.equal(joined.json.snapshot.rounds.length, 1)
    assert.equal(joined.json.snapshot.roomCode, undefined, 'receiver does not get the room code')
    const receiverToken = joined.json.token
    const r0 = joined.json.snapshot.activeRound.id

    assert.equal((await request(base, 'POST', '/api/rooms/join', { body: { code } })).status, 404)
    assert.equal((await request(base, 'POST', '/api/rooms/join', { body: { code: 'NOPE' } })).status, 404)

    // Sender may never guess or advance.
    assert.equal((await guess(base, sessionId, senderToken, { roundId: r0, guess: 1 })).status, 403)
    assert.equal((await next(base, sessionId, senderToken, r0)).status, 403)

    // Receiver role comes from the token; a body "role" cannot change it.
    const r = await get(base, sessionId, receiverToken)
    assert.equal(r.json.role, 'receiver')
  } finally {
    await app.close()
  }
})

test('legacy telepathy v2: saved rooms retain their random sending/control protocol', async () => {
  const clock = makeClock()
  let draws = 0
  // Four shuffle draws produce sending/control in the first two rounds;
  // all subsequent target draws produce digit 1.
  const { app, base } = await startApp({ clock: clock.now, random: () => draws++ < 4 ? 0.5 : 0 })
  try {
    const created = await create(base, {
      experimentType: 'telepathy',
      roundsPerSession: 5,
      sendingDurationMs: SEND,
      answerDurationMs: ANS,
    })
    const { sessionId, token: senderToken, snapshot } = created.json
    // Simulate a room saved by the previous server before receiver join.
    const legacy = app.service.state.sessions[sessionId]
    legacy.protocolVersion = 2
    legacy.chanceBaseline = 0.2
    legacy.conditions = buildConditionSchedule(5, app.service.random)
    await app.service.persist()
    const joined = await request(base, 'POST', '/api/rooms/join', { body: { code: snapshot.roomCode } })
    const receiverToken = joined.json.token
    const r0 = joined.json.snapshot.activeRound.id

    const recv0 = (await get(base, sessionId, receiverToken)).json.activeRound
    assert.equal(recv0.status, 'SENDING')
    assert.equal(recv0.target, undefined)
    assert.equal(recv0.condition, undefined)

    const send0 = (await get(base, sessionId, senderToken)).json.activeRound
    assert.equal(send0.condition, 'sending', 'deterministic schedule: round 0 is sending')
    assert.equal(send0.target, 1)

    clock.advance(SEND)
    const recvGuess = (await get(base, sessionId, receiverToken)).json.activeRound
    assert.equal(recvGuess.status, 'GUESSING')

    const locked = await guess(base, sessionId, receiverToken, { roundId: r0, guess: 1 })
    assert.equal(locked.json.activeRound.status, 'LOCKED')
    assert.equal(locked.json.activeRound.guess, 1)
    assert.equal(locked.json.activeRound.target, undefined)
    assert.equal(locked.json.activeRound.condition, undefined)

    const sendLocked = (await get(base, sessionId, senderToken)).json.activeRound
    assert.equal(sendLocked.target, 1)
    assert.equal(sendLocked.guess, undefined, 'sender must not see the guess pre-reveal')

    clock.advance(ANS)
    const recvReveal = (await get(base, sessionId, receiverToken)).json.activeRound
    assert.equal(recvReveal.status, 'REVEALED')
    assert.equal(recvReveal.target, 1)
    assert.equal(recvReveal.correct, true)
    assert.equal(recvReveal.condition, undefined, 'condition stays hidden until the session is terminal')

    const advanced = await next(base, sessionId, receiverToken, r0)
    const r1Recv = advanced.json.activeRound
    assert.equal(r1Recv.status, 'SENDING')
    assert.equal(r1Recv.target, undefined)
    assert.equal(r1Recv.condition, undefined)

    const r1Send = (await get(base, sessionId, senderToken)).json.activeRound
    assert.equal(r1Send.condition, 'control', 'deterministic schedule: round 1 is control')
    assert.equal(r1Send.target, undefined, 'control round never exposes the target to the sender')
  } finally {
    await app.close()
  }
})

test('telepathy: timeout abandons the round and the last round completes the session', async () => {
  const clock = makeClock()
  const { app, base } = await startApp({ clock: clock.now })
  try {
    const created = await create(base, {
      experimentType: 'telepathy',
      roundsPerSession: 5,
      sendingDurationMs: SEND,
      answerDurationMs: ANS,
    })
    const { sessionId, token: senderToken, snapshot } = created.json
    const joined = await request(base, 'POST', '/api/rooms/join', { body: { code: snapshot.roomCode } })
    const receiverToken = joined.json.token

    let current = joined.json.snapshot
    for (let i = 0; i < 4; i += 1) {
      await select(base, sessionId, senderToken, current.activeRound.id, 1)
      clock.advance(SEND)
      current = (await guess(base, sessionId, receiverToken, { roundId: current.activeRound.id, guess: 1 })).json
      clock.advance(ANS)
      current = (await get(base, sessionId, receiverToken)).json
      assert.equal(current.activeRound.status, 'REVEALED')
      current = (await next(base, sessionId, receiverToken, current.activeRound.id)).json
    }

    // Round 5 is left unanswered past its revealAt.
    await select(base, sessionId, senderToken, current.activeRound.id, 2)
    clock.advance(SEND + ANS)
    const timedOut = (await get(base, sessionId, receiverToken)).json
    assert.equal(timedOut.status, 'COMPLETED')
    assert.equal(timedOut.activeRound, null)
    const last = timedOut.rounds[4]
    assert.equal(last.status, 'ABANDONED')
    assert.equal(last.invalidReason, 'timeout')
    assert.equal(last.target, undefined, 'abandoned rounds expose no target')
    // Every v3 round has a sender choice; there is no control schedule.
    assert.equal(typeof timedOut.rounds[0].condition, 'string')
    assert.equal(timedOut.rounds[4].condition, 'sending')

    // Sender still works after completion.
    assert.equal((await get(base, sessionId, senderToken)).status, 200)
  } finally {
    await app.close()
  }
})

test('telepathy: abandon retains a locked guess and records the actual early reveal', async () => {
  const clock = makeClock()
  const { app, base } = await startApp({ clock: clock.now })
  try {
    const created = await create(base, {
      experimentType: 'telepathy',
      roundsPerSession: 5,
      sendingDurationMs: SEND,
      answerDurationMs: ANS,
    })
    const { sessionId, token: senderToken, snapshot } = created.json
    const joined = await request(base, 'POST', '/api/rooms/join', { body: { code: snapshot.roomCode } })
    const receiverToken = joined.json.token
    const r0 = joined.json.snapshot.activeRound.id

    await select(base, sessionId, senderToken, r0, 1)
    clock.advance(SEND)
    const locked = await guess(base, sessionId, receiverToken, { roundId: r0, guess: 1 })
    assert.equal(locked.json.activeRound.status, 'LOCKED')
    const scheduledReveal = locked.json.activeRound.revealAt

    const done = await abandon(base, sessionId, receiverToken)
    assert.equal(done.status, 200)
    assert.equal(done.json.status, 'ABANDONED')
    const retained = done.json.rounds[0]
    assert.equal(retained.status, 'REVEALED', 'locked guess must not vanish')
    assert.equal(retained.guess, 1)
    assert.equal(retained.correct, true)
    assert.equal(retained.revealAt, scheduledReveal, 'retain the scheduled deadline')
    assert.equal(retained.revealedAt, clock.now(), 'record the actual early reveal')
    assert.ok(retained.revealedAt < scheduledReveal)
    assert.equal(retained.condition, 'sending', 'condition visible once terminal')
  } finally {
    await app.close()
  }
})

test('abandon: an unanswered active round is marked abandoned', async () => {
  const { app, base } = await startApp()
  try {
    const created = await create(base, {
      experimentType: 'telepathy',
      roundsPerSession: 5,
      sendingDurationMs: SEND,
      answerDurationMs: ANS,
    })
    const { sessionId, snapshot } = created.json
    const joined = await request(base, 'POST', '/api/rooms/join', { body: { code: snapshot.roomCode } })
    const done = await abandon(base, sessionId, joined.json.token)
    assert.equal(done.json.status, 'ABANDONED')
    assert.equal(done.json.rounds[0].status, 'ABANDONED')
    assert.equal(done.json.rounds[0].invalidReason, 'abandoned')
    assert.equal(done.json.activeRound, null)
  } finally {
    await app.close()
  }
})

test('persistence: sessions, tokens and targets survive a restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirituality-exp-'))
  const dataFile = path.join(dir, 'experiments.json')
  try {
    const app1 = createExperimentServer({ dataFile, random: () => 0, distDir: path.join(dir, 'no-dist') })
    const { port: p1 } = await app1.listen(0, '127.0.0.1')
    const base1 = `http://127.0.0.1:${p1}`
    const created = await create(base1, { experimentType: 'hidden', roundsPerSession: 5 })
    const { sessionId, token } = created.json
    const r0 = created.json.snapshot.rounds[0].id
    await guess(base1, sessionId, token, { roundId: r0, guess: 1 })
    await app1.close()

    const app2 = createExperimentServer({ dataFile, random: () => 4, distDir: path.join(dir, 'no-dist') })
    const { port: p2 } = await app2.listen(0, '127.0.0.1')
    const base2 = `http://127.0.0.1:${p2}`
    const restored = await get(base2, sessionId, token)
    assert.equal(restored.status, 200)
    assert.equal(restored.json.rounds[0].status, 'REVEALED')
    assert.equal(restored.json.rounds[0].target, 1, 'target must be restored, not rerolled')
    assert.equal(restored.json.rounds[0].guess, 1)
    await app2.close()
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('request bodies are bounded and must be valid JSON objects', async () => {
  const { app, base } = await startApp()
  try {
    const huge = await request(base, 'POST', '/api/experiments', {
      body: { experimentType: 'hidden', roundsPerSession: 5, padding: 'x'.repeat(70_000) },
    })
    assert.equal(huge.status, 413)

    const bad = await request(base, 'POST', '/api/experiments', { raw: '{not json' })
    assert.equal(bad.status, 400)

    const array = await request(base, 'POST', '/api/experiments', { raw: '[1,2,3]' })
    assert.equal(array.status, 400)

    const unknown = await request(base, 'GET', '/api/nope')
    assert.equal(unknown.status, 404)
  } finally {
    await app.close()
  }
})

test('corrupt private storage fails closed instead of resetting saved sessions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirituality-corrupt-'))
  const dataFile = path.join(dir, 'experiments.json')
  try {
    fs.writeFileSync(dataFile, '{corrupt')
    assert.throws(() => createFileStorage(dataFile).load())
    assert.equal(fs.readFileSync(dataFile, 'utf8'), '{corrupt')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
