import { useI18n } from '../i18n/I18n.jsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { candidateLabel, getCandidateSet } from '../../shared/candidate-sets.js'
import { CandidateSymbol } from './CandidateSymbols.jsx'
import './ExperimentFlow.css'

export const MODULE_LABELS = {
  hidden: '隐藏信息感知',
  precognition: '未来事件预知',
  telepathy: '双人心灵感应',
}

const MODULE_BLURBS = {
  hidden: '服务端在你会看到之前生成并冻结一个目标；你只需要猜测它。',
  precognition: '目标在你作答前尚未生成；服务端先锁定你的答案，再生成目标。',
  telepathy: '一位发送者与一位接收者分处两个浏览器窗口，按服务端统一的发送期与作答期进行。',
}

const ROUND_STATUS_LABEL = {
  SELECTING: '发送者选数',
  TARGET_READY: '等待作答',
  SENDING: '发送期',
  GUESSING: '作答期',
  LOCKED: '已锁定',
  REVEALED: '已揭晓',
  ABANDONED: '已作废',
}

function mmss(ms) {
  if (ms == null || Number.isNaN(ms)) return null
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function useNow(active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [active])
  return now
}

function TargetDisplay({ round, revealed, setId }) {
  const { localize } = useI18n()
  if (!revealed || round.target == null) {
    return (
      localize(<div className="target-box covered" role="img" aria-label="目标尚未揭晓">
        <span className="target-face">?</span>
        <span className="target-caption">目标将在统一揭晓后出现</span>
      </div>)
    )
  }
  const cls = round.correct === true ? 'correct' : round.correct === false ? 'wrong' : ''
  return (
    localize(<div className={`target-box ${cls}`} role="img" aria-label={getCandidateSet(setId).id === 'digits' ? `目标数字 ${round.target}` : `目标 ${candidateLabel(setId, round.target)}`}>
      <span className="target-face"><CandidateSymbol setId={setId} value={round.target} /></span>
      <span className="target-caption">
        {round.correct === true ? '✔ 正确' : round.correct === false ? '✕ 未命中' : '目标'}
      </span>
    </div>)
  )
}

function ErrorBanner({ error, onRetry, onLeave, retrying, canRetry }) {
  const { localize } = useI18n()
  if (!error) return null
  return (
    localize(<div className="flow-error" role="alert">
      <div className="flow-error-text">
        <strong>出错了：</strong>
        {error.message}
        {error.code === 'offline' && (
          <div className="flow-error-hint">服务不可用时不会在本地生成目标，请重试或返回。</div>
        )}
      </div>
      <div className="flow-error-actions">
        {canRetry && (
          <button className="ghost-btn" onClick={onRetry} disabled={retrying}>
            {retrying ? '重试中…' : '重试'}
          </button>
        )}
        <button className="ghost-btn" onClick={onLeave}>
          返回
        </button>
      </div>
    </div>)
  )
}

function ConfidenceField({ enabled, value, onToggle, onChange, disabled }) {
  const { localize } = useI18n()
  return (
    localize(<div className="confidence">
      <label className="confidence-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={disabled}
        />
        记录信心评分（可选）
      </label>
      {enabled && (
        <label className="confidence-range">
          <span>
            信心：<strong>{value}</strong> / 100
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            aria-label="信心评分"
          />
        </label>
      )}
    </div>)
  )
}

/**
 * ExperimentFlow renders the in-progress view for every module and every role.
 *
 * Props:
 *  - session: server snapshot (never contains the other participant's secrets)
 *  - busy: an action request is in flight
 *  - error / onRetry / onLeave
 *  - onGuess(roundId, guess, confidence|null)
 *  - onNext(roundId)
 *  - onAbandon()
 */
export function ExperimentFlow({
  session,
  busy,
  error,
  onGuess,
  onTarget,
  onNext,
  onAbandon,
  onRetry,
  onLeave,
}) {
  const { localize } = useI18n()
  const now = useNow(
    !!(session.activeRound && (session.activeRound.sendingEndsAt != null || session.activeRound.revealAt != null)),
  )
  const [selected, setSelected] = useState(null)
  const [confidenceEnabled, setConfidenceEnabled] = useState(false)
  const [confidence, setConfidence] = useState(50)
  const [confirmingAbandon, setConfirmingAbandon] = useState(false)
  const [copied, setCopied] = useState(false)

  const experimentType = session.experimentType
  const label = MODULE_LABELS[experimentType] || '实验'
  const blurb = MODULE_BLURBS[experimentType] || ''
  const isTelepathy = experimentType === 'telepathy'
  const isSender = session.role === 'sender'
  const senderChoice = isTelepathy && session.protocolVersion === 3
  const symbolSet = getCandidateSet(session.settings?.candidateSet)
  const usesSymbols = symbolSet.id !== 'digits'
  const symbol = (value) => <CandidateSymbol setId={symbolSet.id} value={value} />

  const rounds = session.rounds || []
  const total = session.settings?.roundsPerSession ?? rounds.length
  const round = session.activeRound
  const roundId = round?.id

  const isGuessableStatus = round && (round.status === 'TARGET_READY' || round.status === 'GUESSING')
  const canGuess = !isSender && !!isGuessableStatus
  const canSelectTarget = isSender && senderChoice && round?.status === 'SELECTING'
  const canAdvance =
    !isSender &&
    round &&
    (round.status === 'REVEALED' || round.status === 'ABANDONED') &&
    rounds.length < total

  const sendingLeft = round?.sendingEndsAt != null ? round.sendingEndsAt - now : null
  const revealLeft = round?.revealAt != null ? round.revealAt - now : null

  // Reset the local selection when the round changes.
  useEffect(() => {
    setSelected(null)
    setConfidenceEnabled(false)
  }, [roundId])

  const submit = useCallback(() => {
    if (selected == null || busy || !round) return
    if (canSelectTarget) { onTarget(round.id, selected); return }
    if (!canGuess) return
    onGuess(round.id, selected, confidenceEnabled ? confidence : null)
  }, [selected, busy, round, canSelectTarget, canGuess, confidenceEnabled, confidence, onGuess, onTarget])

  // Local 1–5 / Enter / Backspace shortcuts. We intentionally ignore events
  // originating from any native control so we never hijack buttons, inputs,
  // selects or contenteditable elements.
  useEffect(() => {
    if (!canGuess && !canSelectTarget) return undefined
    function onKey(e) {
      const el = e.target
      const tag = el && el.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        tag === 'A' ||
        (el && el.isContentEditable)
      ) {
        return
      }
      if (/^[1-5]$/.test(e.key)) {
        e.preventDefault()
        setSelected(parseInt(e.key, 10))
      } else if (e.key === 'Enter') {
        if (selected != null && !busy) {
          e.preventDefault()
          submit()
        }
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canGuess, canSelectTarget, selected, busy, submit])

  async function copyCode() {
    const code = session.roomCode
    if (!code) return
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code)
    } catch {
      /* clipboard may be unavailable; the code is still visible */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const roleText = isTelepathy
    ? isSender
      ? '发送者'
      : '接收者'
    : '参与者'
  const statusLabel = usesSymbols && round?.status === 'SELECTING' ? '发送者选择目标' : ROUND_STATUS_LABEL[round?.status] || ''

  const guessPrompt = useMemo(() => {
    if (usesSymbols) {
      if (experimentType === 'hidden') return '目标已由服务端选定，揭晓前不可见。请选择一个符号。'
      if (experimentType === 'precognition') return '本轮目标尚未生成，服务端会先锁定你的答案。请选择一个符号。'
      return '请在作答期选择一个符号。提交后不能修改，等待统一揭晓。'
    }
    if (experimentType === 'hidden') {
      return '目标已由服务端生成并冻结，此时对你不可见。请选择 1–5。'
    }
    if (experimentType === 'precognition') {
      return '本轮目标尚未生成。服务端会先锁定你的答案，再生成目标。请先选择 1–5。'
    }
    return '在作答期内选择 1–5。提前提交会锁定答案，并等待统一揭晓。'
  }, [experimentType, usesSymbols])

  function renderAbandonConfirm() {
    if (!confirmingAbandon) return null
    return (
      <div className="flow-confirm" role="alertdialog" aria-label="确认放弃本场">
        <p>放弃后本次未作答的轮次会作废，已作答的结果会保留。确定放弃本场吗？</p>
        <div className="flow-confirm-actions">
          <button className="danger-btn" onClick={onAbandon} disabled={busy}>
            {busy ? '处理中…' : '确认放弃'}
          </button>
          <button className="ghost-btn" onClick={() => setConfirmingAbandon(false)} disabled={busy}>
            继续实验
          </button>
        </div>
      </div>
    )
  }

  function renderRoundCounter() {
    if (!round) return null
    return (
      <span className="flow-round">
        第 {round.index + 1} / {total} 轮
        {statusLabel ? <em className="flow-phase">{statusLabel}</em> : null}
      </span>
    )
  }

  function renderGuessBlock(selecting = false) {
    return (
      <div className="flow-guess">
        <p className="flow-prompt">{selecting ? usesSymbols ? '请选择一个符号作为本轮目标。锁定后不能修改，接收者在揭晓前看不到你的选择。' : '请选择一个数字作为本轮目标。锁定后不能修改，接收者在揭晓前看不到你的选择。' : guessPrompt}</p>
        <div className="digit-row" role="radiogroup" aria-label={selecting ? '发送目标选择' : usesSymbols ? '符号选择' : '数字选择'}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-label={candidateLabel(symbolSet.id, n)}
              aria-checked={selected === n}
              className={`digit-btn ${selected === n ? 'selected' : ''}`}
              disabled={busy}
              onClick={() => setSelected(n)}
            >
              {symbol(n)}
            </button>
          ))}
        </div>
        {!selecting && <ConfidenceField
          enabled={confidenceEnabled}
          value={confidence}
          disabled={busy}
          onToggle={setConfidenceEnabled}
          onChange={setConfidence}
        />}
        <div className="flow-actions">
          <span className="flow-selection">
            {selected != null ? <>当前选择：{symbol(selected)}</> : usesSymbols ? '请选择一个符号（快捷键 1–5 对应从左到右的选项）' : '请选择 1–5（键盘 1–5）'}
          </span>
          <button className="primary-btn" onClick={submit} disabled={selected == null || busy}>
            {busy ? '提交中…' : selecting ? '锁定并发送' : '提交'}
          </button>
        </div>
      </div>
    )
  }

  function renderRevealBlock() {
    const timedOut = round.status === 'ABANDONED'
    return (
      <div className="flow-reveal">
        {!timedOut && <TargetDisplay round={round} revealed setId={symbolSet.id} />}
        {timedOut && (
          <div className="flow-invalid" role="status">
            本轮未完成作答，已作废。
            {round.invalidReason ? <span className="flow-invalid-reason">（{round.invalidReason}）</span> : null}
          </div>
        )}
        {round.guess != null && (
          <div className="flow-answer-line">
            {senderChoice ? '接收者选择：' : '你的选择：'}<strong>{symbol(round.guess)}</strong>
            {round.confidence != null && <span>　信心 {round.confidence}/100</span>}
          </div>
        )}
        {!timedOut && (
          <div className={`flow-verdict ${round.correct ? 'ok' : 'bad'}`}>
            {round.correct ? '✔ 命中' : '✕ 未命中'}
          </div>
        )}
        {senderChoice && !timedOut && <div className="flow-answer-line">发送者选择：<strong>{symbol(round.target)}</strong></div>}
        {canAdvance ? (
          <button className="primary-btn" onClick={() => onNext(round.id)} disabled={busy}>
            {busy ? '加载中…' : '下一轮'}
          </button>
        ) : (
          <div className="flow-waiting">正在汇总本场结果…</div>
        )}
      </div>
    )
  }

  function renderTelepathySender() {
    if (round.status === 'SELECTING') return renderGuessBlock(true)
    if (round.status === 'SENDING') {
      const hasTarget = round.target != null
      return (
        <div className="flow-sender">
          {hasTarget ? (
            <>
              <p className="flow-prompt">{senderChoice ? '你的选择已锁定。请专注于把它传递给接收者。' : '这是本轮的目标。请专注于把它传递给接收者。'}</p>
              <div className="target-box" role="img" aria-label={usesSymbols ? `目标 ${candidateLabel(symbolSet.id, round.target)}` : `目标数字 ${round.target}`}>
                <span className="target-face">{symbol(round.target)}</span>
              </div>
            </>
          ) : (
            <p className="flow-prompt neutral">请保持安静与专注，等待本轮结束。</p>
          )}
          {sendingLeft != null && <div className="flow-countdown">发送期剩余 {mmss(sendingLeft)}</div>}
        </div>
      )
    }
    if (round.status === 'GUESSING') {
      return (
        <div className="flow-sender">
          <p className="flow-prompt">接收者正在作答。</p>
          {senderChoice && <div className="flow-answer-line">发送者选择：<strong>{symbol(round.target)}</strong></div>}
          {revealLeft != null && <div className="flow-countdown">距统一揭晓 {mmss(revealLeft)}</div>}
        </div>
      )
    }
    if (round.status === 'LOCKED') {
      return (
        <div className="flow-sender">
          <p className="flow-prompt">接收者已锁定答案，等待统一揭晓。</p>
          {senderChoice && <div className="flow-answer-line">发送者选择：<strong>{symbol(round.target)}</strong></div>}
          {revealLeft != null && <div className="flow-countdown">距统一揭晓 {mmss(revealLeft)}</div>}
        </div>
      )
    }
    if (round.status === 'REVEALED') {
      return (
        <div className="flow-sender">
          <TargetDisplay round={round} revealed setId={symbolSet.id} />
          {senderChoice && <div className="flow-answer-line">发送者选择：<strong>{symbol(round.target)}</strong> · 接收者选择：<strong>{symbol(round.guess)}</strong></div>}
          <div className={`flow-verdict ${round.correct ? 'ok' : 'bad'}`}>
            {round.correct ? '✔ 接收者命中' : '✕ 接收者未命中'}
          </div>
          <div className="flow-waiting">等待接收者进入下一轮…</div>
        </div>
      )
    }
    if (round.status === 'ABANDONED') {
      return <div className="flow-invalid">本轮已作废，等待接收者继续。</div>
    }
    return <div className="flow-waiting">正在同步本轮状态…</div>
  }

  function renderTelepathyReceiver() {
    if (round.status === 'SELECTING') {
      return <div className="flow-waiting">等待发送者选择并锁定本轮目标…</div>
    }
    if (round.status === 'SENDING') {
      return (
        <div className="flow-receiver">
          <p className="flow-prompt neutral">发送期进行中，请等待作答环节。</p>
          {sendingLeft != null && <div className="flow-countdown">作答开始倒计时 {mmss(sendingLeft)}</div>}
        </div>
      )
    }
    if (round.status === 'GUESSING' || round.status === 'TARGET_READY') {
      return (
        <div className="flow-receiver">
          {renderGuessBlock()}
          {revealLeft != null && <div className="flow-countdown">作答期剩余 {mmss(revealLeft)}</div>}
        </div>
      )
    }
    if (round.status === 'LOCKED') {
      return (
        <div className="flow-receiver">
          <p className="flow-prompt">答案已锁定，请等待服务端在固定时间统一揭晓。</p>
          {revealLeft != null && <div className="flow-countdown">距统一揭晓 {mmss(revealLeft)}</div>}
        </div>
      )
    }
    if (round.status === 'REVEALED') {
      return <div className="flow-receiver">{renderRevealBlock()}</div>
    }
    if (round.status === 'ABANDONED') {
      return <div className="flow-receiver">{renderRevealBlock()}</div>
    }
    return <div className="flow-waiting">正在同步本轮状态…</div>
  }

  function renderBody() {
    if (session.status === 'WAITING') {
      return (
        <div className="flow-lobby">
          <p className="flow-prompt">房间已创建。把下面的邀请码发给接收者，让他在另一个窗口加入。</p>
          <div className="room-code">
            <span className="room-code-label">邀请码</span>
            <span className="room-code-value" aria-label="房间邀请码">{session.roomCode}</span>
            <button className="ghost-btn" onClick={copyCode}>
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <p className="flow-note">
            发送者与接收者必须分开在两个窗口／设备上进行，全程不要用声音、消息或共享屏幕互相提示。
            接收者加入后本轮会自动开始。
          </p>
          <div className="flow-waiting">等待接收者加入…</div>
        </div>
      )
    }

    if (!round) {
      return <div className="flow-waiting">正在同步实验状态…</div>
    }

    if (isTelepathy) {
      return isSender ? renderTelepathySender() : renderTelepathyReceiver()
    }

    // Solo modules: hidden / precognition.
    if (round.status === 'TARGET_READY' || round.status === 'GUESSING') {
      return renderGuessBlock()
    }
    if (round.status === 'REVEALED' || round.status === 'ABANDONED') {
      return renderRevealBlock()
    }
    return <div className="flow-waiting">正在同步本轮状态…</div>
  }

  return (
    localize(<div className="experiment-flow">
      <header className="flow-head">
        <div className="flow-head-text">
          <h2 className="flow-title">{label}</h2>
          <span className={`flow-role ${isSender ? 'sender' : ''}`}>{roleText}</span>
        </div>
        <div className="flow-head-actions">
          {renderRoundCounter()}
          <button
            className="ghost-btn"
            onClick={() => setConfirmingAbandon(true)}
            disabled={confirmingAbandon || busy}
          >
            放弃本场
          </button>
        </div>
      </header>

      {blurb && <p className="flow-blurb">{senderChoice ? '发送者先选择并锁定目标，接收者独立选择；揭晓时比较双方是否一致。请分开进行，不要互相提示。' : blurb}</p>}
      <p className="flow-symbol-set">候选符号：{symbolSet.label} {isTelepathy ? '（由发送者设定）' : ''}</p>

      <ErrorBanner
        error={error}
        onRetry={onRetry}
        onLeave={onLeave}
        retrying={busy}
        canRetry={!!session.id}
      />

      {renderAbandonConfirm()}

      <div className="flow-body">{renderBody()}</div>
    </div>)
  )
}
