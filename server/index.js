/**
 * HTTP entry point for the experiment backend.
 *
 * Usage:
 *   node server/index.js            # PORT=3001 HOST=0.0.0.0
 *
 * Programmatic (used by the coordinator for a real HTTP probe):
 *   import { createExperimentServer } from './server/index.js'
 *   const app = createExperimentServer({ storage: createMemoryStorage() })
 *   const { port } = await app.listen(0, '127.0.0.1')   // ephemeral port
 *   // ... fetch(`http://127.0.0.1:${port}/api/health`)
 *   await app.close()
 *
 * Factory signature:
 *   createExperimentServer(options?: {
 *     clock?: () => number,          // epoch ms, default Date.now
 *     random?: () => number,         // [0,1), default CSPRNG-backed
 *     storage?: { load, save },      // default file store at dataFile
 *     dataFile?: string,             // default '.data/experiments.json'
 *     distDir?: string,              // default 'dist'
 *     bodyLimitBytes?: number,       // default 65536
 *     logger?: { error(...), warn(...), info(...) },
 *     port?: number, host?: string,  // defaults for listen()
 *   }) => {
 *     server: http.Server,
 *     service: ExperimentService,
 *     listen(port?: number, host?: string): Promise<{ port, host }>,
 *     close(): Promise<void>,
 *   }
 *
 * Routes:
 *   GET  /api/health
 *   POST /api/experiments                 { experimentType, roundsPerSession?, sendingDurationMs?, answerDurationMs? }
 *   POST /api/rooms/join                  { code }
 *   GET  /api/experiments/:id
 *   POST /api/experiments/:id/guess       { roundId, guess, confidence? }
 *   POST /api/experiments/:id/target      { roundId, target } (v3 sender only)
 *   POST /api/experiments/:id/next        { roundId }
 *   POST /api/experiments/:id/abandon
 *   GET  *                                 static files from dist/ only
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createExperimentService, HttpError } from './service.js'
import { createFileStorage, DEFAULT_DATA_FILE } from './storage.js'

const DEFAULT_PORT = 3001
const DEFAULT_HOST = '0.0.0.0'
const DEFAULT_BODY_LIMIT = 64 * 1024

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message })
}

/** Fixed-time targets and the private schedule must never be visible to clients. */
/** Bounded JSON body reader. Discards (never buffers) anything past the limit. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'])
    if (Number.isFinite(declared) && declared > limit) {
      req.on('error', () => {})
      req.resume() // drain so the 413 response can flush cleanly
      reject(new HttpError(413, 'request body too large'))
      return
    }
    let settled = false
    let size = 0
    let tooLarge = false
    const hardCap = limit * 1024
    const chunks = []
    const fail = (err) => {
      if (settled) return
      settled = true
      reject(err)
    }
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > hardCap) {
        req.destroy()
        fail(new HttpError(413, 'request body too large'))
        return
      }
      if (size > limit) {
        tooLarge = true
        return // stop buffering; keep draining
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      if (tooLarge) {
        reject(new HttpError(413, 'request body too large'))
        return
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) {
        resolve({})
        return
      }
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        reject(new HttpError(400, 'invalid JSON body'))
        return
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        reject(new HttpError(400, 'JSON body must be an object'))
        return
      }
      resolve(parsed)
    })
    req.on('error', fail)
  })
}

function bearerToken(req) {
  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

/** Serve files from distDir only; never escape it and never touch private data. */
function serveStatic(req, res, distDir) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendError(res, 405, 'method not allowed')
    return
  }
  const url = new URL(req.url, 'http://localhost')
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    sendError(res, 400, 'invalid path')
    return
  }
  if (pathname.includes('\0')) {
    sendError(res, 400, 'invalid path')
    return
  }

  const indexFile = path.join(distDir, 'index.html')

  const resolveWithinDist = (requestPath) => {
    const relative = requestPath.replace(/^\/+/, '')
    const candidate = path.resolve(distDir, relative)
    const rel = path.relative(distDir, candidate)
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null
    return candidate
  }

  const tryFile = (filePath) => {
    try {
      const stat = fs.statSync(filePath)
      if (stat.isFile()) return filePath
    } catch {
      /* not found */
    }
    return null
  }

  let filePath = resolveWithinDist(pathname)
  if (pathname === '/' || pathname === '') filePath = indexFile

  let resolvedFile = filePath ? tryFile(filePath) : null
  // SPA fallback for extension-less routes.
  if (!resolvedFile && !path.extname(pathname)) resolvedFile = tryFile(indexFile)

  if (!resolvedFile) {
    sendError(res, 404, 'not found')
    return
  }

  const type = MIME_TYPES[path.extname(resolvedFile).toLowerCase()] || 'application/octet-stream'
  let data
  try {
    data = fs.readFileSync(resolvedFile)
  } catch {
    sendError(res, 404, 'not found')
    return
  }
  res.writeHead(200, {
    'content-type': type,
    'content-length': data.length,
    'cache-control': 'no-cache',
  })
  res.end(req.method === 'HEAD' ? undefined : data)
}

async function handleRequest(req, res, ctx) {
  const { service, distDir, bodyLimit, logger } = ctx
  let url
  try {
    url = new URL(req.url, 'http://localhost')
  } catch {
    sendError(res, 400, 'invalid request')
    return
  }
  const { pathname } = url
  const method = req.method || 'GET'

  try {
    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/health') {
        if (method !== 'GET') return sendError(res, 405, 'method not allowed')
        return sendJson(res, 200, service.health())
      }

      if (pathname === '/api/experiments') {
        if (method !== 'POST') return sendError(res, 405, 'method not allowed')
        const body = await readBody(req, bodyLimit)
        const result = await service.createExperiment(body)
        return sendJson(res, 201, result)
      }

      if (pathname === '/api/rooms/join') {
        if (method !== 'POST') return sendError(res, 405, 'method not allowed')
        const body = await readBody(req, bodyLimit)
        const result = await service.joinRoom(body)
        return sendJson(res, 201, result)
      }

      const targetMatch = /^\/api\/experiments\/([^/]+)\/target$/.exec(pathname)
      if (targetMatch) {
        if (method !== 'POST') return sendError(res, 405, 'method not allowed')
        const body = await readBody(req, bodyLimit)
        const snapshot = await service.submitTarget({
          id: targetMatch[1], token: bearerToken(req), roundId: body.roundId, target: body.target,
        })
        return sendJson(res, 200, snapshot)
      }

      const guessMatch = /^\/api\/experiments\/([^/]+)\/guess$/.exec(pathname)
      if (guessMatch) {
        if (method !== 'POST') return sendError(res, 405, 'method not allowed')
        const body = await readBody(req, bodyLimit)
        const snapshot = await service.submitGuess({
          id: guessMatch[1],
          token: bearerToken(req),
          roundId: body.roundId,
          guess: body.guess,
          confidence: body.confidence,
        })
        return sendJson(res, 200, snapshot)
      }

      const nextMatch = /^\/api\/experiments\/([^/]+)\/next$/.exec(pathname)
      if (nextMatch) {
        if (method !== 'POST') return sendError(res, 405, 'method not allowed')
        const body = await readBody(req, bodyLimit)
        const snapshot = await service.advanceRound({
          id: nextMatch[1],
          token: bearerToken(req),
          roundId: body.roundId,
        })
        return sendJson(res, 200, snapshot)
      }

      const abandonMatch = /^\/api\/experiments\/([^/]+)\/abandon$/.exec(pathname)
      if (abandonMatch) {
        if (method !== 'POST') return sendError(res, 405, 'method not allowed')
        // Body is optional; drain whatever was sent without parsing it.
        req.resume()
        const snapshot = await service.abandon({
          id: abandonMatch[1],
          token: bearerToken(req),
        })
        return sendJson(res, 200, snapshot)
      }

      const getMatch = /^\/api\/experiments\/([^/]+)$/.exec(pathname)
      if (getMatch) {
        if (method !== 'GET') return sendError(res, 405, 'method not allowed')
        const snapshot = await service.getSnapshot({
          id: getMatch[1],
          token: bearerToken(req),
        })
        return sendJson(res, 200, snapshot)
      }

      return sendError(res, 404, 'unknown endpoint')
    }

    return serveStatic(req, res, distDir)
  } catch (err) {
    if (err instanceof HttpError) {
      return sendError(res, err.status, err.message)
    }
    if (logger && logger.error) logger.error('request failed', err)
    return sendError(res, 500, 'internal server error')
  }
}

/**
 * Create a server instance. See the module header for the full signature.
 */
export function createExperimentServer(options = {}) {
  const distDir = path.resolve(options.distDir || 'dist')
  const bodyLimit = Number.isInteger(options.bodyLimitBytes)
    ? options.bodyLimitBytes
    : DEFAULT_BODY_LIMIT
  const logger = options.logger || console
  const storage = options.storage || createFileStorage(options.dataFile || DEFAULT_DATA_FILE)

  const service = createExperimentService({
    clock: options.clock,
    random: options.random,
    storage,
    defaults: options.defaults,
  })

  const server = http.createServer((req, res) => {
    handleRequest(req, res, { service, distDir, bodyLimit, logger }).catch((err) => {
      if (logger && logger.error) logger.error('unhandled request error', err)
      if (!res.headersSent) sendError(res, 500, 'internal server error')
      else res.end()
    })
  })

  return {
    server,
    service,
    storage,
    /**
     * Start listening. Works both Node-style and promise-style:
     *   await app.listen(0, '127.0.0.1')           // -> { port, host }
     *   app.listen(0, () => { ... app.address() })  // callback also supported
     */
    async listen(port = options.port ?? DEFAULT_PORT, host = options.host ?? DEFAULT_HOST, callback) {
      if (typeof host === 'function') {
        callback = host
        host = options.host ?? DEFAULT_HOST
      }
      await service.ensureInit()
      await new Promise((resolve, reject) => {
        const onError = (err) => {
          server.removeListener('listening', onListening)
          reject(err)
        }
        const onListening = () => {
          server.removeListener('error', onError)
          resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port, host)
      })
      const address = server.address()
      const info = { port: address.port, host: address.address }
      if (callback) callback(info)
      return info
    },
    address() {
      return server.address()
    },
    async close(callback) {
      await new Promise((resolve) => {
        server.close(() => resolve())
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
      })
      if (callback) callback()
    },
  }
}

export const createServer = createExperimentServer

function isMainModule() {
  if (!process.argv[1]) return false
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
}

if (isMainModule()) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  const host = process.env.HOST || DEFAULT_HOST
  const app = createExperimentServer({})
  app
    .listen(port, host)
    .then(({ port: boundPort, host: boundHost }) => {
      // eslint-disable-next-line no-console
      console.log(`[experiments] listening on http://${boundHost}:${boundPort}`)
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[experiments] failed to start', err)
      process.exitCode = 1
    })

  const shutdown = () => {
    app.close().finally(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
