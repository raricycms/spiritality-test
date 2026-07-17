import { CoveredDigit } from './CoveredDigit.jsx'
import { GuessInput } from './GuessInput.jsx'
import { ResultPanel } from './ResultPanel.jsx'
import './RoundView.css'

/**
 * Renders a single round: covered target + guess row + reveal feedback.
 */
export function RoundView({
  round,
  roundNumber,
  totalRounds,
  onPreview,
  onSubmit,
  onNext,
}) {
  const isRevealed = round.status === 'REVEALED'
  const isTerminal = isRevealed || round.status === 'ABANDONED'
  const nextEnabled = roundNumber < totalRounds

  return (
    <div className="round-view">
      <div className="round-counter">
        第 <strong>{roundNumber}</strong> / {totalRounds} 轮
      </div>

      <div className="digit-stage">
        <CoveredDigit
          digit={round.target}
          revealed={isRevealed}
          correct={isRevealed ? round.correct : null}
        />
        {isRevealed && (
          <ResultPanel
            correct={round.correct}
            target={round.target}
            guess={round.guess}
          />
        )}
      </div>

      <GuessInput
        value={round.guess}
        revealed={isRevealed}
        disabled={isTerminal}
        nextEnabled={nextEnabled}
        onPreview={(n) => onPreview(round.id, n)}
        onSubmit={(n) => onSubmit(round.id, n)}
        onNext={onNext}
      />
    </div>
  )
}
