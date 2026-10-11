import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { HttpError } from './service.js'

const hash = value => createHash('sha256').update(value).digest('hex')
const nonce = () => randomBytes(32).toString('base64url')
const cookieValue = (req, name) => {
  const entry = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))
  return entry?.slice(name.length + 1) || ''
}
function equal(a, b) {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '')
  return x.length === y.length && timingSafeEqual(x, y)
}

export function createAuth(options = {}) {
  const config = {
    baseUrl: process.env.RARICY_BASE_URL || 'https://raricy.com',
    clientId: process.env.RARICY_CLIENT_ID,
    clientSecret: process.env.RARICY_CLIENT_SECRET,
    redirectUri: process.env.RARICY_REDIRECT_URI || 'https://ling.raricy.com/oauth/callback',
    ...options.config,
  }
  const fetcher = options.fetch || fetch
  const clock = options.clock || Date.now
  const sessions = new Map(), states = new Map()
  const origin = new URL(config.redirectUri).origin
  const secure = origin.startsWith('https:')
  const configured = Boolean(config.clientId && config.clientSecret)
  const cookie = (name, value, age) => `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`
  function sweep() {
    for (const [key, item] of states) if (item.expires <= clock()) states.delete(key)
    for (const [key, item] of sessions) if (item.expires <= clock()) sessions.delete(key)
  }
  async function remote(endpoint, init) {
    const res = await fetcher(new URL(endpoint, config.baseUrl), { ...init, signal: AbortSignal.timeout(10_000), redirect: 'error' })
    if (!res.ok) throw new HttpError(res.status === 401 ? 401 : 502, 'raricy authorization failed')
    return res.json()
  }
  function csrf(req) {
    const requestOrigin = req.headers.origin
    if (!requestOrigin || requestOrigin !== origin) throw new HttpError(403, 'invalid request origin')
  }
  return {
    configured, origin, csrf, sweep,
    start(req, res) {
      sweep()
      if (!configured) throw new HttpError(503, 'raricy login is not configured')
      if (states.size >= 1000) throw new HttpError(429, 'too many login attempts')
      const state = nonce(), binding = nonce()
      states.set(hash(state), { binding: hash(binding), expires: clock() + 600_000 })
      const url = new URL('/oauth/authorize', config.baseUrl)
      url.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri, scope: 'profile', state }).toString()
      res.writeHead(302, { location: url.href, 'set-cookie': cookie('raricy_oauth', binding, 600), 'cache-control': 'no-store' }); res.end()
    },
    async callback(req, res, url) {
      sweep()
      const state = url.searchParams.get('state') || ''
      const pending = states.get(hash(state))
      if (!pending || !equal(pending.binding, hash(cookieValue(req, 'raricy_oauth')))) throw new HttpError(400, 'invalid OAuth state')
      states.delete(hash(state)) // single use, including denial and failed exchange
      if (url.searchParams.has('error')) {
        res.writeHead(302, { location: '/?auth=denied', 'set-cookie': cookie('raricy_oauth', '', 0), 'cache-control': 'no-store' }); res.end(); return
      }
      const code = url.searchParams.get('code')
      if (!code || code.length > 2048) throw new HttpError(400, 'missing authorization code')
      const token = await remote('/api/oauth/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString('base64')}` },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri }).toString(),
      })
      if (typeof token.access_token !== 'string' || token.token_type?.toLowerCase() !== 'bearer') throw new HttpError(502, 'invalid OAuth token response')
      const profile = await remote('/api/oauth/userinfo', { headers: { authorization: `Bearer ${token.access_token}` } })
      if (typeof profile.sub !== 'string' || !profile.sub || typeof profile.username !== 'string') throw new HttpError(502, 'invalid OAuth profile')
      const sid = nonce()
      sessions.set(hash(sid), { token: token.access_token, account: { sub: profile.sub, username: profile.username }, expires: clock() + Math.min(86400, Number(token.expires_in) || 86400) * 1000 })
      res.writeHead(302, { location: '/', 'set-cookie': [cookie('raricy_session', sid, 86400), cookie('raricy_oauth', '', 0)], 'cache-control': 'no-store' }); res.end()
    },
    async account(req) {
      sweep()
      const key = hash(cookieValue(req, 'raricy_session'))
      const session = sessions.get(key)
      if (!session) return null
      // Revalidate against raricy on every authenticated request: revoke/ban takes effect immediately.
      try {
        const profile = await remote('/api/oauth/userinfo', { headers: { authorization: `Bearer ${session.token}` } })
        if (profile.sub !== session.account.sub) throw new HttpError(401, 'raricy account changed')
        return { sub: profile.sub, username: String(profile.username) }
      } catch (error) {
        if (error.status === 401) { sessions.delete(key); return null }
        throw error
      }
    },
    async logout(req, res) {
      csrf(req)
      const key = hash(cookieValue(req, 'raricy_session')), session = sessions.get(key)
      sessions.delete(key)
      if (session) await remote('/api/oauth/revoke', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: session.token }) }).catch(() => {})
      res.setHeader('set-cookie', cookie('raricy_session', '', 0))
    },
  }
}
