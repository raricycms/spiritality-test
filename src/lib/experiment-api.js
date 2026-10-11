/**
 * experiment-api — thin same-origin client for the v2 experiment server.
 *
 * All calls go through the Vite dev proxy / production server at `/api`.
 * The server owns randomness, targets and timing; this client never invents
 * or falls back to client-side target generation.
 *
 * Session credentials (sessionId/token/role) live in sessionStorage so a
 * refresh can restore the SAME server session, and are cleared once the
 * session reaches a terminal state or the user abandons it.
 */

export const API_BASE = '/api'

const CRED_KEY = 'spirituality:v2:credentials'

/** Error carrying the HTTP status (0 for network/offline) and a code. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'network' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function describeNetworkError() {
  return '无法连接到实验服务。请确认服务已启动，然后重试。'
}

/**
 * Perform a JSON request against the API.
 * 2xx → parsed body (object) or null. Non-2xx → ApiError with server `error`.
 */
export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    throw new ApiError(describeNetworkError(), { code: 'offline', status: 0 })
  }

  let data = null
  try {
    const text = await res.text()
    if (text) data = JSON.parse(text)
  } catch {
    data = null
  }

  if (!res.ok) {
    const message =
      data && typeof data.error === 'string' && data.error.trim()
        ? data.error
        : `请求失败（HTTP ${res.status}）`
    throw new ApiError(message, {
      status: res.status,
      code: res.status === 404 ? 'notfound' : 'http',
    })
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ApiError('实验服务返回了无效数据，请重试。', { status: res.status, code: 'invalid-response' })
  }

  return data
}

/* ------------------------------------------------------------------ */
/* Session operations                                                  */
/* ------------------------------------------------------------------ */

export function createExperiment(input, token) {
  return apiRequest('/experiments', { method: 'POST', body: input, token })
}

export function joinRoom({ code }, token) {
  return apiRequest('/rooms/join', { method: 'POST', body: { code }, token })
}

export function getExperiment(id, token) {
  return apiRequest(`/experiments/${encodeURIComponent(id)}`, { token })
}

export function submitGuess(id, { roundId, guess, confidence = null }, token) {
  return apiRequest(`/experiments/${encodeURIComponent(id)}/guess`, {
    method: 'POST',
    body: { roundId, guess, confidence },
    token,
  })
}

export function submitTarget(id, { roundId, target }, token) {
  return apiRequest(`/experiments/${encodeURIComponent(id)}/target`, { method: 'POST', body: { roundId, target }, token })
}

export function nextRound(id, { roundId }, token) {
  return apiRequest(`/experiments/${encodeURIComponent(id)}/next`, {
    method: 'POST',
    body: { roundId },
    token,
  })
}

export function abandonExperiment(id, token) {
  return apiRequest(`/experiments/${encodeURIComponent(id)}/abandon`, {
    method: 'POST',
    token,
  })
}

export function checkHealth() {
  return apiRequest('/health')
}

/* ------------------------------------------------------------------ */
/* Credentials (sessionStorage) — active tab only, never exported      */
/* ------------------------------------------------------------------ */

export function saveCredentials({ sessionId, token, role }) {
  try {
    sessionStorage.setItem(CRED_KEY, JSON.stringify({ sessionId, token, role }))
  } catch {
    /* storage disabled — restore-from-refresh simply unavailable */
  }
}

export function loadCredentials() {
  try {
    const raw = sessionStorage.getItem(CRED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.sessionId !== 'string' || typeof parsed.token !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearCredentials() {
  try {
    sessionStorage.removeItem(CRED_KEY)
  } catch {
    /* ignore */
  }
}
