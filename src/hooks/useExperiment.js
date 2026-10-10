/**
 * useExperiment — owns the server-backed v2 experiment session.
 *
 * Responsibilities:
 *  - create / join sessions against the same-origin API;
 *  - poll the server about once per second while the session is live,
 *    advancing telepathy phases and picking up the peer's actions;
 *  - apply action responses without races and without reverting newer state;
 *  - restore the same server session after a tab refresh using sessionStorage
 *    credentials, and clear those credentials at terminal/abandon.
 *
 * There is deliberately NO client-side target generation fallback: if the
 * server is unreachable the caller shows an error/retry path instead.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  abandonExperiment,
  clearCredentials,
  createExperiment,
  getExperiment,
  joinRoom,
  loadCredentials,
  nextRound,
  saveCredentials,
  submitGuess,
  submitTarget,
} from '../lib/experiment-api.js'

const POLL_MS = 1000

function friendlyError(err) {
  if (err instanceof ApiError) return { message: err.message, code: err.code, status: err.status }
  return { message: '发生未知错误，请重试。', code: 'unknown', status: 0 }
}

function isTerminal(status) {
  return status === 'COMPLETED' || status === 'ABANDONED'
}

function unwrapSnapshot(res) {
  return res && typeof res === 'object' && res.snapshot ? res.snapshot : res
}

export function useExperiment() {
  const [session, setSession] = useState(null)
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState(null)
  const [canRetry, setCanRetry] = useState(false)

  const credsRef = useRef(null)
  // Monotonic request ordering: every issued request gets a higher seq, and a
  // response is only applied when it is still the newest thing we know about.
  const issueSeq = useRef(0)
  const actionBusy = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const setSnapshot = useCallback((snap, seq) => {
    if (seq != null && seq !== issueSeq.current) return
    setSession(snap)
    setCanRetry(false)
    // A terminal session no longer needs resumable credentials.
    if (snap && isTerminal(snap.status)) {
      clearCredentials()
      credsRef.current = null
    }
    if (snap && snap.role) {
      const creds = credsRef.current
      if (creds) credsRef.current = { ...creds, role: snap.role }
    }
  }, [])

  /** Attach credentials from a create/join response and show its snapshot. */
  const beginFromAuth = useCallback(
    (res, seq) => {
      if (seq !== issueSeq.current) return
      const credentials = { sessionId: res.sessionId, token: res.token, role: res.role }
      credsRef.current = credentials
      saveCredentials(credentials)
      setSnapshot(unwrapSnapshot(res), seq)
    },
    [setSnapshot],
  )

  /** Create a new session (solo module or telepathy sender room). */
  const create = useCallback(
    async (input) => {
      if (actionBusy.current) return false
      actionBusy.current = true
      const seq = ++issueSeq.current
      setBusy(true)
      setError(null)
      try {
        const res = await createExperiment(input)
        if (!mounted.current) return false
        beginFromAuth(res, seq)
        return true
      } catch (err) {
        if (mounted.current) {
          setError(friendlyError(err))
          setCanRetry(false)
        }
        return false
      } finally {
        actionBusy.current = false
        if (mounted.current) setBusy(false)
      }
    },
    [beginFromAuth],
  )

  /** Join an existing telepathy room as the receiver. */
  const join = useCallback(
    async (code) => {
      if (actionBusy.current) return false
      actionBusy.current = true
      const seq = ++issueSeq.current
      setBusy(true)
      setError(null)
      try {
        const res = await joinRoom({ code })
        if (!mounted.current) return false
        beginFromAuth(res, seq)
        return true
      } catch (err) {
        if (mounted.current) {
          setError(friendlyError(err))
          setCanRetry(false)
        }
        return false
      } finally {
        actionBusy.current = false
        if (mounted.current) setBusy(false)
      }
    },
    [beginFromAuth],
  )

  /**
   * Run a role-authorized action (guess/next). Action responses always win:
   * polling is suspended while an action is in flight and the seq guard keeps
   * an older, slower poll response from reverting the action result.
   */
  const runAction = useCallback(
    async (fn) => {
      const creds = credsRef.current
      if (!creds || actionBusy.current) return null
      actionBusy.current = true
      setBusy(true)
      setError(null)
      const seq = ++issueSeq.current
      try {
        const res = await fn(creds)
        if (!mounted.current) return null
        setSnapshot(unwrapSnapshot(res), seq)
        return res
      } catch (err) {
        if (mounted.current) {
          setError(friendlyError(err))
          setCanRetry(!!credsRef.current)
        }
        return null
      } finally {
        actionBusy.current = false
        if (mounted.current) setBusy(false)
      }
    },
    [setSnapshot],
  )

  const guess = useCallback(
    (roundId, guessValue, confidence = null) =>
      runAction((creds) => submitGuess(creds.sessionId, { roundId, guess: guessValue, confidence }, creds.token)),
    [runAction],
  )

  const next = useCallback(
    (roundId) => runAction((creds) => nextRound(creds.sessionId, { roundId }, creds.token)),
    [runAction],
  )

  const target = useCallback(
    (roundId, value) => runAction((creds) => submitTarget(creds.sessionId, { roundId, target: value }, creds.token)),
    [runAction],
  )

  /** Explicit abandon — keeps answered rounds, marks the session ABANDONED. */
  const abandon = useCallback(async () => {
    if (actionBusy.current) return null
    const creds = credsRef.current
    if (!creds) {
      clearCredentials()
      credsRef.current = null
      setSession(null)
      return null
    }
    actionBusy.current = true
    setBusy(true)
    setError(null)
    const seq = ++issueSeq.current
    try {
      const res = await abandonExperiment(creds.sessionId, creds.token)
      if (mounted.current) {
        setSnapshot(unwrapSnapshot(res), seq)
        clearCredentials()
        credsRef.current = null
      }
      return res
    } catch (err) {
      if (mounted.current) {
        setError(friendlyError(err))
        setCanRetry(!!credsRef.current)
      }
      return null
    } finally {
      actionBusy.current = false
      if (mounted.current) setBusy(false)
    }
  }, [setSnapshot])

  /** Give up the local session without a server round-trip. */
  const leave = useCallback(() => {
    ++issueSeq.current
    clearCredentials()
    credsRef.current = null
    setSession(null)
    setError(null)
  }, [])

  /** Retry a failed restore/poll for the same server session. */
  const retry = useCallback(async () => {
    const creds = credsRef.current
    if (!creds || actionBusy.current) return
    actionBusy.current = true
    const seq = ++issueSeq.current
    setRestoring(true)
    setError(null)
    try {
      const snap = await getExperiment(creds.sessionId, creds.token)
      if (!mounted.current) return
      setSnapshot(unwrapSnapshot(snap), seq)
    } catch (err) {
      if (mounted.current) {
        setError(friendlyError(err))
        setCanRetry(!!credsRef.current)
      }
    } finally {
      actionBusy.current = false
      if (mounted.current) setRestoring(false)
    }
  }, [setSnapshot])

  // Restore the same server session after a refresh.
  useEffect(() => {
    const creds = loadCredentials()
    if (!creds || !creds.sessionId || !creds.token) return
    credsRef.current = creds
    let cancelled = false
    const seq = ++issueSeq.current
    setRestoring(true)
    ;(async () => {
      try {
        const snap = await getExperiment(creds.sessionId, creds.token)
        if (cancelled) return
        setSnapshot(unwrapSnapshot(snap), seq)
      } catch (err) {
        if (!cancelled) {
          setError(friendlyError(err))
          setCanRetry(!!credsRef.current)
        }
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setSnapshot])

  // Poll while live: WAITING (telepathy lobby) or IN_PROGRESS.
  const sessionId = session && session.id
  const sessionStatus = session && session.status
  useEffect(() => {
    if (!sessionId || (sessionStatus !== 'WAITING' && sessionStatus !== 'IN_PROGRESS')) return
    let stopped = false
    let pending = false

    const tick = async () => {
      const creds = credsRef.current
      if (stopped || pending || !creds || actionBusy.current) return
      if (typeof document !== 'undefined' && document.hidden) return
      const seq = ++issueSeq.current
      pending = true
      try {
        const snap = await getExperiment(creds.sessionId, creds.token)
        if (stopped) return
        if (seq === issueSeq.current && !actionBusy.current) {
          setSnapshot(unwrapSnapshot(snap), seq)
          setError(null)
        }
      } catch (err) {
        // A transient poll failure must not wipe the visible session.
        if (!stopped && seq === issueSeq.current && !actionBusy.current) {
          setError(friendlyError(err))
          setCanRetry(!!credsRef.current)
        }
      } finally {
        pending = false
      }
    }

    const timer = setInterval(tick, POLL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [sessionId, sessionStatus, setSnapshot])

  const role = session && session.role ? session.role : null
  const activeRound = session && session.activeRound ? session.activeRound : null

  return {
    session,
    role,
    activeRound,
    busy,
    restoring,
    error,
    canRetry,
    create,
    join,
    guess,
    target,
    next,
    abandon,
    retry,
    leave,
  }
}
