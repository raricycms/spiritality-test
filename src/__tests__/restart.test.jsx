// Reproduction of the "再来一次 doesn't work" bug.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import '@testing-library/jest-dom'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  localStorage.clear()
})

describe('App restart flow', () => {
  it('after completing 30 rounds, "再来一次" starts a fresh session', async () => {
    // Deterministic RNG: all targets = 1
    vi.spyOn(Math, 'random').mockImplementation(() => 0.05)

    const { App } = await import('../App.jsx')
    render(<App />)

    // 1. Start a session.
    fireEvent.click(screen.getByRole('button', { name: /开始一场测试/ }))

    // 2. Play all 30 rounds: pick digit 1, submit, advance.
    for (let i = 0; i < 30; i++) {
      // Pick 1 (the deterministic target).
      fireEvent.click(screen.getByRole('radio', { name: '1' }))
      // Submit.
      const submitBtn = screen.getByRole('button', { name: /提交|下一题/ })
      fireEvent.click(submitBtn)
      // If we're on the last round, after submit the SessionSummary shows.
      // Otherwise, we get the "下一题" button which advances.
      // Click 下一题 if present (only for rounds 1..29, NOT after the last submit).
      const nextBtn = screen.queryByRole('button', { name: /下一题/ })
      if (nextBtn) {
        fireEvent.click(nextBtn)
      }
    }

    // We should now see the SessionSummary.
    expect(screen.getByText(/测试结束/)).toBeInTheDocument()

    // 3. Click 再来一次.
    const restartBtn = screen.getByRole('button', { name: /再来一次/ })
    fireEvent.click(restartBtn)

    // 4. Expect a new round to be active.
    // After clicking 再来一次, SessionSummary should be GONE and RoundView should appear.
    expect(screen.queryByText(/测试结束/)).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /被遮挡/ })).toBeInTheDocument()
    // Round counter should show "第 1 / 30 轮" again.
    expect(document.body.textContent).toContain('1')
    expect(document.body.textContent).toContain('30')
  }, 15000)
})
