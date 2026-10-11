// Server-backed terminal persistence (replaces the old localStorage autosave
// tests). Terminal snapshots are written immediately, by id, to the independent
// v2 history; legacy v1 data is never merged or overwritten.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import { App } from '../App.jsx'
import { fakeApi, soloSnapshot } from './helpers/fake-api.js'

vi.mock('../lib/experiment-api.js', async () => (await import('./helpers/fake-api.js')).fakeApi)

vi.mock('../components/ExperimentResults.jsx', () => ({
  ExperimentResults: ({ session }) => <div>实验结果 {session?.id}</div>,
}))

vi.mock('../components/ExperimentHistory.jsx', () => ({
  ExperimentHistory: ({ sessions }) => <div data-testid="v2-history">v2 共 {sessions.length} 条</div>,
}))

const hist = vi.hoisted(() => ({ store: [] }))

vi.mock('../lib/experiment-history.js', () => ({
  loadExperimentHistory: () => hist.store,
  saveExperimentHistory: (sessions) => {
    hist.store = sessions
  },
  mergeExperimentHistory: (a = [], b = []) => {
    const map = new Map(a.map((s) => [s.id, s]))
    for (const s of b) map.set(s.id, s)
    return [...map.values()]
  },
}))

beforeEach(() => {
  fakeApi.reset()
  hist.store = []
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function completedSnapshot(id) {
  return {
    sessionId: id,
    token: 'tok',
    role: 'receiver',
    snapshot: soloSnapshot({ id, status: 'COMPLETED', completedAt: 2000, rounds: [], activeRound: null }),
  }
}

function startHidden() {
  render(<App />)
  fireEvent.click(screen.getAllByRole('button', { name: '选择' })[0])
  fireEvent.click(screen.getByRole('button', { name: /开始实验/ }))
}

describe('v2 terminal history persistence', () => {
  it('writes a completed snapshot to the independent v2 store, not v1', async () => {
    fakeApi.setHandlers({ create: () => completedSnapshot('s1') })
    startHidden()

    await screen.findByText(/实验结果/)
    await waitFor(() => expect(hist.store).toHaveLength(1))
    expect(hist.store[0]).toMatchObject({ id: 's1', status: 'COMPLETED' })
    expect(localStorage.getItem('spirituality:v1:sessions')).toBeNull()
  })

  it('never aggregates v1 records into the new protocol data', async () => {
    localStorage.setItem(
      'spirituality:v1:sessions',
      JSON.stringify([{ id: 'v1-1', status: 'COMPLETED', createdAt: 1, rounds: [] }]),
    )
    fakeApi.setHandlers({ create: () => completedSnapshot('s2') })
    startHidden()

    await screen.findByText(/实验结果/)
    await waitFor(() => expect(hist.store.map((s) => s.id)).toEqual(['s2']))
    const v1 = JSON.parse(localStorage.getItem('spirituality:v1:sessions'))
    expect(v1.map((s) => s.id)).toEqual(['v1-1'])
  })

  it('keeps the v2 record available in the history view after a remount', async () => {
    fakeApi.setHandlers({ create: () => completedSnapshot('s3') })
    const { unmount } = render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: '选择' })[0])
    fireEvent.click(screen.getByRole('button', { name: /开始实验/ }))
    await screen.findByText(/实验结果/)
    unmount()

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '历史' }))
    expect(screen.getByTestId('v2-history')).toHaveTextContent('v2 共 1 条')
  })
})
