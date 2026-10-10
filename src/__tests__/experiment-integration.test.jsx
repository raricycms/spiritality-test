import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { App } from '../App.jsx'
import { useExperiment } from '../hooks/useExperiment.js'
import { fakeApi, soloSnapshot, round } from './helpers/fake-api.js'

vi.mock('../lib/experiment-api.js', async () => (await import('./helpers/fake-api.js')).fakeApi)

beforeEach(() => { fakeApi.reset(); localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
const auth = (snapshot) => ({ sessionId: snapshot.id, token: 'test-token', role: 'receiver', snapshot })

it('App locks the sender target through the API and keeps it across language changes', async () => {
  const selecting = { ...soloSnapshot(), experimentType: 'telepathy', protocolVersion: 3, chanceBaseline: null, role: 'sender', activeRound: round({ status: 'SELECTING' }) }
  fakeApi.state.creds = { sessionId: selecting.id, token: 'sender-token', role: 'sender' }
  fakeApi.setHandlers({ get: () => selecting, target: (_id, body) => ({ ...selecting, activeRound: { ...selecting.activeRound, status: 'SENDING', target: body.target, sendingEndsAt: Date.now() + 15000 } }) })
  render(<App />)
  fireEvent.click(await screen.findByRole('radio', { name: '3' }))
  fireEvent.click(screen.getByRole('button', { name: '锁定并发送' }))
  await screen.findByRole('img', { name: '目标数字 3' })
  expect(fakeApi.calls('target')[0][1]).toEqual([selecting.id, { roundId: 'r1', target: 3 }, 'sender-token'])
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '切换语言' }))
  expect(screen.getByText('Your choice is locked. Focus on conveying it to the receiver.')).toBeInTheDocument()
})

it('DSES opens from App and saves a partial answer independently without an API call', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '填写问卷' }))
  const first = screen.getByRole('group', { name: /第 1 题 神圣的临在感/ })
  fireEvent.click(within(first).getByRole('radio', { name: /每天多次/ }))
  fireEvent.click(screen.getByRole('button', { name: '保存本次记录' }))
  expect(screen.getByRole('status')).toHaveTextContent('已答 1/16')
  expect(JSON.parse(localStorage.getItem('spirituality:v2:dses'))[0].answers[0]).toBe(6)
  expect(localStorage.getItem('spirituality:v2:history')).toBeNull()
  expect(fakeApi.state.calls).toHaveLength(0)
})

it('App rejects an invalid history import through the real validator', async () => {
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '历史' }))
  fireEvent.change(screen.getByLabelText('导入 JSON'), {
    target: { files: [{ text: async () => JSON.stringify({ schemaVersion: 1, sessions: [] }) }] },
  })
  await act(async () => {})
  expect(alert).toHaveBeenCalledWith(expect.stringContaining('schemaVersion 2'))
  expect(localStorage.getItem('spirituality:v2:history')).toBeNull()
})

it('a slow poll cannot undo a locked guess and repeated submit only sends once', async () => {
  vi.useFakeTimers()
  const stale = deferred()
  const submitted = deferred()
  const initial = soloSnapshot({ activeRound: round() })
  fakeApi.setHandlers({ create: () => auth(initial), get: () => stale.promise, guess: () => submitted.promise })
  const { result } = renderHook(() => useExperiment())
  await act(async () => { await result.current.create({ experimentType: 'hidden' }) })
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(fakeApi.calls('get')).toHaveLength(1)
  act(() => { result.current.guess('r1', 1); result.current.guess('r1', 1) })
  expect(fakeApi.calls('guess')).toHaveLength(1)
  const revealed = soloSnapshot({ activeRound: round({ status: 'REVEALED', guess: 1, target: 1, correct: true }) })
  await act(async () => { submitted.resolve(revealed) })
  await act(async () => { stale.resolve(initial) })
  expect(result.current.activeRound.status).toBe('REVEALED')
})
