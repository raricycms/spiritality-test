import { useCallback, useEffect, useState } from 'react'
import { useHistory } from './hooks/useHistory.js'
import { useSession } from './hooks/useSession.js'
import { useSpiritualityProbability } from './hooks/useSpiritualityProbability.js'
import { useKeyboard } from './hooks/useKeyboard.js'
import { useAutoSave } from './hooks/useAutoSave.js'

import { RoundView } from './components/RoundView.jsx'
import { SessionSummary } from './components/SessionSummary.jsx'
import { HistoryList } from './components/HistoryList.jsx'
import { SpiritualityGauge } from './components/SpiritualityGauge.jsx'
import { SettingsPanel } from './components/SettingsPanel.jsx'

import { exportAll, clearAll as clearAllStorage, saveSessions } from './lib/storage.js'
import './App.css'

export function App() {
  const {
    history,
    settings,
    appendSession,
    replaceHistory,
    clearAll,
    updateSettings,
  } = useHistory()

  const sessionApi = useSession({ history, settings })
  const {
    session,
    activeRound,
    start,
    onPreview,
    onSubmit,
    onNextRound,
    onAbandonRound,
    endAndArchive,
    loadSession,
  } = sessionApi

  useAutoSave(session, history)

  // Detect theme
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const pref = settings.theme === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : settings.theme
      root.dataset.theme = pref
    }
    apply()
    if (settings.theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [settings.theme])

  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const statistics = useSpiritualityProbability(
    session && session.status === 'COMPLETED'
      ? [...history, session]   // include just-completed for instant summary
      : history,
    settings,
  )

  const isCompleted = session && session.status === 'COMPLETED'

  // Keyboard handling — depends on which view is active.
  useKeyboard(
    useCallback(
      (action) => {
        if (!session || session.status !== 'IN_PROGRESS' || !activeRound) {
          // history view or completed — only Enter / Space do anything
          if (action.type === 'enter' && isCompleted) {
            const finalSession = endAndArchive()
            if (finalSession) appendSession(finalSession)
            return
          }
          return
        }
        if (activeRound.status === 'REVEALED') {
          if (action.type === 'next' || action.type === 'enter') {
            onNextRound()
          }
          if (action.type === 'clear') {
            // no-op here
          }
          return
        }
        // Active guessing
        if (action.type === 'digit') {
          onPreview(activeRound.id, action.value)
        } else if (action.type === 'enter') {
          if (activeRound.guess != null) onSubmit(activeRound.id, activeRound.guess)
        } else if (action.type === 'clear') {
          onPreview(activeRound.id, null)  // unselect
        }
      },
      [
        session,
        activeRound,
        isCompleted,
        onPreview,
        onSubmit,
        onNextRound,
        endAndArchive,
      ],
    ),
  )

  // On mount, check for resumable in-progress session.
  useEffect(() => {
    if (!session) {
      const resumable = history.find((s) => s.status === 'IN_PROGRESS')
      if (resumable) {
        loadSession(resumable)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle restart from summary
  function handleArchiveAndReset() {
    const finalSession = endAndArchive()
    if (finalSession) appendSession(finalSession)
    start()
  }

  function handleExport() {
    const blob = exportAll()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spirituality-export-${ts}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(file) {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text)
        if (!Array.isArray(parsed.sessions)) throw new Error('bad format')
        const merged = mergeSessions(history, parsed.sessions)
        replaceHistory(merged)
        if (parsed.settings) updateSettings(parsed.settings)
        alert(`导入成功 (${parsed.sessions.length} 条 session)`)
      } catch (e) {
        alert('导入失败：' + e.message)
      }
    })
  }

  function handleClear() {
    if (!confirm('确定清空所有历史数据？此操作不可恢复。')) return
    clearAll()
    clearAllStorage()
  }

  // Top bar
  const Header = (
    <div className="topbar">
      <div className="left">
        <div className="window-dots">
          <span className="dot close" />
          <span className="dot min" />
          <span className="dot max" />
        </div>
        <h1 className="title">灵性测试</h1>
      </div>
      <div className="actions">
        <button className="ghost-btn icon-btn" onClick={() => setShowSettings(true)} aria-label="设置">⚙</button>
        <button className="ghost-btn icon-btn" onClick={() => setShowHistory(true)} aria-label="历史">≡</button>
      </div>
    </div>
  )

  return (
    <div className="app">
      {Header}
      <main className="main">
        {showHistory ? (
          <div className="card">
            <HistoryList
              history={history}
              onClose={() => setShowHistory(false)}
              onExport={handleExport}
              onImport={handleImport}
              onClear={handleClear}
            />
          </div>
        ) : showSettings ? (
          <div className="card">
            <SettingsPanel
              settings={settings}
              onChange={updateSettings}
              onClose={() => setShowSettings(false)}
            />
          </div>
        ) : isCompleted ? (
          <div className="card">
            <SessionSummary
              session={session}
              statistics={statistics}
              onRestart={handleArchiveAndReset}
              onViewHistory={() => setShowHistory(true)}
            />
          </div>
        ) : session && activeRound ? (
          <div className="card">
            <RoundView
              round={activeRound}
              roundNumber={activeRound.index + 1}
              totalRounds={session.settings.roundsPerSession}
              onPreview={onPreview}
              onSubmit={onSubmit}
              onNext={onNextRound}
            />
          </div>
        ) : (
          <div className="card hero">
            <h2 className="hero-title">每一轮，数字已经在那了。</h2>
            <p className="hero-subtitle">
              你猜一个 1 到 5 的数字，看每次是否猜中。
              全场 30 轮。基于你所有历史数据计算"P(p ≠ 0.20)"的概率。
            </p>
            <button className="primary-btn big" onClick={() => start()}>
              开始一场测试
            </button>
          </div>
        )}

        <SpiritualityGauge
          statistics={statistics}
          settings={settings}
          onViewSwitch={(v) => updateSettings({ view: v })}
        />
      </main>
      <footer className="footer">
        目标数在你开始猜测前就已经生成并冻结。详见 <code>03-core-mechanics.md</code>。
      </footer>
    </div>
  )
}

function mergeSessions(existing, incoming) {
  const map = new Map()
  for (const s of existing) map.set(s.id, s)
  for (const s of incoming) {
    const cur = map.get(s.id)
    if (!cur || (s.completedAt ?? 0) >= (cur.completedAt ?? 0)) {
      map.set(s.id, s)
    }
  }
  return [...map.values()]
}
