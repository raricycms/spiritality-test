import { useCallback, useEffect, useRef, useState } from 'react'
import { useHistory } from './hooks/useHistory.js'
import { useExperiment } from './hooks/useExperiment.js'
import { ExperimentFlow, MODULE_LABELS } from './components/ExperimentFlow.jsx'
import { ExperimentResults } from './components/ExperimentResults.jsx'
import { ExperimentHistory } from './components/ExperimentHistory.jsx'
import { SettingsPanel } from './components/SettingsPanel.jsx'
import { DsesQuestionnaire } from './components/DsesQuestionnaire.jsx'
import { I18nProvider, useI18n } from './i18n/I18n.jsx'
import { OpeningAnimation } from './components/OpeningAnimation.jsx'
import { Icon } from './components/Icon.jsx'
import { CandidateSetPicker } from './components/CandidateSymbols.jsx'
import { AccountProvider, useAccount } from './hooks/useAccount.jsx'
import { AccountBanner, AccountReport } from './components/AccountPanel.jsx'
import {
  saveExperimentHistory,
  loadExperimentHistory,
  mergeExperimentHistory,
  exportExperimentHistory,
  parseExperimentHistory,
} from './lib/experiment-history.js'
import './App.css'

const MODULES = [
  {
    type: 'hidden',
    name: MODULE_LABELS.hidden,
    desc: '服务端先选定一个目标，再请你猜测；揭晓前目标不可见。',
    solo: true,
  },
  {
    type: 'precognition',
    name: MODULE_LABELS.precognition,
    desc: '服务端先锁定你的答案，再随机生成目标；目标在你作答时尚未存在。',
    solo: true,
  },
  {
    type: 'telepathy',
    name: MODULE_LABELS.telepathy,
    desc: '发送者先选择并锁定目标，接收者独立选择，揭晓时比较是否一致。',
    solo: false,
  },
]

function clampRounds(value) {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return 30
  return Math.max(5, Math.min(200, n))
}

function safeLoadV2History() {
  try {
    const v = loadExperimentHistory()
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function safeMerge(existing, incoming) {
  return mergeExperimentHistory(existing, incoming)
}

function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function AppContent() {
  const { language, setLanguage, t, localize } = useI18n()
  const auth = useAccount()
  const {
    history: v1History,
    settings,
    updateSettings,
    clearAll: clearAllV1,
  } = useHistory()

  const experiment = useExperiment()
  const {
    session,
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
  } = experiment

  const [view, setView] = useState('main') // main | history | settings | dses
  const [selectedModule, setSelectedModule] = useState(null)
  const [telepathyMode, setTelepathyMode] = useState('create') // create | join
  const [rounds, setRounds] = useState(() => clampRounds(settings?.roundsPerSession ?? 30))
  const [candidateSet, setCandidateSet] = useState('digits')
  const [code, setCode] = useState('')
  const [v2History, setV2History] = useState(() => safeLoadV2History())
  const [historyError, setHistoryError] = useState('')
  const [resolvedTheme, setResolvedTheme] = useState(() => settings.theme === 'dark' ||
    (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light')

  const savedTerminalRef = useRef(null)
  const pendingSaveRef = useRef(null)
  const previousAccountRef = useRef(undefined)

  useEffect(() => {
    if (auth.loading) return
    const id = auth.account?.sub || null
    if (previousAccountRef.current !== undefined && previousAccountRef.current !== id) {
      leave()
      setView('main')
      setSelectedModule(null)
      savedTerminalRef.current = null
      setHistoryError('')
    }
    previousAccountRef.current = id
    setV2History(auth.account ? auth.history.experiments : safeLoadV2History())
    pendingSaveRef.current = null
  }, [auth.account?.sub, auth.history, auth.loading, leave])

  // Theme: auto follows the OS, manual override still available in settings.
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const pref =
        settings.theme === 'auto'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : settings.theme
      root.dataset.theme = pref
      root.style.colorScheme = pref
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', pref === 'dark' ? '#131d2b' : '#f3f6fb')
      setResolvedTheme(pref)
    }
    apply()
    if (settings.theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    return undefined
  }, [settings.theme])

  // Persist terminal safe snapshots immediately, by id, into the v2 history.
  useEffect(() => {
    const s = session
    if (auth.loading) return
    if (!s || !s.id) return
    if (s.status !== 'COMPLETED' && s.status !== 'ABANDONED') return
    const key = `${s.id}:${s.status}`
    if (savedTerminalRef.current === key) return
    savedTerminalRef.current = key
    if (auth.account) {
      auth.refresh().catch(() => setHistoryError('账号历史暂时无法读取，请在报告页重试。'))
      return
    }
    setV2History((prev) => {
      const merged = safeMerge(prev, [s])
      pendingSaveRef.current = merged
      return merged
    })
  }, [session, auth.loading, auth.account?.sub, auth.refresh])

  // Persist the merged v2 history outside the state updater (side-effect free).
  useEffect(() => {
    if (pendingSaveRef.current == null) return
    const merged = pendingSaveRef.current
    pendingSaveRef.current = null
    try {
      if (saveExperimentHistory(merged) === false) {
        setHistoryError('历史未能保存到本机。记录暂留在当前页面，请导出备份后再关闭。')
      }
    } catch {
      setHistoryError('历史保存失败，请导出备份后再关闭页面。')
    }
  })

  const isTerminal = session && (session.status === 'COMPLETED' || session.status === 'ABANDONED')

  const handleStartSolo = useCallback(
    async (type) => {
      await create({ experimentType: type, roundsPerSession: clampRounds(rounds), candidateSet })
    },
    [create, rounds, candidateSet],
  )

  const handleCreateRoom = useCallback(async () => {
    await create({ experimentType: 'telepathy', roundsPerSession: clampRounds(rounds), candidateSet })
  }, [create, rounds, candidateSet])

  const handleJoinRoom = useCallback(async () => {
    const trimmed = code.trim()
    if (!trimmed) return
    await join(trimmed)
  }, [code, join])

  const handleRestartSameModule = useCallback(() => {
    const s = session
    if (!s) {
      leave()
      return
    }
    if (s.experimentType === 'telepathy' && s.role === 'receiver') {
      // A telepathy receiver cannot re-create; return them to the join flow.
      leave()
      setSelectedModule('telepathy')
      setTelepathyMode('join')
      return
    }
    leave()
    setSelectedModule(s.experimentType)
    setTelepathyMode('create')
    setRounds(clampRounds(s.settings?.roundsPerSession ?? 30))
    setCandidateSet(s.settings?.candidateSet ?? 'digits')
  }, [session, leave])

  const handleReturnHome = useCallback(() => {
    leave()
    setSelectedModule(null)
    setTelepathyMode('create')
    setCode('')
    setView('main')
  }, [leave])

  /* ---------------- v2 history export / import / clear ---------------- */

  function handleExportV2() {
    const blob = exportExperimentHistory(v2History)
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `experiment-history-v2-${ts}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportV2(file) {
    try {
      const incoming = parseExperimentHistory(await file.text())
      const merged = mergeExperimentHistory(v2History, incoming)
      if (saveExperimentHistory(merged) === false) throw new Error('本机存储不可用，未写入')
      setV2History(merged)
      setHistoryError('')
      alert(t(`导入成功（${incoming.length} 条记录）`))
    } catch (e) {
      alert(t('导入失败：' + e.message))
    }
  }

  async function handleClearV2() {
    if (!confirm(t('确定清空新协议的实验历史？此操作不会影响旧版（v1）记录。'))) return
    if (auth.account) {
      try { await auth.clearExperiments() } catch { setHistoryError('清空账号历史失败，请重试。') }
      return
    }
    try {
      if (saveExperimentHistory([]) === false) throw new Error('本机存储不可用')
    } catch {
      setHistoryError('清空失败：本机存储不可用。')
      return
    }
    setV2History([])
    setHistoryError('')
  }

  function handleClearV1() {
    if (!confirm(t('确定清空旧版（v1）历史记录？此操作不可恢复。'))) return
    clearAllV1()
  }

  /* ---------------- header ---------------- */

  const Header = (
    <header className="topbar">
      <div className="left">
        <span className="brand-symbol"><Icon name="orbit" /></span>
        <h1 className="title">灵性实验室</h1>
      </div>
      <div className="actions">
        <button type="button" className="language-btn" aria-label={t('切换语言')} aria-pressed={language === 'en'} onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>
          <span lang="zh-CN" className={language === 'zh' ? 'is-active' : ''}>中</span><span className="language-divider">/</span><span lang="en" className={language === 'en' ? 'is-active' : ''}>En</span>
        </button>
        <button type="button" className="ghost-btn icon-btn" onClick={() => updateSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })} aria-label={t(resolvedTheme === 'dark' ? '切换到亮色模式' : '切换到暗色模式')} title={t(resolvedTheme === 'dark' ? '切换到亮色模式' : '切换到暗色模式')}>
          <Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <span className="toolbar-divider" aria-hidden="true" />
        <button className="ghost-btn icon-btn" onClick={() => setView('settings')} aria-label="设置" title="设置"><Icon name="settings-2" /></button>
        <button className="ghost-btn icon-btn" onClick={() => setView('history')} aria-label="历史" title="历史"><Icon name="history" /></button>
      </div>
    </header>
  )

  /* ---------------- main content ---------------- */

  function renderModuleSelector() {
    return (
      <div className="hero">
        <div className="hero-emblem" aria-hidden="true"><Icon name="orbit" /></div>
        <h2 className="hero-title">选择一项实验</h2>
        <p className="hero-subtitle">
          分别探索隐藏目标、未来事件、双人感应与日常灵性体验。每项测验独立记录和计分。
        </p>
        <div className="module-grid">
          {MODULES.map((m) => (
            <div className={`module-card module-${m.type}`} key={m.type}>
              <div className="module-symbol" aria-hidden="true"><Icon name={{hidden:'eye',precognition:'sparkles',telepathy:'radio'}[m.type]} /></div>
              <h3 className="module-name">{m.name}</h3>
              <p className="module-desc">{m.desc}</p>
              <button
                className="primary-btn"
                onClick={() => {
                  setSelectedModule(m.type)
                  setTelepathyMode('create')
                }}
                disabled={busy}
              >
                选择
              </button>
            </div>
          ))}
          <div className="module-card module-dses">
            <div className="module-symbol" aria-hidden="true"><Icon name="heart" /></div>
            <h3 className="module-name">日常灵性体验（DSES）</h3>
            <p className="module-desc">英文原版配合中文答题辅助，记录个人体验频率与变化。</p>
            <button className="primary-btn" onClick={() => setView('dses')}>填写问卷</button>
          </div>
        </div>
      </div>
    )
  }

  function renderSetup() {
    const module = MODULES.find((m) => m.type === selectedModule)
    if (!module) return null
    return (
      <div className="setup">
        <div className="setup-head">
          <h2 className="setup-title">{module.name}</h2>
          <button className="ghost-btn" onClick={() => setSelectedModule(null)} disabled={busy}>
            返回
          </button>
        </div>
        <p className="setup-desc">{module.desc}</p>

        {error && !session && (
          <div className="app-error" role="alert">
            <strong>请求失败：</strong>
            {error.message}
          </div>
        )}

        {!module.solo && (
          <div className="mode-tabs" role="tablist" aria-label="心灵感应角色">
            <button
              role="tab"
              aria-selected={telepathyMode === 'create'}
              className={`mode-tab ${telepathyMode === 'create' ? 'active' : ''}`}
              onClick={() => setTelepathyMode('create')}
            >
              我是发送者（创建房间）
            </button>
            <button
              role="tab"
              aria-selected={telepathyMode === 'join'}
              className={`mode-tab ${telepathyMode === 'join' ? 'active' : ''}`}
              onClick={() => setTelepathyMode('join')}
            >
              我是接收者（输入邀请码）
            </button>
          </div>
        )}

        <div className="setup-field">
          <label htmlFor="rounds-input">
            {module.solo || telepathyMode === 'create' ? '每场轮数' : '每场轮数（由创建者设定）'}
          </label>
          <input
            id="rounds-input"
            type="number"
            min={5}
            max={200}
            value={rounds}
            disabled={!module.solo && telepathyMode === 'join'}
            onChange={(e) => setRounds(e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={() => setRounds((v) => clampRounds(v))}
          />
          <span className="setup-hint">可输入 5–200，默认 30。</span>
        </div>

        {module.solo || telepathyMode === 'create' ? <CandidateSetPicker value={candidateSet} onChange={setCandidateSet} disabled={busy} /> : <p className="setup-hint">候选符号由发送者设定，加入后自动同步。</p>}

        {module.solo ? (
          <button
            className="primary-btn big"
            onClick={() => handleStartSolo(module.type)}
            disabled={busy}
          >
            {busy ? '创建中…' : '开始实验'}
          </button>
        ) : telepathyMode === 'create' ? (
          <button className="primary-btn big" onClick={handleCreateRoom} disabled={busy}>
            {busy ? '创建中…' : '创建房间'}
          </button>
        ) : (
          <div className="join-block">
            <div className="setup-field">
              <label htmlFor="room-code-input">邀请码</label>
              <input
                id="room-code-input"
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="输入发送者提供的邀请码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <button
              className="primary-btn big"
              onClick={handleJoinRoom}
              disabled={busy || !code.trim()}
            >
              {busy ? '加入中…' : '加入房间'}
            </button>
          </div>
        )}

        {!module.solo && (
          <p className="flow-note">
            发送者与接收者必须使用两个独立的窗口或设备，加入后自动开始。请勿使用声音、消息或共享屏幕互相提示。
          </p>
        )}
      </div>
    )
  }

  function renderResults() {
    return (
      <div className="results-wrap">
        <ExperimentResults session={session} prior={{ alpha: settings.priorAlpha, beta: settings.priorBeta }} />
        <div className="results-actions">
          {session.experimentType === 'telepathy' && session.role === 'receiver' ? (
            <button className="primary-btn" onClick={handleRestartSameModule} disabled={busy}>
              加入新房间
            </button>
          ) : (
            <button className="primary-btn" onClick={handleRestartSameModule} disabled={busy}>
              {session.experimentType === 'telepathy' ? '创建新房间' : '再测一次'}
            </button>
          )}
          <button className="ghost-btn" onClick={handleReturnHome}>
            返回模块选择
          </button>
          <button className="ghost-btn" onClick={() => setView('history')}>
            查看历史
          </button>
        </div>
      </div>
    )
  }

  function renderRestoreError() {
    return (
      <div className="restore-error">
        <h2 className="setup-title">无法恢复上次实验</h2>
        <div className="app-error" role="alert">
          {error ? error.message : '实验服务暂时不可用。'}
        </div>
        <p className="flow-note">
          服务不可用时不会在本地生成或替代目标。你可以重试连接，或返回重新开始。
        </p>
        <div className="results-actions">
          {canRetry && (
            <button className="primary-btn" onClick={retry} disabled={busy}>
              {busy ? '重试中…' : '重试连接'}
            </button>
          )}
          <button className="ghost-btn" onClick={handleReturnHome}>
            返回
          </button>
        </div>
      </div>
    )
  }

  function renderHistory() {
    return (
      <div className="history-view">
        <div className="history-header">
          <h2>实验历史</h2>
          <button className="ghost-btn" onClick={() => setView('main')}>关闭</button>
        </div>
        <ExperimentHistory
          sessions={v2History}
          prior={{ alpha: settings.priorAlpha, beta: settings.priorBeta }}
          showLegacy={false}
          onClear={handleClearV2}
          onExport={handleExportV2}
          onImport={auth.account ? undefined : handleImportV2}
        />
        {!auth.account && <details className="legacy-history">
          <summary>旧版记录（v1，单独展示，不与新协议合并）</summary>
          {v1History.length === 0 ? (
            <p className="flow-note">没有旧版记录。</p>
          ) : (
            <>
              <ul className="legacy-list">
                {[...v1History]
                  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                  .map((s) => {
                    const summary = s.summary || { correct: 0, total: 0 }
                    return (
                      <li key={s.id}>
                        <span>{fmtDate(s.createdAt)}</span>
                        <span>
                          {summary.correct}/{summary.total}
                        </span>
                        <span className="legacy-status">{s.status}</span>
                      </li>
                    )
                  })}
              </ul>
              <button className="danger-btn" onClick={handleClearV1}>清空旧版记录</button>
            </>
          )}
        </details>}
      </div>
    )
  }

  function renderMain() {
    if (restoring && !session) {
      return (
        <div className="card hero">
          <h2 className="hero-title">正在恢复上次实验…</h2>
          <p className="hero-subtitle">会连接到同一场服务端会话，不会重新生成目标。</p>
        </div>
      )
    }
    if (!session && error && canRetry) return renderRestoreError()
    if (isTerminal) return renderResults()
    if (session) {
      return (
        <ExperimentFlow
          session={session}
          busy={busy || restoring}
          error={error}
          onGuess={guess}
          onTarget={target}
          onNext={next}
          onAbandon={abandon}
          onRetry={retry}
          onLeave={handleReturnHome}
        />
      )
    }
    if (selectedModule) return renderSetup()
    return renderModuleSelector()
  }

  return (
    localize(<div className="app">
      <OpeningAnimation enabled={!session && !restoring} />
      {Header}
      <main className="main">
        <AccountBanner active={Boolean(session && !isTerminal) || busy || restoring} onReport={() => setView('report')} />
        <div className="card">
          {view === 'report' && auth.account
            ? <AccountReport onBack={() => setView('main')} />
            : view === 'history'
            ? renderHistory()
            : view === 'dses'
              ? <DsesQuestionnaire key={auth.account?.sub || 'guest'} accountMode={Boolean(auth.account)} accountRecords={auth.history.dses} onSaveAccount={auth.saveDses} onDeleteAccount={auth.deleteDses} onBack={() => setView('main')} />
            : view === 'settings'
              ? (
                <SettingsPanel
                  serverMode
                  settings={settings}
                  onChange={(patch) => { updateSettings(patch); if (patch.roundsPerSession) setRounds(patch.roundsPerSession) }}
                  onClose={() => setView('main')}
                />
                )
              : renderMain()}
        </div>
      </main>
      {historyError && <p className="app-error" role="alert">{historyError}</p>}
      <footer className="footer">
        实验表现与体验自评分开呈现；单次结果不能用于认定超自然能力。
      </footer>
    </div>)
  )
}

export function App() {
  return <I18nProvider><AccountProvider><AppContent /></AccountProvider></I18nProvider>
}
