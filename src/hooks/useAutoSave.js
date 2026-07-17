/**
 * useAutoSave — debounced persistence of the current session on every
 * state-machine transition. Writes `history + currentSession`.
 */

import { useEffect } from 'react'
import { saveSessions } from '../lib/storage.js'

export function useAutoSave(session, history) {
  useEffect(() => {
    if (!session) return
    const id = setTimeout(() => {
      const exists = history.some((s) => s.id === session.id)
      const next = exists
        ? history.map((s) => (s.id === session.id ? session : s))
        : [...history, session]
      saveSessions(next)
    }, 100)
    return () => clearTimeout(id)
  }, [session, history])
}
