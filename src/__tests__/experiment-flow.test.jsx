// Role-specific telepathy rendering and fixed locking — component level.
// These tests mount ExperimentFlow directly so they exercise the view logic
// without depending on the results/history components owned by other agents.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

import { ExperimentFlow } from '../components/ExperimentFlow.jsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function telepathy(role, activeRound, status = 'IN_PROGRESS') {
  return {
    id: 't1',
    experimentType: 'telepathy',
    protocolVersion: 2,
    chanceBaseline: 0.2,
    role,
    status,
    roomCode: 'ABCD12',
    settings: { roundsPerSession: 30, sendingDurationMs: 15000, answerDurationMs: 15000 },
    rounds: activeRound ? [activeRound] : [],
    activeRound: activeRound || null,
  }
}

function renderFlow(session, overrides = {}) {
  const props = {
    session,
    busy: false,
    error: null,
    onGuess: vi.fn(),
    onNext: vi.fn(),
    onAbandon: vi.fn(),
    onRetry: vi.fn(),
    onLeave: vi.fn(),
    ...overrides,
  }
  return { ...render(<ExperimentFlow {...props} />), props }
}

describe('telepathy receiver', () => {
  it.each([
    ['letters', 'C', 'C'], ['colors', '黄色', '🟨'], ['faces', '生气', '😡'], ['directions', '向左', '⬅️'],
  ])('renders %s choices and scores the selected position', (candidateSet, name, visible) => {
    const onGuess = vi.fn()
    const s = { ...telepathy('receiver', { id: 'r1', index: 0, status: 'GUESSING' }), settings: { roundsPerSession: 5, candidateSet } }
    const { rerender, props } = renderFlow(s, { onGuess })
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    fireEvent.click(screen.getByRole('radio', { name, exact: true }))
    fireEvent.click(screen.getByRole('button', { name: '提交', exact: true }))
    expect(onGuess).toHaveBeenCalledWith('r1', 3, null)
    rerender(<ExperimentFlow {...props} session={{ ...s, activeRound: { ...s.activeRound, status: 'REVEALED', target: 3, guess: 3, correct: true } }} />)
    expect(screen.getByRole('img', { name: `目标 ${name}` })).toHaveTextContent(visible)
  })
  it('shows 1–5 guess controls during the answer phase', () => {
    renderFlow(
      telepathy('receiver', {
        id: 'r1', index: 0, status: 'GUESSING', revealAt: Date.now() + 15000,
      }),
    )
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole('radio', { name: String(n) })).toBeInTheDocument()
    }
    expect(screen.getByText(/作答期剩余/)).toBeInTheDocument()
  })

  it('locks: after early submit it waits for the fixed reveal with no input', () => {
    renderFlow(
      telepathy('receiver', {
        id: 'r1', index: 0, status: 'LOCKED', guess: 3, guessLockedAt: 1, revealAt: Date.now() + 30000,
      }),
    )
    expect(screen.getByText(/答案已锁定/)).toBeInTheDocument()
    expect(screen.getByText(/距统一揭晓/)).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /提交/ })).not.toBeInTheDocument()
  })

  it('keeps the 1–5 keyboard semantics and captures optional confidence', () => {
    const onGuess = vi.fn()
    renderFlow(
      telepathy('receiver', { id: 'r1', index: 0, status: 'GUESSING', revealAt: Date.now() + 15000 }),
      { onGuess },
    )
    fireEvent.keyDown(window, { key: '3' })
    expect(screen.getByRole('radio', { name: '3' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByLabelText(/记录信心评分/))
    fireEvent.click(screen.getByRole('button', { name: /提交/ }))
    expect(onGuess).toHaveBeenCalledWith('r1', 3, 50)
  })

  it('does not hijack digit keys typed into native controls', () => {
    renderFlow(telepathy('receiver', { id: 'r1', index: 0, status: 'GUESSING' }))
    const checkbox = screen.getByLabelText(/记录信心评分/)
    fireEvent.keyDown(checkbox, { key: '5' })
    expect(screen.getByRole('radio', { name: '5' })).toHaveAttribute('aria-checked', 'false')
  })

  it('reveals the result but not the condition before the session ends', () => {
    renderFlow(
      telepathy('receiver', {
        id: 'r1', index: 0, status: 'REVEALED', target: 4, guess: 4, correct: true, condition: 'sending', revealedAt: 2,
      }),
    )
    expect(screen.getByRole('img', { name: '目标数字 4' })).toBeInTheDocument()
    expect(screen.getByText(/命中/)).toBeInTheDocument()
    expect(screen.queryByText(/sending/)).not.toBeInTheDocument()
    expect(screen.queryByText(/真实发送/)).not.toBeInTheDocument()
  })
})

describe('telepathy sender', () => {
  it('uses the room symbols for sending and receiving choices and the revealed target', () => {
    const s = { ...telepathy('sender', { id: 'r1', index: 0, status: 'SELECTING' }), protocolVersion: 3, settings: { roundsPerSession: 5, candidateSet: 'cosmos' } }
    const onTarget = vi.fn()
    const { rerender, props } = renderFlow(s, { onTarget })
    fireEvent.click(screen.getByRole('radio', { name: '太阳' }))
    fireEvent.click(screen.getByRole('button', { name: '锁定并发送' }))
    expect(onTarget).toHaveBeenCalledWith('r1', 3)
    const r = { ...s.activeRound, status: 'GUESSING' }
    rerender(<ExperimentFlow {...props} session={{ ...s, role: 'receiver', activeRound: r }} />)
    expect(screen.getByRole('radio', { name: '黑洞' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /目标 太阳/ })).toBeNull()
    rerender(<ExperimentFlow {...props} session={{ ...s, role: 'receiver', activeRound: { ...r, status: 'REVEALED', target: 3, guess: 3, correct: true } }} />)
    expect(screen.getByRole('img', { name: '目标 太阳' })).toBeInTheDocument()
  })
  it('chooses a target before sending; locked choices no longer show inputs', () => {
    const onTarget = vi.fn()
    const s = { ...telepathy('sender', { id: 'r1', index: 0, status: 'SELECTING' }), protocolVersion: 3 }
    const { rerender, props } = renderFlow(s, { onTarget })
    fireEvent.click(screen.getByRole('radio', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: '锁定并发送' }))
    expect(onTarget).toHaveBeenCalledWith('r1', 4)
    expect(screen.queryByLabelText(/记录信心评分/)).not.toBeInTheDocument()
    rerender(<ExperimentFlow {...props} session={{ ...s, activeRound: { ...s.activeRound, status: 'SENDING', target: 4, sendingEndsAt: Date.now() + 15000 } }} />)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '目标数字 4' })).toBeInTheDocument()
  })

  it('sees the target during a real sending phase and has no guessing input', () => {
    renderFlow(
      telepathy('sender', {
        id: 'r1', index: 0, status: 'SENDING', target: 2, condition: 'sending', sendingEndsAt: Date.now() + 15000,
      }),
    )
    expect(screen.getByRole('img', { name: '目标数字 2' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /下一轮/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /提交/ })).not.toBeInTheDocument()
  })

  it('sees a neutral instruction on control rounds', () => {
    renderFlow(
      telepathy('sender', {
        id: 'r1', index: 0, status: 'SENDING', target: null, condition: 'control', sendingEndsAt: Date.now() + 15000,
      }),
    )
    expect(screen.getByText(/保持安静与专注/)).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /目标数字/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('cannot advance after a reveal', () => {
    renderFlow(
      telepathy('sender', {
        id: 'r1', index: 0, status: 'REVEALED', target: 5, guess: 5, correct: true, revealedAt: 2,
      }),
    )
    expect(screen.getByText(/等待接收者进入下一轮/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /下一轮/ })).not.toBeInTheDocument()
  })

  it('shows the invite code and participant separation while waiting', () => {
    renderFlow(telepathy('sender', null, 'WAITING'))
    expect(screen.getByLabelText('房间邀请码')).toHaveTextContent('ABCD12')
    expect(screen.getByText(/两个窗口/)).toBeInTheDocument()
  })
})

describe('timeout abandoned rounds', () => {
  it('offers the next action for an abandoned receiver round', () => {
    const onNext = vi.fn()
    renderFlow(
      telepathy('receiver', {
        id: 'r1', index: 0, status: 'ABANDONED', invalidReason: 'timeout',
      }),
      { onNext },
    )
    expect(screen.getByRole('status')).toHaveTextContent('已作废')
    fireEvent.click(screen.getByRole('button', { name: /下一轮/ }))
    expect(onNext).toHaveBeenCalledWith('r1')
  })
})
