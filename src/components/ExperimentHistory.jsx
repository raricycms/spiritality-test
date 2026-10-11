import { useI18n } from '../i18n/I18n.jsx'
import { useEffect, useMemo, useState } from 'react'
import { groupExperimentHistory } from '../lib/experiment-statistics.js'
import { loadLegacyHistory } from '../lib/experiment-history.js'
import './ExperimentHistory.css'
import { candidateLabel, getCandidateSet } from '../../shared/candidate-sets.js'

const TYPE_LABELS = {
  hidden: '隐藏目标',
  precognition: '预知',
  telepathy: '双人心灵感应',
}

const STATUS_LABELS = {
  WAITING: '等待中',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  ABANDONED: '已中止',
}

const TERMINAL = new Set(['COMPLETED', 'ABANDONED'])

function fmtDate(ts) {
  if (!Number.isFinite(ts)) return '—'
  const d = new Date(ts)
  const pad = (n) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pct(x, digits = 0) {
  return x == null ? '—' : `${(x * 100).toFixed(digits)}%`
}

function countRevealed(rounds) {
  let k = 0
  let n = 0
  for (const r of rounds || []) {
    if (!r || r.status !== 'REVEALED') continue
    n++
    if (r.correct === true) k++
  }
  return { k, n }
}

/** Round grid; targets/conditions are only exposed for terminal sessions. */
function RoundGrid({ session }) {
  const { localize } = useI18n()
  const terminal = TERMINAL.has(session.status)
  if (!terminal) {
    return localize(<p className="eh-hint">会话未结束，明细（目标与条件）暂不显示。</p>)
  }
  const rounds = Array.isArray(session.rounds) ? session.rounds : []
  return (
    localize(<div className="eh-grid">
      {rounds.map((r, i) => {
        const revealed = r.status === 'REVEALED'
        const cls = !revealed
          ? 'a'
          : r.correct
            ? 'c'
            : 'w'
        const label = !revealed
          ? '未完成'
          : r.correct
            ? `✔ 目标 ${candidateLabel(session.settings?.candidateSet, r.target)}`
            : `✕ 目标 ${candidateLabel(session.settings?.candidateSet, r.target)} / 猜 ${candidateLabel(session.settings?.candidateSet, r.guess)}`
        return (
          <div
            key={r.id || i}
            className={`eh-cell ${cls}`}
            title={`第 ${i + 1} 题：${label}${r.condition ? `（${r.condition === 'sending' ? '发送' : '对照'}）` : ''}`}
          >
            {revealed ? (r.correct ? '✓' : '✕') : '·'}
          </div>
        )
      })}
    </div>)
  )
}

function SessionRow({ session }) {
  const { localize } = useI18n()
  const [open, setOpen] = useState(false)
  const { k, n } = countRevealed(session.rounds)
  const accuracy = n > 0 ? k / n : null
  const statusLabel = STATUS_LABELS[session.status] || session.status || ''

  return (
    localize(<li className={`eh-session ${open ? 'open' : ''}`}>
      <button className="eh-session-header" onClick={() => setOpen((v) => !v)}>
        <span className="eh-date">{fmtDate(session.completedAt ?? session.createdAt)}</span>
        <span className={`eh-status eh-status-${(session.status || '').toLowerCase()}`}>
          {statusLabel}
        </span>
        <span className="eh-count">
          {n > 0 ? `${k}/${n}` : '—'}
        </span>
        <span className="eh-acc">{pct(accuracy)}</span>
        <span className="eh-toggle">{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className="eh-session-body">
          <RoundGrid session={session} />
        </div>
      ) : null}
    </li>)
  )
}

function GroupCard({ group }) {
  const { localize } = useI18n()
  const [open, setOpen] = useState(false)
  const typeLabel = TYPE_LABELS[group.experimentType] || group.experimentType
  const { summary } = group

  return (
    localize(<div className="eh-group">
      <button className="eh-group-header" onClick={() => setOpen((v) => !v)}>
        <span className="eh-group-type">{typeLabel}</span>
        <span className="eh-tag">协议 v{group.protocolVersion}</span>
        <span className="eh-tag">{getCandidateSet(group.candidateSet).label}</span>
        <span className="eh-tag eh-tag-muted">{group.baseline == null ? '发送者自选' : `基线 ${pct(group.baseline, 0)}`}</span>
        <span className="eh-group-count">{group.count} 场</span>
        <span className="eh-group-acc">
          {summary.n > 0 ? `${summary.k}/${summary.n}（${pct(summary.accuracy)}）` : '—'}
        </span>
        <span className="eh-group-prob">
          {summary.probAboveChance != null ? `P(p>基线) ${pct(summary.probAboveChance, 1)}` : '—'}
        </span>
        <span className="eh-toggle">{open ? '▾' : '▸'}</span>
      </button>

      {open ? (
        <div className="eh-group-body">
          <ul className="eh-sessions">
            {group.sessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
          {group.summary.conditions ? (
            <p className="eh-hint">
              发送正确率 {pct(group.summary.conditions.sending.accuracy)} · 对照正确率{' '}
              {pct(group.summary.conditions.control.accuracy)} · 差值{' '}
              {group.summary.conditions.difference == null
                ? '—'
                : `${(group.summary.conditions.difference * 100).toFixed(1)} pp`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>)
  )
}

function LegacySection({ sessions }) {
  const { localize } = useI18n()
  if (!sessions || sessions.length === 0) return null
  return (
    localize(<div className="eh-legacy">
      <h3 className="eh-section-title">旧版记录（v1，不计入新统计）</h3>
      <ul className="eh-legacy-list">
        {sessions.map((s, i) => {
          const { k, n } = countRevealed(s.rounds)
          return (
            <li key={s.id || i} className="eh-legacy-row">
              <span className="eh-date">{fmtDate(s.completedAt ?? s.createdAt)}</span>
              <span className={`eh-status eh-status-${(s.status || '').toLowerCase()}`}>
                {STATUS_LABELS[s.status] || s.status || ''}
              </span>
              <span className="eh-count">{n > 0 ? `${k}/${n}` : '—'}</span>
            </li>
          )
        })}
      </ul>
      <p className="eh-hint">旧版数据保留原样，仅单独展示，不与协议 v2 合并统计。</p>
    </div>)
  )
}

/**
 * v2 grouped history with a separate, non-aggregated legacy section.
 *
 * @param {{
 *   sessions: object[],
 *   onClear?: () => void,
 *   onExport?: (sessions: object[]) => void,
 *   onImport?: (file: File) => void,
 * }} props
 */
export function ExperimentHistory({ sessions, onClear, onExport, onImport, prior, showLegacy = true }) {
  const { localize } = useI18n()
  const safeSessions = Array.isArray(sessions) ? sessions : []
  const groups = useMemo(() => groupExperimentHistory(safeSessions, prior), [safeSessions, prior])
  const [legacy, setLegacy] = useState([])

  useEffect(() => {
    setLegacy(loadLegacyHistory())
  }, [safeSessions])

  return (
    localize(<section className="experiment-history" aria-label="实验历史">
      <header className="eh-header">
        <h2 className="eh-title">实验历史（按协议分组）</h2>
        <div className="eh-actions">
          {onExport ? (
            <button className="eh-btn" onClick={() => onExport(safeSessions)}>
              导出 JSON
            </button>
          ) : null}

          {onImport ? (
            <label className="eh-btn eh-file-btn">
              导入 JSON
              <input
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0]
                  if (file) onImport(file)
                  e.target.value = ''
                }}
              />
            </label>
          ) : null}

          {onClear ? (
            <button className="eh-btn eh-btn-danger" onClick={onClear}>
              清空
            </button>
          ) : null}
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="eh-empty">还没有实验记录。</p>
      ) : (
        <div className="eh-groups">
          {groups.map((group) => (
            <GroupCard key={group.key} group={group} />
          ))}
        </div>
      )}

      {showLegacy && <LegacySection sessions={legacy} />}
    </section>)
  )
}
