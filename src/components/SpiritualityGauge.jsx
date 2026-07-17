import './SpiritualityGauge.css'

export function SpiritualityGauge({ statistics, settings, onViewSwitch }) {
  if (!statistics || statistics.n === 0) {
    return (
      <div className="gauge empty">
        <div className="gauge-title">灵性起效概率</div>
        <div className="empty-text">还没有数据 — 开始一场测试看看吧</div>
      </div>
    )
  }

  const view = settings.view
  let probability, label, sub, formula
  if (view === 'pointNull') {
    probability = statistics.probPointNull
    label = 'P(p ≠ 0.20 | data)'
    sub = 'Savage-Dickey 密度比'
    formula = `P(p ≠ 0.20 | 你 N=${statistics.n} 次答题)`
  } else if (view === 'oneSided') {
    probability = statistics.probOneSided
    label = `P(p > ${settings.oneSidedThreshold} | data)`
    sub = '单边后验'
    formula = label
  } else {
    // credible interval view: don't show a bar, show the CI instead.
    const ci = statistics.credible
    if (!ci) return null
    return (
      <div className="gauge ci-view">
        <div className="gauge-title">95% 可信区间</div>
        <div className="ci-range">
          <span>{(ci.low * 100).toFixed(1)}%</span>
          <span className="ci-bar">~</span>
          <span>{(ci.high * 100).toFixed(1)}%</span>
        </div>
        <div className="formula">{formula}</div>
        <div className="view-switch">
          <button onClick={() => onViewSwitch('pointNull')}>点零</button>
          <button onClick={() => onViewSwitch('oneSided')}>单边</button>
          <button className="active">可信区间</button>
        </div>
      </div>
    )
  }

  const pct = (probability ?? 0) * 100
  const isInsufficient = statistics.n < 30
  const colorClass = pct < 30 ? 'low' : pct < 70 ? 'mid' : 'high'
  const interpText =
    pct < 30 ? '暂无明确证据' : pct < 70 ? '证据不足' : '较有信心'
  return (
    <div className={`gauge ${colorClass} ${isInsufficient ? 'insufficient' : ''}`}>
      <div className="gauge-title">灵性起效概率</div>
      <div className="probability">{pct.toFixed(1)}%</div>
      <div className="meter">
        <div
          className="meter-fill"
          style={{
            width: `${pct}%`,
            ...(isInsufficient ? { backgroundImage: 'repeating-linear-gradient(45deg, transparent 0, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 12px)' } : {}),
          }}
        />
      </div>
      <div className="interpretation">{interpText}{isInsufficient ? ' (样本量不足)' : ''}</div>
      <div className="formula">{formula}</div>
      <div className="sub">{sub}</div>
      <div className="view-switch">
        <button className={view === 'pointNull' ? 'active' : ''} onClick={() => onViewSwitch('pointNull')}>点零</button>
        <button className={view === 'oneSided' ? 'active' : ''} onClick={() => onViewSwitch('oneSided')}>单边</button>
        <button onClick={() => onViewSwitch('credibleInterval')}>可信区间</button>
      </div>
    </div>
  )
}
