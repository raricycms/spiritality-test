import { useState } from 'react'
import './HistoryList.css'

function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function HistoryList({ history, onClose, onExport, onImport, onClear }) {
  const [open, setOpen] = useState(null)
  const sorted = [...history].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return (
    <div className="history-list">
      <div className="history-header">
        <h2>历史记录</h2>
        <button className="ghost-btn" onClick={onClose}>关闭</button>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">还没有历史记录。</div>
      ) : (
        <ul className="history-rows">
          {sorted.map((s, idx) => {
            const summary = s.summary || { correct: 0, total: 0, spiritualityEffectiveProb: null }
            const acc = summary.total > 0 ? (summary.correct / summary.total) * 100 : 0
            const isOpen = open === s.id
            return (
              <li key={s.id} className={`history-row ${isOpen ? 'open' : ''}`}>
                <button
                  className="row-header"
                  onClick={() => setOpen(isOpen ? null : s.id)}
                >
                  <span>{fmtDate(s.createdAt)}</span>
                  <span className="row-acc">
                    {summary.correct}/{summary.total}（{acc.toFixed(0)}%）
                  </span>
                  <span className="row-prob">
                    {summary.spiritualityEffectiveProb != null
                      ? `${(summary.spiritualityEffectiveProb * 100).toFixed(1)}%`
                      : '—'}
                  </span>
                  <span className="toggle">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div className="row-body">
                    <div className="grid">
                      {s.rounds.map((r, i) => (
                        <div
                          key={r.id}
                          className={`grid-cell ${r.correct ? 'c' : r.status === 'ABANDONED' ? 'a' : 'w'}`}
                          title={`第 ${i + 1} 题：${r.status === 'ABANDONED' ? '未完成' : r.correct ? `✔ ${r.target}` : `✕ ${r.target}/${r.guess}`}`}
                        >
                          {r.correct ? '✓' : r.status === 'ABANDONED' ? '·' : '✕'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="history-actions">
        <button className="primary-btn" onClick={onExport}>导出 JSON</button>
        <label className="ghost-btn file-btn">
          导入 JSON
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImport(file)
              e.target.value = ''
            }}
          />
        </label>
        <button className="danger-btn" onClick={onClear}>清空全部</button>
      </div>
    </div>
  )
}
