// App-level, server-backed behaviour with a concise fake API.
// Covers module creation, request-failure feedback, telepathy roles, refresh
// restore, explicit abandon, restart and terminal-history persistence.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import { App } from '../App.jsx'
import { fakeApi, soloSnapshot, round } from './helpers/fake-api.js'

vi.mock('../lib/experiment-api.js', async () => (await import('./helpers/fake-api.js')).fakeApi)

vi.mock('../components/ExperimentResults.jsx', () => ({
  ExperimentResults: ({ session }) => <div>实验结果 {session?.id}</div>,
}))

vi.mock('../components/ExperimentHistory.jsx', () => ({
  ExperimentHistory: ({ sessions, onClear }) => (
    <div data-testid="v2-history">
      <span>v2 共 {sessions.length} 条</span>
      <button onClick={onClear}>清空新记录</button>
    </div>
  ),
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

function chooseModule(index) {
  fireEvent.click(screen.getAllByRole('button', { name: '选择' })[index])
}

describe('module creation', () => {
  it('creates a hidden-information solo session with 30 rounds by default', async () => {
    fakeApi.setHandlers({
      create: () => ({
        sessionId: 's1',
        token: 'tok',
        role: 'receiver',
        snapshot: soloSnapshot({ activeRound: round({ status: 'TARGET_READY' }) }),
      }),
    })
    render(<App />)
    chooseModule(0)
    fireEvent.click(screen.getByRole('button', { name: /开始实验/ }))

    await screen.findByRole('radio', { name: '1' })
    // Hidden copy must distinguish the pre-generated target timing.
    expect(screen.getByText(/已由服务端生成并冻结/)).toBeInTheDocument()
    expect(fakeApi.calls('create')[0][1][0]).toEqual({
      experimentType: 'hidden',
      roundsPerSession: 30,
      candidateSet: 'digits',
    })
  })

  it('surfaces a failed creation request as an accessible error', async () => {
    fakeApi.setHandlers({
      create: () => {
        throw new fakeApi.ApiError('无法连接到实验服务。', { code: 'offline' })
      },
    })
    render(<App />)
    chooseModule(1)
    fireEvent.click(screen.getByRole('button', { name: /开始实验/ }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('无法连接到实验服务。')
    // No client-side fallback session is created.
    expect(screen.queryByRole('radiogroup', { name: '数字选择' })).not.toBeInTheDocument()
  })
})

describe('telepathy roles', () => {
  it('lets the sender select a symbol set and hides the picker from room joiners', async () => {
    fakeApi.setHandlers({ create: input => ({ sessionId: 't', token: 'tok', role: 'sender', snapshot: { ...soloSnapshot(), experimentType: 'telepathy', role: 'sender', status: 'WAITING', settings: input, activeRound: null, rounds: [], roomCode: 'TEST' } }) })
    render(<App />)
    chooseModule(2)
    expect(screen.getAllByRole('radio')).toHaveLength(6)
    fireEvent.click(screen.getByRole('tab', { name: /我是接收者/ }))
    expect(screen.queryByRole('group', { name: '候选符号' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /我是发送者/ }))
    fireEvent.click(screen.getByRole('radio', { name: '天体', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: '创建房间', exact: true }))
    await screen.findByLabelText('房间邀请码')
    expect(fakeApi.calls('create')[0][1][0].candidateSet).toBe('cosmos')
  })
  it('sender creates a room, sees the code and has no guessing input', async () => {
    fakeApi.setHandlers({
      create: () => ({
        sessionId: 't1',
        token: 'tok',
        role: 'sender',
        snapshot: {
          id: 't1',
          experimentType: 'telepathy',
          role: 'sender',
          status: 'WAITING',
          roomCode: 'ABCD12',
          settings: { roundsPerSession: 30 },
          rounds: [],
          activeRound: null,
        },
      }),
    })
    render(<App />)
    chooseModule(2)
    fireEvent.click(screen.getByRole('button', { name: /创建房间/ }))

    await screen.findByLabelText('房间邀请码')
    expect(screen.getByLabelText('房间邀请码')).toHaveTextContent('ABCD12')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByText(/两个窗口/)).toBeInTheDocument()
  })

  it('receiver joins with a code and gets the answer controls', async () => {
    fakeApi.setHandlers({
      join: () => ({
        sessionId: 't2',
        token: 'tok',
        role: 'receiver',
        snapshot: {
          id: 't2',
          experimentType: 'telepathy',
          role: 'receiver',
          status: 'IN_PROGRESS',
          roomCode: 'ABCD12',
          settings: { roundsPerSession: 30, sendingDurationMs: 15000, answerDurationMs: 15000 },
          rounds: [{ id: 'r1', index: 0, status: 'GUESSING', revealAt: Date.now() + 15000 }],
          activeRound: { id: 'r1', index: 0, status: 'GUESSING', revealAt: Date.now() + 15000 },
        },
      }),
    })
    render(<App />)
    chooseModule(2)
    fireEvent.click(screen.getByRole('tab', { name: /我是接收者/ }))
    fireEvent.change(screen.getByLabelText('邀请码'), { target: { value: 'XYZ9' } })
    fireEvent.click(screen.getByRole('button', { name: /加入房间/ }))

    await screen.findByRole('radio', { name: '1' })
    expect(fakeApi.calls('join')[0][1][0]).toEqual({ code: 'XYZ9' })
  })
})

describe('refresh restore and terminal handling', () => {
  it('restores the same server session after a refresh without re-creating it', async () => {
    fakeApi.state.creds = { sessionId: 's9', token: 'tok9', role: 'receiver' }
    fakeApi.setHandlers({
      get: (id) =>
        soloSnapshot({
          id,
          activeRound: round({ id: 'r5', index: 4, status: 'TARGET_READY' }),
        }),
    })
    render(<App />)

    await screen.findByText(/第 5 \/ 30 轮/)
    expect(fakeApi.calls('create')).toHaveLength(0)
    expect(fakeApi.calls('get')[0][1][0]).toBe('s9')
    expect(fakeApi.calls('get')[0][1][1]).toBe('tok9')
  })

  it('shows a useful error when the server cannot be reached on restore', async () => {
    fakeApi.state.creds = { sessionId: 's9', token: 'tok9', role: 'receiver' }
    fakeApi.setHandlers({
      get: () => {
        throw new fakeApi.ApiError('无法连接到实验服务。请确认服务已启动，然后重试。', { code: 'offline' })
      },
    })
    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/无法连接到实验服务/)
    expect(screen.getByRole('button', { name: /重试连接/ })).toBeInTheDocument()
    // Credentials are kept so the retry targets the same server session.
    expect(fakeApi.state.creds).toMatchObject({ sessionId: 's9' })
  })

  it('abandons explicitly: clears credentials and stores the terminal snapshot', async () => {
    fakeApi.state.creds = { sessionId: 's9', token: 'tok9', role: 'receiver' }
    fakeApi.setHandlers({
      get: (id) => soloSnapshot({ id, activeRound: round({ status: 'TARGET_READY' }) }),
      abandon: (id) =>
        soloSnapshot({ id, status: 'ABANDONED', completedAt: 2000, activeRound: null }),
    })
    render(<App />)
    await screen.findByRole('radio', { name: '1' })

    fireEvent.click(screen.getByRole('button', { name: /放弃本场/ }))
    fireEvent.click(screen.getByRole('button', { name: /确认放弃/ }))

    await screen.findByText(/实验结果/)
    expect(fakeApi.state.creds).toBeNull()
    await waitFor(() => expect(hist.store.some((s) => s.id === 's9' && s.status === 'ABANDONED')).toBe(true))
  })

  it('returns to candidate selection before restarting the same module', async () => {
    fakeApi.setHandlers({
      create: () => ({
        sessionId: 's1',
        token: 'tok',
        role: 'receiver',
        snapshot: soloSnapshot({
          status: 'COMPLETED',
          completedAt: 2000,
          rounds: [],
          activeRound: null,
          settings: { roundsPerSession: 20, candidateSet: 'faces' },
        }),
      }),
    })
    render(<App />)
    chooseModule(0)
    fireEvent.click(screen.getByRole('button', { name: /开始实验/ }))

    await screen.findByText(/实验结果/)
    await waitFor(() => expect(hist.store.some((s) => s.id === 's1' && s.status === 'COMPLETED')).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: /再测一次/ }))
    expect(screen.getByRole('radio', { name: '表情' })).toBeChecked()
    expect(screen.getByRole('spinbutton')).toHaveValue(20)
    expect(fakeApi.calls('create')).toHaveLength(1)
    fireEvent.click(screen.getByRole('radio', { name: '字母' }))
    fireEvent.click(screen.getByRole('button', { name: /开始实验/ }))
    await waitFor(() => expect(fakeApi.calls('create')).toHaveLength(2))
    expect(fakeApi.calls('create')[1][1][0]).toEqual({
      experimentType: 'hidden',
      roundsPerSession: 20,
      candidateSet: 'letters',
    })
  })
})

describe('history view', () => {
  it('shows v2 history separately from legacy v1 records and can clear v2', async () => {
    hist.store = [{ id: 'h1', status: 'COMPLETED', rounds: [] }]
    localStorage.setItem(
      'spirituality:v1:sessions',
      JSON.stringify([{ id: 'v1-1', status: 'COMPLETED', createdAt: 1, rounds: [], summary: { correct: 5, total: 30 } }]),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '历史' }))

    expect(screen.getByTestId('v2-history')).toHaveTextContent('v2 共 1 条')
    expect(screen.getByText('旧版记录（v1，单独展示，不与新协议合并）')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /清空新记录/ }))
    await waitFor(() => expect(hist.store).toEqual([]))
  })
})
