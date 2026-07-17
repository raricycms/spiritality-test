// Storage persistence: completed sessions must survive "再来一次" / refresh.
// Regression test for the bug where useSession.endAndArchive wrote
// [...history, final] to localStorage but never updated useHistory's React
// state, so the next useAutoSave tick (using stale history) overwrote the
// just-archived session.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { loadSessions } from '../lib/storage.js'
import { aggregateRounds } from '../lib/statistics.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

const TOTAL_ROUNDS = 30

function playOneRound(buttonName = '1') {
  fireEvent.click(screen.getByRole('radio', { name: buttonName }))
  fireEvent.click(screen.getByRole('button', { name: /提交|下一题/ }))
  const next = screen.queryByRole('button', { name: /下一题/ })
  if (next) fireEvent.click(next)
}

// Realistic pacing — 120ms between rounds so the 100ms autosave debounce
// can fire between actions.
async function playFullSession(buttonName = '1') {
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    playOneRound(buttonName)
    await new Promise((r) => setTimeout(r, 120))
  }
  expect(screen.getByText(/测试结束/)).toBeInTheDocument()
}

// Rapid pacing — clicks back-to-back with no delay. Mirrors the user's
// report ("做完三轮之后好像只存了79条") where autosave never gets a chance
// to fire and the only thing protecting data is appendSession on restart.
async function playFullSessionRapid(buttonName = '1') {
  for (let i = 0; i < TOTAL_ROUNDS; i++) playOneRound(buttonName)
  expect(screen.getByText(/测试结束/)).toBeInTheDocument()
}

async function startAndCompleteFirstSession(pacing = 'realistic') {
  fireEvent.click(screen.getByRole('button', { name: /开始一场测试/ }))
  if (pacing === 'realistic') await playFullSession('1')
  else await playFullSessionRapid('1')
  if (pacing === 'realistic') await new Promise((r) => setTimeout(r, 150))
}

async function clickRestart(pacing = 'realistic') {
  fireEvent.click(screen.getByRole('button', { name: /再来一次/ }))
  if (pacing === 'realistic') await new Promise((r) => setTimeout(r, 150))
}

function summarise(sessions) {
  return sessions.reduce((acc, s) => {
    const a = aggregateRounds(s.rounds)
    return { k: acc.k + a.k, n: acc.n + a.n }
  }, { k: 0, n: 0 })
}

function expectSessionsComplete(sessions, expectedCount) {
  expect(sessions).toHaveLength(expectedCount)
  for (const s of sessions) {
    expect(s.status).toBe('COMPLETED')
    expect(s.rounds).toHaveLength(TOTAL_ROUNDS)
  }
}

describe('storage persistence across multiple sessions', () => {
  it('after 3 full sessions + 2 restarts (realistic pacing), localStorage holds all 90 rounds', async () => {
    vi.spyOn(Math, 'random').mockImplementation(() => 0.05)
    const { App } = await import('../App.jsx')
    render(<App />)

    await startAndCompleteFirstSession('realistic')
    await clickRestart('realistic')
    await playFullSession('1')
    await clickRestart('realistic')
    await playFullSession('1')

    const sessions = loadSessions()
    expect(summarise(sessions).n).toBe(90)
    expectSessionsComplete(sessions, 3)
  }, 30000)

  it('rapid clicks: appendSession on restart still preserves the just-completed session', async () => {
    // This is the exact user-reported scenario: clicks faster than the
    // 100ms autosave debounce. Without the fix, useAutoSave would write
    // [...staleHistory, newSession] overwriting the just-archived session.
    // Each session is followed by a "再来一次" click so appendSession —
    // not autosave — is the path that persists the data.
    vi.spyOn(Math, 'random').mockImplementation(() => 0.05)
    const { App } = await import('../App.jsx')
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /开始一场测试/ }))
    await playFullSessionRapid('1')
    await clickRestart('rapid')
    await playFullSessionRapid('1')
    await clickRestart('rapid')
    await playFullSessionRapid('1')
    await clickRestart('rapid')

    const sessions = loadSessions()
    expect(summarise(sessions).n).toBe(90)
    expectSessionsComplete(sessions, 3)
  }, 30000)

  it('the K/N aggregate is stable across a page reload', async () => {
    vi.spyOn(Math, 'random').mockImplementation(() => 0.05)
    const { App } = await import('../App.jsx')
    const { unmount } = render(<App />)

    await startAndCompleteFirstSession('realistic')
    await clickRestart('realistic')
    await playFullSession('1')
    await clickRestart('realistic')
    await playFullSession('1')

    const before = summarise(loadSessions())

    // Simulate a page reload: unmount and remount. useHistory re-runs
    // loadSessions() on mount, so any drift between React state and
    // localStorage would surface here.
    unmount()
    render(<App />)
    const after = summarise(loadSessions())

    expect(after).toEqual(before)
    expect(after.n).toBe(90)
  }, 30000)
})