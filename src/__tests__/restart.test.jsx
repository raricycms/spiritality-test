// Server-backed round flow (replaces the old local restart reproduction).
// A solo guess is scored by the server, and advancing asks the server for the
// next round — the client never generates targets.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

import { App } from '../App.jsx'
import { fakeApi, soloSnapshot, round } from './helpers/fake-api.js'

vi.mock('../lib/experiment-api.js', async () => (await import('./helpers/fake-api.js')).fakeApi)

vi.mock('../components/ExperimentResults.jsx', () => ({
  ExperimentResults: ({ session }) => <div>实验结果 {session?.id}</div>,
}))

vi.mock('../components/ExperimentHistory.jsx', () => ({
  ExperimentHistory: () => <div data-testid="v2-history" />,
}))

vi.mock('../lib/experiment-history.js', () => ({
  loadExperimentHistory: () => [],
  saveExperimentHistory: () => {},
  mergeExperimentHistory: (a) => a,
}))

beforeEach(() => {
  fakeApi.reset()
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function auth(snapshot) {
  return { sessionId: snapshot.id, token: 'tok', role: snapshot.role, snapshot }
}

describe('server-backed solo round flow', () => {
  it('submits a guess, shows the reveal, then advances to the next round', async () => {
    fakeApi.setHandlers({
      create: () =>
        auth(soloSnapshot({ activeRound: round({ id: 'r1', index: 0, status: 'TARGET_READY' }) })),
      guess: (id, body) =>
        soloSnapshot({
          rounds: [round({ id: 'r1', index: 0, status: 'REVEALED', target: 3, guess: body.guess, correct: true, revealedAt: 2 })],
          activeRound: round({ id: 'r1', index: 0, status: 'REVEALED', target: 3, guess: body.guess, correct: true, revealedAt: 2 }),
        }),
      next: () =>
        soloSnapshot({
          rounds: [round({ id: 'r1', index: 0, status: 'REVEALED', target: 3, guess: 3, correct: true, revealedAt: 2 })],
          activeRound: round({ id: 'r2', index: 1, status: 'TARGET_READY' }),
        }),
    })

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: '选择' })[0])
    fireEvent.click(screen.getByRole('button', { name: /开始实验/ }))
    await screen.findByRole('radio', { name: '3' })

    fireEvent.click(screen.getByRole('radio', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: /提交/ }))
    await screen.findByText(/命中/)

    expect(fakeApi.calls('guess')[0][1][1]).toEqual({ roundId: 'r1', guess: 3, confidence: null })

    fireEvent.click(screen.getByRole('button', { name: /下一轮/ }))
    await screen.findByText(/第 2 \/ 30 轮/)
    expect(fakeApi.calls('next')[0][1][1]).toEqual({ roundId: 'r1' })
  })
})
