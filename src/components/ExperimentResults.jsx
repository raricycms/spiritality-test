import { useI18n } from '../i18n/I18n.jsx'
import { summarizeExperiment } from '../lib/experiment-statistics.js'
import './ExperimentResults.css'
import { getCandidateSet } from '../../shared/candidate-sets.js'

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

const SMALL_SAMPLE_THRESHOLD = 30

function pct(x, digits = 1) {
  return x == null ? '—' : `${(x * 100).toFixed(digits)}%`
}

function pp(x, digits = 1) {
  if (x == null) return '—'
  const v = x * 100
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)} pp`
}

function interval(credible) {
  if (!credible) return '—'
  return `[${pct(credible.low)}, ${pct(credible.high)}]`
}

/** A compact stats block shared by the whole session and each condition arm. */
function SummaryBlock({ summary, title }) {
  const { localize } = useI18n()
  return (
    localize(<div className="er-block">
      {title ? <h4 className="er-block-title">{title}</h4> : null}
      <dl className="er-grid">
        <div className="er-cell">
          <dt>{summary.baseline == null ? '一致 / 已揭晓' : '正确 / 已揭晓'}</dt>
          <dd>{summary.n > 0 ? `${summary.k} / ${summary.n}` : '—'}</dd>
        </div>
        <div className="er-cell">
          <dt>{summary.baseline == null ? '一致率' : '正确率'}</dt>
          <dd>{pct(summary.accuracy)}</dd>
        </div>
        {summary.baseline != null && <div className="er-cell">
          <dt>机会基线</dt>
          <dd>{pct(summary.baseline)}</dd>
        </div>}
        {summary.baseline != null && <div className="er-cell">
          <dt>超出基线</dt>
          <dd>{pp(summary.excess)}</dd>
        </div>}
        {summary.baseline != null && <div className="er-cell">
          <dt>P(p &gt; 基线 | 数据)</dt>
          <dd>{pct(summary.probAboveChance)}</dd>
        </div>}
        <div className="er-cell">
          <dt>95% 可信区间</dt>
          <dd>{interval(summary.credible)}</dd>
        </div>
      </dl>
    </div>)
  )
}

/**
 * v2 result panel.
 *
 * @param {{session: object|null, prior?: {alpha:number,beta:number}}} props
 */
export function ExperimentResults({ session, prior }) {
  const { localize } = useI18n()
  if (!session) return null

  const summary = summarizeExperiment(session, prior)
  const typeLabel = TYPE_LABELS[session.experimentType] || session.experimentType || '未知模块'
  const statusLabel = STATUS_LABELS[session.status] || session.status || ''
  const conditions = summary.conditions

  return (
    localize(<section className="experiment-results" aria-label="实验结果">
      <header className="er-header">
        <div>
          <h3 className="er-title">实验结果</h3>
          <p className="er-meta">
            <span className="er-tag">{typeLabel}</span>
            <span className="er-tag er-tag-muted">协议 v{session.protocolVersion}</span>
            <span className="er-tag er-tag-muted">{getCandidateSet(session.settings?.candidateSet).label}</span>
            <span className="er-tag er-tag-muted">{statusLabel}</span>
          </p>
        </div>
        <span className="er-session-id" title={session.id}>
          {session.id ? `${String(session.id).slice(0, 8)}…` : ''}
        </span>
      </header>

      <SummaryBlock summary={summary} />

      {summary.n === 0 ? (
        <p className="er-note">还没有已揭晓的轮次，暂无统计结果。</p>
      ) : null}

      {summary.n > 0 && summary.n < SMALL_SAMPLE_THRESHOLD ? (
        <p className="er-note er-note-warn">
          小样本提示：仅 {summary.n} 轮已揭晓，估计与区间不稳定，请谨慎解读。
        </p>
      ) : null}

      {summary.baseline == null ? <p className="er-caveat">双方自由选择可能存在数字偏好，因此只展示一致率，不使用固定 20% 机会基线或超出基线概率。</p> : <p className="er-caveat">
        P(p &gt; 基线 | 数据) 是参数后验概率，<strong>不是</strong>超自然能力存在与否的概率。
      </p>}

      {conditions ? (
        <div className="er-conditions">
          <h4 className="er-conditions-title">双人条件对比（发送 / 对照）</h4>
          <SummaryBlock summary={conditions.sending} title="发送" />
          <SummaryBlock summary={conditions.control} title="对照" />
          <div className="er-difference">
            <span>发送 − 对照 差值</span>
            <strong>{pp(conditions.difference)}</strong>
            {conditions.difference == null ? (
              <span className="er-diff-hint">（任一组无样本，不展示差值）</span>
            ) : null}
          </div>
          {conditions.difference != null ? (
            <p className="er-note">差值仅为观测正确率之差，未给出差值的区间估计。</p>
          ) : null}
        </div>
      ) : null}
    </section>)
  )
}
