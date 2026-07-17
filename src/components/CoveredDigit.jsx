import { useEffect, useState } from 'react'
import './CoveredDigit.css'

/**
 * Renders either a covered digit (showCover) or the revealed target.
 *
 * Props:
 *  - digit: 1..5
 *  - revealed: boolean
 *  - correct: boolean|null — only meaningful when revealed
 */
export function CoveredDigit({ digit, revealed, correct }) {
  const [hovering, setHovering] = useState(false)
  // Determine class for revealed styling.
  let borderClass = ''
  if (revealed) {
    borderClass = correct ? 'revealed correct' : 'revealed wrong'
  }

  return (
    <div
      className={`covered-digit ${borderClass}`}
      role="img"
      aria-label={revealed ? `目标数字 ${digit}` : '被遮挡的数字，请猜测'}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {revealed ? (
        <span className="big-digit">{digit}</span>
      ) : (
        <>
          <span className="big-q">?</span>
          <span className="hint">{hovering ? '请猜测' : ''}</span>
        </>
      )}
    </div>
  )
}
