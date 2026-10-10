// API client contract: auth header, error surfacing, offline behaviour, and
// sessionStorage credential handling. Uses a fetch fake — no server needed.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ApiError,
  apiRequest,
  submitGuess,
  submitTarget,
  saveCredentials,
  loadCredentials,
  clearCredentials,
} from '../lib/experiment-api.js'

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  }
}

describe('apiRequest', () => {
  it('sends the chosen target to the sender endpoint with bearer auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ activeRound: { status: 'SENDING', target: 4 } }))
    vi.stubGlobal('fetch', fetchMock)
    const snapshot = await submitTarget('s1', { roundId: 'r1', target: 4 }, 'sender-token')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/experiments/s1/target')
    expect(JSON.parse(init.body)).toEqual({ roundId: 'r1', target: 4 })
    expect(init.headers.Authorization).toBe('Bearer sender-token')
    expect(snapshot.activeRound.target).toBe(4)
  })
  it('sends the bearer token and parses the JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 's1' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiRequest('/experiments/s1', { token: 'secret' })
    expect(result).toEqual({ id: 's1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/experiments/s1')
    expect(init.headers.Authorization).toBe('Bearer secret')
  })

  it('surfaces the server error message with its status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: '房间不存在' }, { ok: false, status: 404 })),
    )
    await expect(apiRequest('/rooms/join', { method: 'POST', body: { code: 'X' } })).rejects.toMatchObject({
      name: 'ApiError',
      message: '房间不存在',
      status: 404,
      code: 'notfound',
    })
  })

  it('reports an offline error instead of fabricating a response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const err = await apiRequest('/health').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('offline')
    expect(err.message).toMatch(/无法连接到实验服务/)
  })

  it('rejects a successful response that is not JSON data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '<html>error</html>' }))
    await expect(apiRequest('/health')).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('never puts the token in the request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 's1' }))
    vi.stubGlobal('fetch', fetchMock)
    await submitGuess('s1', { roundId: 'r1', guess: 3, confidence: null }, 'token-123')
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.stringify(init.body)).not.toContain('token-123')
    expect(init.headers.Authorization).toBe('Bearer token-123')
  })
})

describe('credentials', () => {
  it('round-trips active credentials and clears them on demand', () => {
    expect(loadCredentials()).toBeNull()
    saveCredentials({ sessionId: 's1', token: 't', role: 'receiver' })
    expect(loadCredentials()).toMatchObject({ sessionId: 's1', token: 't', role: 'receiver' })
    clearCredentials()
    expect(loadCredentials()).toBeNull()
  })
})
