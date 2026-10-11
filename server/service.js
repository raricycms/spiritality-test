/**
 * Experiment service: pure domain logic for the three approved server modules
 * (hidden information, precognition, paired telepathy).
 *
 * Design goals / invariants (see docs/08-experiment-design.md, docs/09-implementation-contract.md):
 *  - The service never trusts a client-supplied role; the role comes from the token.
 *  - Hidden: target is generated BEFORE the receiver can guess and never rerolled.
 *  - Precognition: the target does NOT exist until a valid guess is locked; the RNG
 *    is called strictly after the lock timestamp is recorded.
 *  - Legacy telepathy v2: random balanced `sending` / `control` schedule; the schedule stays
 *    private. Fixed SENDING -> GUESSING -> LOCKED -> REVEALED (or ABANDONED/timeout)
 *    windows. The sender only sees the target in a real sending round; the receiver
 *    never sees the target before reveal or the condition before the session is terminal.
 *  - Telepathy v3: sender chooses and locks a digit, then fixed sending/answering
 *    windows begin. Neither participant receives the other's choice before reveal.
 *  - Snapshots are role-filtered; raw sessions are never serialized directly.
 *  - Storage is injected (file / memory) and saves are ordered.
 *
 * Injectable options: { clock, random, storage, defaults }.
 *   clock   : () => epochMs          (default Date.now)
 *   random  : () => float in [0, 1)  (default CSPRNG-backed)
 *   storage : { load(), save(state) } (default none -> in-memory only)
 */

import { randomUUID, randomBytes } from 'node:crypto'
import { CANDIDATE_SET_IDS } from '../shared/candidate-sets.js'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export const EXPERIMENT_TYPES = Object.freeze(['hidden', 'precognition', 'telepathy'])
export const PROTOCOL_VERSION = 2
export const CHANCE_BASELINE = 0.2
export const TELEPATHY_PROTOCOL_VERSION = 3

const DEFAULT_SETTINGS = Object.freeze({
  roundsPerSession: 30,
  sendingDurationMs: 15000,
  answerDurationMs: 15000,
})

const TOKEN_BYTES = 32
const ROOM_CODE_BYTES = 6

/** CSPRNG-backed uniform float in [0, 1). */
function defaultRandom() {
  return randomBytes(4).readUInt32BE(0) / 0x100000000
}

function makeToken() {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

function pickTarget(random) {
  const n = Math.floor(Number(random()) * 5) + 1
  if (!Number.isFinite(n) || n < 1) return 1
  if (n > 5) return 5
  return n
}

/** Fisher-Yates using the injected random source. */
function shuffle(arr, random) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.max(0, Math.floor(Number(random()) * (i + 1))))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

/**
 * Build a balanced condition schedule of length `n`, randomized order.
 * `sending` gets ceil(n/2) slots, `control` the remainder.
 */
export function buildConditionSchedule(n, random) {
  const sending = Math.ceil(n / 2)
  const arr = []
  for (let i = 0; i < n; i += 1) arr.push(i < sending ? 'sending' : 'control')
  return shuffle(arr, random)
}

function intField(value, fallback, min, max, name) {
  if (value == null) return fallback
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${name} must be an integer in [${min}, ${max}]`)
  }
  return value
}

function normalizedConfidence(value) {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new HttpError(400, 'confidence must be null or a number in [0, 100]')
  }
  return value
}

function normalizedGuess(value) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new HttpError(400, 'guess must be an integer in [1, 5]')
  }
  return value
}

function isTerminalStatus(status) {
  return status === 'COMPLETED' || status === 'ABANDONED'
}

/**
 * Role-filtered, privacy-preserving round view. This is the ONLY place a round
 * is turned into client-visible data.
 */
function serializeRound(round, role, sessionTerminal, isActive) {
  const out = {
    id: round.id,
    index: round.index,
    status: round.status,
    createdAt: round.createdAt,
  }
  if (round.targetGeneratedAt != null) out.targetGeneratedAt = round.targetGeneratedAt
  if (round.guessLockedAt != null) out.guessLockedAt = round.guessLockedAt
  if (round.revealedAt != null) out.revealedAt = round.revealedAt
  if (round.sendingEndsAt != null) out.sendingEndsAt = round.sendingEndsAt
  if (round.revealAt != null) out.revealAt = round.revealAt
  if (round.invalidReason != null) out.invalidReason = round.invalidReason

  // Condition: sender knows it for its own rounds; receiver only once the whole
  // session is terminal (COMPLETED / ABANDONED).
  if (round.condition != null && (role === 'sender' || sessionTerminal)) {
    out.condition = round.condition
  }

  const revealed = round.status === 'REVEALED'
  const senderLiveTarget = role === 'sender'
    && round.condition === 'sending'
    && isActive
    && (round.status === 'SENDING' || round.status === 'GUESSING' || round.status === 'LOCKED')
  if (revealed || senderLiveTarget) {
    out.target = round.target
  }

  // The receiver always reads its own (locked) guess; the sender only after reveal.
  if (role === 'receiver' || revealed) {
    out.guess = round.guess
    out.confidence = round.confidence
  }
  if (revealed) out.correct = round.correct
  return out
}

/** Role-filtered session snapshot. Tokens and the private schedule never appear. */
export function serializeSession(session, role) {
  const terminal = isTerminalStatus(session.status)
  let activeRound = null
  const rounds = session.rounds.map((round) => {
    const isActive = round.id === session.activeRoundId
    const view = serializeRound(round, role, terminal, isActive)
    if (isActive) activeRound = view
    return view
  })
  const snapshot = {
    id: session.id,
    experimentType: session.experimentType,
    protocolVersion: session.protocolVersion ?? PROTOCOL_VERSION,
    chanceBaseline: session.protocolVersion === TELEPATHY_PROTOCOL_VERSION ? null : CHANCE_BASELINE,
    role,
    status: session.status,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    settings: { ...session.settings },
    rounds,
    activeRound,
  }
  if (session.experimentType === 'telepathy' && role === 'sender' && session.roomCode) {
    snapshot.roomCode = session.roomCode
  }
  return snapshot
}

export class ExperimentService {
  constructor(options = {}) {
    this.clock = typeof options.clock === 'function' ? options.clock : Date.now
    this.random = typeof options.random === 'function' ? options.random : defaultRandom
    this.storage = options.storage || null
    this.privateAccounts = options.accountStore || null
    this.ephemeral = options.ephemeral === true
    this.defaults = { ...DEFAULT_SETTINGS, ...(options.defaults || {}) }
    this.state = { version: PROTOCOL_VERSION, sessions: {}, tokens: {}, roomCodes: {} }
    this._initPromise = null
  }

  ensureInit() {
    if (!this._initPromise) {
      this._initPromise = (async () => {
        if (this.ephemeral || !this.storage) return
        const loaded = await this.storage.load()
        if (loaded && typeof loaded === 'object') {
          this.state.sessions = loaded.sessions || {}
          this.state.tokens = loaded.tokens || {}
          this.state.roomCodes = loaded.roomCodes || {}
        }
      })()
    }
    return this._initPromise
  }

  /** Ordered, atomic-by-delegation persistence. Snapshot is captured synchronously. */
  async persist() {
    if (this.ephemeral) {
      for (const session of Object.values(this.state.sessions)) {
        if (!isTerminalStatus(session.status) || session.archived) continue
        const entries = Object.entries(session.participants || {}).filter(([, account]) => account).map(([role, account]) => {
          const peer = session.participants[role === 'sender' ? 'receiver' : 'sender']
          return { account, snapshot: { ...serializeSession(session, role), partner: session.experimentType === 'telepathy' ? (peer ? { sub: peer.sub, username: peer.username } : { username: null }) : null } }
        })
        if (entries.length) await this.privateAccounts.archive(entries)
        session.archived = true
      }
      return
    }
    if (!this.storage) return
    const payload = JSON.parse(JSON.stringify(this.state))
    await this.storage.save(payload)
  }

  _sessionById(id) {
    return this.state.sessions[id] || null
  }

  /** Resolve the caller's role from the bearer token only. */
  authorize(sessionId, token) {
    if (!token) throw new HttpError(401, 'missing bearer token')
    const record = this.state.tokens[token]
    if (!record || record.sessionId !== sessionId) {
      throw new HttpError(401, 'invalid token for this session')
    }
    const session = this._sessionById(sessionId)
    if (!session) throw new HttpError(404, 'session not found')
    session.touchedAt = this.clock()
    return { session, role: record.role }
  }

  _newRoomCode() {
    let code = ''
    do {
      code = randomBytes(ROOM_CODE_BYTES).toString('hex').toUpperCase()
    } while (this.state.roomCodes[code])
    return code
  }

  _createRound(session, index, now) {
    const settings = session.settings
    const type = session.experimentType
    const round = {
      id: randomUUID(),
      index,
      status: 'TARGET_READY',
      createdAt: now,
      target: null,
      targetGeneratedAt: null,
      condition: null,
      sendingEndsAt: null,
      revealAt: null,
      guess: null,
      confidence: null,
      guessLockedAt: null,
      correct: null,
      revealedAt: null,
      invalidReason: null,
    }

    if (type === 'telepathy') {
      if (session.protocolVersion === TELEPATHY_PROTOCOL_VERSION) {
        round.status = 'SELECTING'
        round.condition = 'sending'
      } else {
        // Persisted v2 rooms finish under their original random-target protocol.
        round.condition = session.conditions[index] || 'control'
        round.status = 'SENDING'
        round.sendingEndsAt = now + settings.sendingDurationMs
        round.revealAt = round.sendingEndsAt + settings.answerDurationMs
        round.target = pickTarget(this.random)
        round.targetGeneratedAt = now
      }
    } else if (type === 'hidden') {
      // Target pre-exists the guess. Generated once, never rerolled.
      round.status = 'TARGET_READY'
      round.target = pickTarget(this.random)
      round.targetGeneratedAt = now
    } else {
      // Precognition: no target yet. It is generated only after a valid lock.
      round.status = 'GUESSING'
    }

    session.rounds.push(round)
    session.activeRoundId = round.id
    return round
  }

  /**
   * Advance time-driven telepathy phases. Returns true when state changed.
   * Called before every read/mutation so the server clock is authoritative.
   */
  _advance(session, now) {
    if (session.experimentType !== 'telepathy') return false
    if (isTerminalStatus(session.status)) return false
    const round = session.rounds.find((r) => r.id === session.activeRoundId)
    if (!round) return false
    let changed = false

    if (round.status === 'SENDING' && now >= round.sendingEndsAt) {
      round.status = 'GUESSING'
      changed = true
    }

    const answerWindowOver = round.revealAt != null && now >= round.revealAt
    if (answerWindowOver && (round.status === 'SENDING' || round.status === 'GUESSING')) {
      // No locked guess in time -> abandoned, reason timeout. Target is discarded
      // for scoring (ABANDONED rounds never count).
      round.status = 'ABANDONED'
      round.invalidReason = 'timeout'
      changed = true
    } else if (answerWindowOver && round.status === 'LOCKED') {
      this._reveal(round, round.revealAt)
      changed = true
    }

    if (changed) this._maybeComplete(session, now)
    return changed
  }

  _reveal(round, revealedAt) {
    round.status = 'REVEALED'
    round.revealedAt = revealedAt
    round.correct = round.guess === round.target
  }

  _maybeComplete(session, now) {
    const last = session.rounds[session.rounds.length - 1]
    if (!last) return false
    const isLastIndex = last.index === session.settings.roundsPerSession - 1
    const lastTerminal = last.status === 'REVEALED' || last.status === 'ABANDONED'
    if (isLastIndex && lastTerminal && !isTerminalStatus(session.status)) {
      session.status = 'COMPLETED'
      session.completedAt = now
      session.activeRoundId = null
      return true
    }
    return false
  }

  _snapshot(session, role) {
    const snapshot = serializeSession(session, role)
    if (this.ephemeral && session.archived && isTerminalStatus(session.status)) {
      session.delivered = { ...session.delivered, [role]: true }
      // Pair results survive only until the second participant receives them.
      // A bounded delivery window handles a disconnected peer without retaining a history.
      if (session.experimentType !== 'telepathy' || (session.delivered.sender && session.delivered.receiver)) this._discard(session.id)
    }
    return snapshot
  }

  _discard(id) {
    delete this.state.sessions[id]
    for (const [token, entry] of Object.entries(this.state.tokens)) if (entry.sessionId === id) delete this.state.tokens[token]
    for (const [code, value] of Object.entries(this.state.roomCodes)) if (value === id) delete this.state.roomCodes[code]
  }

  async sweep() {
    if (!this.ephemeral) return
    for (const session of Object.values(this.state.sessions)) {
      if (isTerminalStatus(session.status)) {
        if (this.clock() - session.completedAt > 300_000) { await this.persist(); this._discard(session.id) }
      } else if (this.clock() - (session.touchedAt ?? session.createdAt) > 21_600_000) {
        session.status = 'ABANDONED'; session.completedAt = this.clock(); session.activeRoundId = null
        for (const round of session.rounds) if (round.status !== 'REVEALED') { round.status = 'ABANDONED'; round.invalidReason = 'expired' }
        await this.persist(); this._discard(session.id)
      }
    }
  }

  async createExperiment(body = {}, account = null) {
    await this.ensureInit()
    const type = body.experimentType
    if (!EXPERIMENT_TYPES.includes(type)) {
      throw new HttpError(400, 'experimentType must be hidden, precognition or telepathy')
    }
    const candidateSet = body.candidateSet === undefined ? 'digits' : body.candidateSet
    if (!CANDIDATE_SET_IDS.includes(candidateSet)) throw new HttpError(400, 'invalid candidate set')
    const roundsPerSession = intField(
      body.roundsPerSession,
      this.defaults.roundsPerSession,
      5,
      200,
      'roundsPerSession',
    )
    const sendingDurationMs = intField(
      body.sendingDurationMs,
      this.defaults.sendingDurationMs,
      100,
      3_600_000,
      'sendingDurationMs',
    )
    const answerDurationMs = intField(
      body.answerDurationMs,
      this.defaults.answerDurationMs,
      100,
      3_600_000,
      'answerDurationMs',
    )

    const now = this.clock()
    const session = {
      id: randomUUID(),
      experimentType: type,
      protocolVersion: type === 'telepathy' ? TELEPATHY_PROTOCOL_VERSION : PROTOCOL_VERSION,
      chanceBaseline: type === 'telepathy' ? null : CHANCE_BASELINE,
      status: type === 'telepathy' ? 'WAITING' : 'IN_PROGRESS',
      createdAt: now,
      completedAt: null,
      settings: { roundsPerSession, sendingDurationMs, answerDurationMs, candidateSet },
      rounds: [],
      activeRoundId: null,
      roomCode: null,
      conditions: null,
      participants: { [type === 'telepathy' ? 'sender' : 'receiver']: account },
    }

    if (type === 'telepathy') {
      session.roomCode = this._newRoomCode()
    } else {
      this._createRound(session, 0, now)
    }

    const role = type === 'telepathy' ? 'sender' : 'receiver'
    const token = makeToken()
    this.state.sessions[session.id] = session
    this.state.tokens[token] = { sessionId: session.id, role }
    if (session.roomCode) this.state.roomCodes[session.roomCode] = session.id

    await this.persist()
    return { sessionId: session.id, token, role, snapshot: this._snapshot(session, role) }
  }

  async joinRoom({ code } = {}, account = null) {
    await this.ensureInit()
    if (typeof code !== 'string' || !code.trim()) {
      throw new HttpError(400, 'code is required')
    }
    const sessionId = this.state.roomCodes[code.trim().toUpperCase()] || this.state.roomCodes[code.trim()]
    if (!sessionId) throw new HttpError(404, 'room code not found')
    const session = this._sessionById(sessionId)
    if (!session) throw new HttpError(404, 'room not found')
    if (session.status !== 'WAITING') throw new HttpError(409, 'room already joined')

    const now = this.clock()
    session.status = 'IN_PROGRESS'
    this._createRound(session, 0, now)

    const token = makeToken()
    const role = 'receiver'
    session.participants = { ...session.participants, receiver: account }
    this.state.tokens[token] = { sessionId: session.id, role }
    // One-time join: the code is consumed. The session keeps its own copy so the
    // sender can still display it.
    delete this.state.roomCodes[session.roomCode]

    await this.persist()
    return { sessionId: session.id, token, role, snapshot: this._snapshot(session, role) }
  }

  async getSnapshot({ id, token } = {}) {
    await this.ensureInit()
    const { session, role } = this.authorize(id, token)
    const now = this.clock()
    if (this._advance(session, now) || (this.ephemeral && isTerminalStatus(session.status) && !session.archived)) await this.persist()
    return this._snapshot(session, role)
  }

  async submitGuess({ id, token, roundId, guess, confidence } = {}) {
    await this.ensureInit()
    const { session, role } = this.authorize(id, token)
    if (role !== 'receiver') throw new HttpError(403, 'only the receiver may submit guesses')
    if (isTerminalStatus(session.status)) throw new HttpError(409, 'session is already finished')
    const now = this.clock()
    if (this._advance(session, now)) await this.persist()

    const normalized = normalizedGuess(guess)
    const conf = normalizedConfidence(confidence)
    const round = session.rounds.find((r) => r.id === roundId)
    if (!round) throw new HttpError(404, 'round not found')

    if (round.status === 'REVEALED' || round.status === 'ABANDONED') {
      if (round.guess === normalized) {
        await this.persist()
        return this._snapshot(session, role) // idempotent retry
      }
      throw new HttpError(409, 'round is already locked')
    }

    if (session.experimentType === 'telepathy') {
      if (round.status === 'SENDING' || round.status === 'SELECTING') throw new HttpError(409, 'answering window has not opened')
      if (round.status === 'LOCKED') {
        if (round.guess === normalized) {
          await this.persist()
          return this._snapshot(session, role)
        }
        throw new HttpError(409, 'round is already locked')
      }
      if (round.status !== 'GUESSING') throw new HttpError(409, `cannot guess in status ${round.status}`)
      round.guess = normalized
      round.confidence = conf
      round.guessLockedAt = now
      round.status = 'LOCKED'
    } else {
      // Single-player modules: lock, then reveal immediately.
      round.guess = normalized
      round.confidence = conf
      round.guessLockedAt = now
      round.status = 'LOCKED'
      if (session.experimentType === 'precognition') {
        // RNG strictly AFTER the guess is locked.
        round.target = pickTarget(this.random)
        round.targetGeneratedAt = now
      }
      this._reveal(round, now)
      this._maybeComplete(session, now)
    }

    await this.persist()
    return this._snapshot(session, role)
  }

  async submitTarget({ id, token, roundId, target } = {}) {
    await this.ensureInit()
    const { session, role } = this.authorize(id, token)
    if (role !== 'sender') throw new HttpError(403, 'only the sender may select a target')
    if (session.experimentType !== 'telepathy' || session.protocolVersion !== TELEPATHY_PROTOCOL_VERSION) {
      throw new HttpError(409, 'this protocol does not allow target selection')
    }
    const now = this.clock()
    if (this._advance(session, now)) await this.persist()
    const chosen = intField(target, null, 1, 5, 'target')
    if (chosen == null) throw new HttpError(400, 'target must be an integer in [1, 5]')
    const round = session.rounds.find((r) => r.id === roundId)
    if (!round) throw new HttpError(404, 'round not found')
    // A retry may read the original lock, even after its reveal. It cannot
    // change the digit or restart the timer, nor act on a newer round.
    if (round.target != null) {
      if (round.target === chosen) return this._snapshot(session, role)
      throw new HttpError(409, 'target is already locked')
    }
    if (isTerminalStatus(session.status)) throw new HttpError(409, 'session is already finished')
    if (round.id !== session.activeRoundId || round.status !== 'SELECTING') {
      throw new HttpError(409, 'target selection is not available')
    }
    round.target = chosen
    round.targetGeneratedAt = now // v3: sender choice was locked at this time
    round.status = 'SENDING'
    round.sendingEndsAt = now + session.settings.sendingDurationMs
    round.revealAt = round.sendingEndsAt + session.settings.answerDurationMs
    await this.persist()
    return this._snapshot(session, role)
  }

  async advanceRound({ id, token, roundId } = {}) {
    await this.ensureInit()
    const { session, role } = this.authorize(id, token)
    if (role !== 'receiver') throw new HttpError(403, 'only the receiver may start the next round')
    const now = this.clock()
    if (this._advance(session, now)) await this.persist()

    if (isTerminalStatus(session.status)) {
      return this._snapshot(session, role) // idempotent no-op after the session ended
    }

    const round = session.rounds.find((r) => r.id === roundId)
    if (!round) throw new HttpError(404, 'round not found')

    // Any roundId that is not the current active round is a stale/duplicate
    // request: return the snapshot without creating a new round.
    if (session.activeRoundId && roundId !== session.activeRoundId) {
      return this._snapshot(session, role)
    }

    if (round.status === 'LOCKED') throw new HttpError(409, 'round has not been revealed yet')
    if (round.status !== 'REVEALED' && round.status !== 'ABANDONED') {
      throw new HttpError(409, `cannot advance from status ${round.status}`)
    }

    if (round.index === session.settings.roundsPerSession - 1) {
      this._maybeComplete(session, now)
      await this.persist()
      return this._snapshot(session, role)
    }

    this._createRound(session, round.index + 1, now)
    await this.persist()
    return this._snapshot(session, role)
  }

  async abandon({ id, token } = {}) {
    await this.ensureInit()
    const { session, role } = this.authorize(id, token)
    const now = this.clock()
    if (this._advance(session, now)) await this.persist()
    if (isTerminalStatus(session.status)) return this._snapshot(session, role)

    for (const round of session.rounds) {
      if (round.status === 'REVEALED') continue
      if (round.status === 'LOCKED' && round.guess != null) {
        // Explicit abandon ends the session early but never erases a locked
        // answer. Preserve the scheduled revealAt and record the actual reveal.
        this._reveal(round, now)
      } else {
        round.status = 'ABANDONED'
        if (round.guess == null) round.invalidReason = round.invalidReason || 'abandoned'
      }
    }

    session.status = 'ABANDONED'
    session.completedAt = now
    session.activeRoundId = null
    await this.persist()
    return this._snapshot(session, role)
  }

  health() {
    return {
      status: 'ok',
      protocolVersion: PROTOCOL_VERSION,
      sessions: Object.keys(this.state.sessions).length,
      time: this.clock(),
    }
  }
}

export function createExperimentService(options = {}) {
  return new ExperimentService(options)
}
