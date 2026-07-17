import './GuessInput.css'

/**
 * 1–5 button row + submit button.
 *
 * Props:
 *  - value: current guess 1..5 (or null)
 *  - disabled: when round is in REVEALED/ABANDONED
 *  - onPreview: (n) => void  — change the active guess
 *  - onSubmit: (n) => void   — commit
 *  - onNext:   () => void    — skip to next round (revealed only)
 *  - nextEnabled
 */
export function GuessInput({
  value,
  disabled,
  onPreview,
  onSubmit,
  onNext,
  nextEnabled,
  revealed,
}) {
  const nums = [1, 2, 3, 4, 5]
  return (
    <div className="guess-input">
      <div className="digit-row" role="radiogroup" aria-label="数字选择">
        {nums.map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={value === n}
            className={`digit-btn ${value === n ? 'selected' : ''}`}
            disabled={disabled}
            onClick={() => onPreview(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="action-row">
        {!revealed && (
          <>
            <span className="value-display">
              {value !== null ? <>当前选择：<strong>{value}</strong></> : '请选择一个数字（键盘 1–5）'}
            </span>
            <button
              className="primary-btn"
              disabled={value === null || disabled}
              onClick={() => onSubmit(value)}
            >
              提交 <kbd>Enter</kbd>
            </button>
          </>
        )}
        {revealed && (
          <button className="primary-btn" onClick={onNext} disabled={!nextEnabled}>
            下一题 <kbd>Space</kbd>
          </button>
        )}
      </div>
    </div>
  )
}
