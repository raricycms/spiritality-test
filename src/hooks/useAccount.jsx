import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getAccountSession, getAccountHistory, logoutAccount, saveAccountDses, deleteAccountDses, clearAccountExperiments } from '../lib/account-api.js'

const Context = createContext({ account: null, loading: false, configured: false, history: { experiments: [], dses: [] } })
export function AccountProvider({ children }) {
  const [account, setAccount] = useState(null), [loading, setLoading] = useState(true), [configured, setConfigured] = useState(false)
  const [history, setHistory] = useState({ experiments: [], dses: [] }), [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try { const next = await getAccountHistory(); setHistory(next); setError(''); return next }
    catch (e) { setError(e.message); throw e }
  }, [])
  useEffect(() => {
    let alive = true
    getAccountSession().then(async value => {
      if (!alive) return
      setAccount(value.account); setConfigured(value.configured)
      if (value.account) {
        try { const next = await getAccountHistory(); if (alive) setHistory(next) } catch (e) { if (alive) setError(e.message) }
      }
    }).catch(() => { if (alive) setError('账号服务暂不可用') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  async function logout() { await logoutAccount(); setAccount(null); setHistory({ experiments: [], dses: [] }); setError('') }
  async function saveDses(answers) { const record = await saveAccountDses(answers); await refresh(); return record }
  async function deleteDses(id) { await deleteAccountDses(id); await refresh() }
  async function clearExperiments() { await clearAccountExperiments(); await refresh() }
  return <Context.Provider value={{ account, loading, configured, history, error, refresh, logout, saveDses, deleteDses, clearExperiments }}>{children}</Context.Provider>
}
export const useAccount = () => useContext(Context)
