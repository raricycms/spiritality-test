import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useEffect } from 'react'

import { CoveredDigit } from '../CoveredDigit.jsx'
import { GuessInput } from '../GuessInput.jsx'
import { ResultPanel } from '../ResultPanel.jsx'
import { SpiritualityGauge } from '../SpiritualityGauge.jsx'
import { SessionSummary } from '../SessionSummary.jsx'

beforeEach(() => cleanup())

describe('CoveredDigit', () => {
  it('shows "?" when not revealed', () => {
    render(<CoveredDigit digit={3} revealed={false} />)
    expect(screen.getByRole('img', { name: /被遮挡/ })).toBeInTheDocument()
  })

  it('shows the digit when revealed and correct', () => {
    render(<CoveredDigit digit={4} revealed correct />)
    expect(screen.getByRole('img', { name: '目标数字 4' })).toBeInTheDocument()
  })

  it('shows the digit when revealed and wrong', () => {
    render(<CoveredDigit digit={2} revealed={true} correct={false} />)
    expect(screen.getByRole('img', { name: '目标数字 2' })).toBeInTheDocument()
  })
})

describe('GuessInput', () => {
  it('renders all 5 digit buttons', () => {
    render(
      <GuessInput
        value={null}
        disabled={false}
        onPreview={() => {}}
        onSubmit={() => {}}
        onNext={() => {}}
      />,
    )
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole('radio', { name: String(n) })).toBeInTheDocument()
    }
  })

  it('calls onPreview when a digit button is clicked', () => {
    let captured = null
    render(
      <GuessInput
        value={null}
        disabled={false}
        onPreview={(n) => (captured = n)}
        onSubmit={() => {}}
        onNext={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: '3' }))
    expect(captured).toBe(3)
  })

  it('disables buttons when disabled', () => {
    render(
      <GuessInput
        value={null}
        disabled
        onPreview={() => {}}
        onSubmit={() => {}}
        onNext={() => {}}
      />,
    )
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole('radio', { name: String(n) })).toBeDisabled()
    }
  })

  it('calls onSubmit when primary button is clicked', () => {
    let submittedWith = null
    render(
      <GuessInput
        value={4}
        disabled={false}
        onPreview={() => {}}
        onSubmit={(n) => (submittedWith = n)}
        onNext={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /提交/ }))
    expect(submittedWith).toBe(4)
  })

  it('shows next button when revealed', () => {
    render(
      <GuessInput
        value={1}
        revealed
        disabled={false}
        nextEnabled
        onPreview={() => {}}
        onSubmit={() => {}}
        onNext={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /下一题/ })).toBeInTheDocument()
  })
})

describe('ResultPanel', () => {
  it('renders ✔ when correct', () => {
    render(<ResultPanel correct target={2} guess={2} />)
    expect(screen.getByText(/✔ 正确/)).toBeInTheDocument()
  })

  it('renders answer when wrong', () => {
    render(<ResultPanel correct={false} target={2} guess={4} />)
    expect(screen.getByText(/✕ 错/)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})

describe('SpiritualityGauge', () => {
  const settings = {
    view: 'pointNull',
    oneSidedThreshold: 0.2,
    credibleLevel: 0.95,
  }

  it('shows empty state when no data', () => {
    const stats = { k: 0, n: 0, probPointNull: null, probOneSided: null, credible: null, posteriorMean: null, pHat: null }
    render(<SpiritualityGauge statistics={stats} settings={settings} onViewSwitch={() => {}} />)
    expect(screen.getByText(/还没有数据/)).toBeInTheDocument()
  })

  it('renders the probability percentage when there is data', () => {
    const stats = {
      k: 40,
      n: 150,
      probPointNull: 0.384,
      probOneSided: 0.6,
      credible: { low: 0.20, high: 0.34 },
      posteriorMean: 0.27,
      pHat: 0.27,
    }
    render(<SpiritualityGauge statistics={stats} settings={settings} onViewSwitch={() => {}} />)
    expect(screen.getByText(/38\.4%/)).toBeInTheDocument()
  })

  it('switches view when a button is clicked', () => {
    let captured = null
    const stats = {
      k: 1, n: 1,
      probPointNull: 0.5,
      probOneSided: 0.6,
      credible: { low: 0.2, high: 0.8 },
      posteriorMean: 0.5,
      pHat: 1.0,
    }
    render(
      <SpiritualityGauge
        statistics={stats}
        settings={settings}
        onViewSwitch={(v) => (captured = v)}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '单边' }))
    expect(captured).toBe('oneSided')
  })
})

describe('SessionSummary', () => {
  const session = {
    id: 's1',
    createdAt: Date.now(),
    status: 'COMPLETED',
    rounds: Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`,
      index: i,
      target: ((i % 5) + 1),
      guess: ((i % 5) + 1),
      status: 'REVEALED',
      correct: i % 2 === 0,
      createdAt: 0,
      revealedAt: 0,
    })),
    settings: { roundsPerSession: 30, exposureTimeMs: 800 },
    summary: { total: 30, correct: 15, accuracy: 0.5, computedAt: 0, spiritualityEffectiveProb: 0.3 },
  }

  it('renders correct count and accuracy', () => {
    const { container } = render(
      <SessionSummary
        session={session}
        statistics={{ k: 50, n: 100, probPointNull: 0.6, credible: null }}
        onRestart={() => {}}
        onViewHistory={() => {}}
      />,
    )
    expect(container.textContent).toContain('正确：')
    expect(container.textContent).toContain('15')
    expect(container.textContent).toContain('30')
    expect(container.textContent).toContain('50.0%')
  })

  it('renders the 30-cell grid', () => {
    render(
      <SessionSummary
        session={session}
        statistics={{ k: 50, n: 100, probPointNull: 0.6, credible: null }}
        onRestart={() => {}}
        onViewHistory={() => {}}
      />,
    )
    expect(screen.getAllByText(/[✓✕·]/).length).toBe(30)
  })

  it('calls onRestart when "再来一次" is clicked', () => {
    let clicked = false
    render(
      <SessionSummary
        session={session}
        statistics={{ k: 50, n: 100, probPointNull: 0.6, credible: null }}
        onRestart={() => (clicked = true)}
        onViewHistory={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /再来一次/ }))
    expect(clicked).toBe(true)
  })
})
