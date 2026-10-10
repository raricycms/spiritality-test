import { useI18n } from '../i18n/I18n.jsx'
import './SettingsPanel.css'

export function SettingsPanel({ settings, onChange, onClose, serverMode = false }) {
  const { localize } = useI18n()
  function update(patch) {
    onChange(patch)
  }
  return (
    localize(<div className="settings-panel">
      <div className="settings-header">
        <h2>设置</h2>
        <button className="ghost-btn" onClick={onClose}>关闭</button>
      </div>
      <div className="setting-row">
        <label>主题</label>
        <select
          value={settings.theme}
          onChange={(e) => update({ theme: e.target.value })}
        >
          <option value="auto">自动</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </div>
      <div className="setting-row">
        <label>每场轮数</label>
        <input
          type="number"
          min={5}
          max={200}
          value={settings.roundsPerSession}
          onChange={(e) => update({ roundsPerSession: Math.max(5, Math.min(200, parseInt(e.target.value || '30', 10))) })}
        />
      </div>
      {!serverMode && <div className="setting-row">
        <label>揭示停留 (ms)</label>
        <input
          type="number"
          min={200}
          max={3000}
          step={100}
          value={settings.exposureTimeMs}
          onChange={(e) => update({ exposureTimeMs: parseInt(e.target.value || '800', 10) })}
        />
      </div>}
      <div className="setting-row">
        <label>Beta 先验 α₀</label>
        <input
          type="number"
          min={0.01}
          step={0.1}
          value={settings.priorAlpha}
          onChange={(e) => update({ priorAlpha: parseFloat(e.target.value || '1') })}
        />
      </div>
      <div className="setting-row">
        <label>Beta 先验 β₀</label>
        <input
          type="number"
          min={0.01}
          step={0.1}
          value={settings.priorBeta}
          onChange={(e) => update({ priorBeta: parseFloat(e.target.value || '1') })}
        />
      </div>
      {!serverMode && <div className="setting-row">
        <label>单边阈值</label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={settings.oneSidedThreshold}
          onChange={(e) => update({ oneSidedThreshold: Math.max(0, Math.min(1, parseFloat(e.target.value || '0.2'))) })}
        />
      </div>}
      <div className="info">
        <p>
          当前先验：Beta({settings.priorAlpha}, {settings.priorBeta})。
          均匀先验对应 α₀ = β₀ = 1。
        </p>
        {serverMode ? <p>随机目标的五选一基线为 20%；双人自选模式仅报告一致率，不假设固定机会基线。发送者锁定目标后，发送期与作答期各 15 秒；下一轮由接收者开始。</p> : <p>
          概率指标默认使用 Savage-Dickey 密度比（点零检验），与你的原话字面对齐。
          切换"单边"/"可信区间"会改变 UI 显示模式，但内部数值计算保持一致。
        </p>}
      </div>
    </div>)
  )
}
