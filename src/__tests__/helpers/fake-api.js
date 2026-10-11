// Concise in-memory fake for src/lib/experiment-api.js.
//
// Tests install it with:
//   vi.mock('../lib/experiment-api.js', async () => (await import('./helpers/fake-api.js')).fakeApi)
// and then configure per-call handlers via fakeApi.setHandlers({ create, get, ... }).
//
// The fake records every call in `state.calls` and keeps credentials in
// `state.creds`, mirroring the real sessionStorage behaviour closely enough
// to exercise restore/clear paths without a server.

class ApiError extends Error {
  constructor(message, { status = 0, code = 'http' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function createFakeApi() {
  const state = {
    creds: null,
    calls: [],
    handlers: {},
  }

  function call(name, args) {
    state.calls.push([name, args])
  }

  const api = {
    ApiError,
    state,
    setHandlers(handlers) {
      Object.assign(state.handlers, handlers)
    },
    reset() {
      state.creds = null
      state.calls = []
      state.handlers = {}
    },
    calls(name) {
      return state.calls.filter((c) => c[0] === name)
    },
    saveCredentials(creds) {
      state.creds = creds
    },
    loadCredentials() {
      return state.creds
    },
    clearCredentials() {
      state.creds = null
    },
    async createExperiment(input, token) {
      call('create', [input, token])
      const h = state.handlers.create
      if (!h) throw new Error('fake-api: no create handler configured')
      return h(input, token)
    },
    async joinRoom(body, token) {
      call('join', [body, token])
      const h = state.handlers.join
      if (!h) throw new Error('fake-api: no join handler configured')
      return h(body, token)
    },
    async getExperiment(id, token) {
      call('get', [id, token])
      const h = state.handlers.get
      if (!h) throw new Error('fake-api: no get handler configured')
      return h(id, token)
    },
    async submitGuess(id, body, token) {
      call('guess', [id, body, token])
      const h = state.handlers.guess
      if (!h) throw new Error('fake-api: no guess handler configured')
      return h(id, body, token)
    },
    async submitTarget(id, body, token) {
      call('target', [id, body, token])
      const h = state.handlers.target
      if (!h) throw new Error('fake-api: no target handler configured')
      return h(id, body, token)
    },
    async nextRound(id, body, token) {
      call('next', [id, body, token])
      const h = state.handlers.next
      if (!h) throw new Error('fake-api: no next handler configured')
      return h(id, body, token)
    },
    async abandonExperiment(id, token) {
      call('abandon', [id, token])
      const h = state.handlers.abandon
      if (!h) throw new Error('fake-api: no abandon handler configured')
      return h(id, token)
    },
    async checkHealth() {
      return { ok: true }
    },
  }

  return api
}

export const fakeApi = createFakeApi()

/** Build a solo session snapshot with the given active round. */
export function soloSnapshot(overrides = {}) {
  const { activeRound, ...rest } = overrides
  return {
    id: 's1',
    experimentType: 'hidden',
    protocolVersion: 2,
    chanceBaseline: 0.2,
    role: 'receiver',
    status: 'IN_PROGRESS',
    createdAt: 1000,
    completedAt: null,
    settings: { roundsPerSession: 30, sendingDurationMs: 15000, answerDurationMs: 15000 },
    rounds: activeRound ? [activeRound] : [],
    activeRound: activeRound || null,
    ...rest,
  }
}

/** Build a round object with sensible defaults. */
export function round(overrides = {}) {
  return {
    id: 'r1',
    index: 0,
    status: 'TARGET_READY',
    createdAt: 1000,
    targetGeneratedAt: 1000,
    guessLockedAt: null,
    revealedAt: null,
    sendingEndsAt: null,
    revealAt: null,
    guess: null,
    confidence: null,
    correct: null,
    target: null,
    condition: null,
    invalidReason: null,
    ...overrides,
  }
}
