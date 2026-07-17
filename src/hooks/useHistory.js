/**
 * useHistory — load + persist all completed sessions.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  loadSessions,
  saveSessions,
  loadSettings,
  saveSettings,
} from '../lib/storage.js'
import { DEFAULT_APP_SETTINGS } from '../lib/statistics.js'

export function useHistory() {
  const [history, setHistory] = useState(() => loadSessions())
  const [settings, setSettings] = useState(() => loadSettings())

  // Re-load on mount in case other tabs modified storage.
  useEffect(() => {
    setHistory(loadSessions())
    setSettings(loadSettings())
  }, [])

  const updateHistory = useCallback((next) => {
    setHistory(next)
    saveSessions(next)
  }, [])

  const appendSession = useCallback(
    (session) => {
      setHistory((prev) => {
        // Idempotent: if a session with the same id is already present
        // (e.g., the user resumed an IN_PROGRESS session from localStorage
        // and we are now finalising it), replace in place rather than
        // appending a duplicate.
        const exists = prev.some((s) => s.id === session.id)
        const next = exists
          ? prev.map((s) => (s.id === session.id ? session : s))
          : [...prev, session]
        saveSessions(next)
        return next
      })
    },
    [],
  )

  const clearAll = useCallback(() => {
    setHistory([])
    saveSessions([])
  }, [])

  const replaceHistory = useCallback((next) => {
    setHistory(next)
    saveSessions(next)
  }, [])

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...DEFAULT_APP_SETTINGS, ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return {
    history,
    settings,
    updateHistory,
    appendSession,
    clearAll,
    replaceHistory,
    updateSettings,
  }
}
