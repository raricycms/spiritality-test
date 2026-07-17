import './ResultPanel.css'

export function ResultPanel({ correct, target, guess }) {
  return (
    <div className={`result-panel ${correct ? 'success' : 'danger'}`}>
      {correct ? (
        <span>✔ 正确</span>
      ) : (
        <span>
          ✕ 错（答案是 <strong>{target}</strong>，你猜了 <strong>{guess}</strong>）
        </span>
      )}
    </div>
  )
}
