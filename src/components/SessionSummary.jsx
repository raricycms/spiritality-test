import './SessionSummary.css'

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function SessionSummary({ session, statistics, onRestart, onViewHistory }) {
  return (
    <div className="session-summary">
      <h2 className="title">测试结束</h2>

      <div className="meta">
        <div>本场：{formatDate(session.createdAt)}</div>
        <div>
          正确：<strong>{session.summary.correct}</strong> / {session.summary.total}
          （<strong>{(session.summary.accuracy * 100).toFixed(1)}</strong>%）
        </div>
      </div>

      <div className="grid-label">题号分布</div>
      <div className="grid">
        {session.rounds.map((r, i) => (
          <div
            key={r.id}
            className={`grid-cell ${r.correct ? 'c' : r.status === 'ABANDONED' ? 'a' : 'w'}`}
            title={`第 ${i + 1} 题：${
              r.status === 'ABANDONED'
                ? '未完成'
                : r.correct
                  ? `✔ 正确（${r.target}）`
                  : `✕ 错（${r.target}/${r.guess}）`
            }`}
          >
            {r.correct ? '✓' : r.status === 'ABANDONED' ? '·' : '✕'}
          </div>
        ))}
      </div>

      {statistics && (
        <div className="stats-block">
          <div className="stat">
            <span className="label">本场 P(灵性起效)</span>
            <span className="value">
              {statistics.probPointNull != null
                ? `${(statistics.probPointNull * 100).toFixed(1)}%`
                : '—'}
            </span>
          </div>
          <div className="stat">
            <span className="label">全局累计</span>
            <span className="value">
              N = <strong>{statistics.n}</strong>，K = <strong>{statistics.k}</strong>
            </span>
          </div>
          {statistics.credible && (
            <div className="stat">
              <span className="label">95% 可信区间</span>
              <span className="value">
                [{(statistics.credible.low * 100).toFixed(1)}%,{' '}
                {(statistics.credible.high * 100).toFixed(1)}%]
              </span>
            </div>
          )}
        </div>
      )}

      <div className="actions">
        <button className="primary-btn" onClick={onRestart}>
          再来一次
        </button>
        <button className="ghost-btn" onClick={onViewHistory}>
          查看历史
        </button>
      </div>
    </div>
  )
}
