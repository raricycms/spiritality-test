/**
 * useSession — owns the current in-progress session and the action dispatchers.
 * Returns the session, derived "active round", and actions.
 * Persists to localStorage via storage.saveSessions().
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  beginSession,
  enterNewRound,
  previewGuess,
  submitGuess,
  abandonRound,
  completeSession,
  findActiveRound,
} from '../lib/state-machine.js'
import { summarizeSession } from '../lib/storage.js'
import {
  saveSessions,
} from '../lib/storage.js'

const initial = { session: null, history: [] }

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE': {
      return { session: action.session, history: action.history }
    }
    case 'SET_SESSION':
      return { ...state, session: action.session }
    case 'SET_HISTORY':
      return { ...state, history: action.history }
    default:
      return state
  }
}

export function useSession({ history, settings }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const sessionRef = useRef(null)

  // Hydrate from props
  useEffect(() => {
    dispatch({ type: 'HYDRATE', session: null, history })
  }, []) // initial only

  // Keep history reflected for downstream
  useEffect(() => {
    dispatch({ type: 'SET_HISTORY', history })
  }, [history])

  const currentSession = state.session
  const activeRound = useMemo(
    () => (currentSession ? findActiveRound(currentSession) : null),
    [currentSession],
  )

  const persistHistory = useCallback((history) => {
    saveSessions(history)
  }, [])

  const start = useCallback(() => {
    const s = beginSession({ roundsPerSession: settings.roundsPerSession })
    const withRound = enterNewRound(s)
    sessionRef.current = withRound
    dispatch({ type: 'SET_SESSION', session: withRound })
    return withRound
  }, [settings.roundsPerSession])

  const updateSession = useCallback((next) => {
    sessionRef.current = next
    dispatch({ type: 'SET_SESSION', session: next })
  }, [])

  const onPreview = useCallback(
    (roundId, guess) => {
      if (!currentSession) return
      updateSession(previewGuess(currentSession, roundId, guess))
    },
    [currentSession, updateSession],
  )

  const onSubmit = useCallback(
    (roundId, guess) => {
      if (!currentSession) return
      const next = submitGuess(currentSession, roundId, guess)
      // If this was the last round, finalize the session.
      const allRevealed = next.rounds.every(
        (r) => r.status === 'REVEALED' || r.status === 'ABANDONED',
      )
      if (allRevealed && next.rounds.length >= next.settings.roundsPerSession) {
        const summary = summarizeSession(next)
        updateSession(completeSession(next, summary))
      } else {
        updateSession(next)
      }
    },
    [currentSession, updateSession],
  )

  const onNextRound = useCallback(() => {
    if (!currentSession) return
    if (currentSession.rounds.length >= currentSession.settings.roundsPerSession) {
      return
    }
    updateSession(enterNewRound(currentSession))
  }, [currentSession, updateSession])

  const onAbandonRound = useCallback(
    (roundId) => {
      if (!currentSession) return
      updateSession(abandonRound(currentSession, roundId))
    },
    [currentSession, updateSession],
  )

  const endAndArchive = useCallback(() => {
    if (!currentSession) return null
    // After a normal session completion, currentSession is already COMPLETED
    // (set in onSubmit). The mid-session abandon path sets it to IN_PROGRESS
    // and we need to compute & attach a summary before saving.
    let final = currentSession
    if (currentSession.status === 'IN_PROGRESS') {
      const summary = summarizeSession(currentSession)
      final = completeSession(currentSession, summary)
    }
    const nextHistory = [...history, final]
    persistHistory(nextHistory)
    dispatch({ type: 'SET_SESSION', session: null })
    sessionRef.current = null
    return nextHistory
  }, [currentSession, history, persistHistory])

  const loadSession = useCallback((session) => {
    if (!session || session.status === 'COMPLETED') return
    sessionRef.current = session
    dispatch({ type: 'SET_SESSION', session })
  }, [])

  return {
    session: currentSession,
    activeRound,
    history: state.history,
    start,
    onPreview,
    onSubmit,
    onNextRound,
    onAbandonRound,
    endAndArchive,
    loadSession,
  }
}
