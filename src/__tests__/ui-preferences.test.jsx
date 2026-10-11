import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App.jsx'
import { I18nProvider, LANGUAGE_KEY, translateText } from '../i18n/I18n.jsx'
import { OpeningAnimation } from '../components/OpeningAnimation.jsx'
import { ExperimentResults } from '../components/ExperimentResults.jsx'
import { fakeApi, soloSnapshot, round } from './helpers/fake-api.js'

vi.mock('../lib/experiment-api.js', async () => (await import('./helpers/fake-api.js')).fakeApi)
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); fakeApi.reset() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it('removes the header DSES shortcut and persists language and light/dark choices', () => {
  const { unmount } = render(<App />)
  const header = document.querySelector('.topbar')
  expect(within(header).queryByText(/DSES/)).toBeNull()
  expect(screen.getByRole('button', { name: '填写问卷' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '切换语言' }))
  expect(screen.getByRole('heading', { name: 'Choose an experiment' })).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('en')
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en')
  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  unmount()
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Choose an experiment' })).toBeInTheDocument()
  expect(document.documentElement.dataset.theme).toBe('dark')
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
  expect(document.documentElement.dataset.theme).toBe('light')
})

it('keeps DSES answers while switching language and translates item numbers and messages', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '填写问卷' }))
  expect(screen.getAllByRole('radio', { name: '从未' })).toHaveLength(15)
  expect(screen.queryByText('Never')).toBeNull()
  fireEvent.click(within(screen.getByRole('group', { name: /第 1 题 神圣/ })).getByRole('radio', { name: /每天多次/ }))
  fireEvent.click(screen.getByRole('button', { name: '切换语言' }))
  const item = screen.getByRole('group', { name: 'Item 1 A sense of divine presence' })
  expect(within(item).getByRole('radio', { name: 'Many times a day' })).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Save this record' }))
  expect(screen.getByRole('status')).toHaveTextContent('Record saved (1/16 answered')
  expect(fakeApi.state.calls).toHaveLength(0)
})

it('changes an active experiment to English without starting another session', async () => {
  fakeApi.state.creds = { sessionId: 'active', token: 'test', role: 'receiver' }
  fakeApi.setHandlers({ get: () => soloSnapshot({ id: 'active', activeRound: round() }) })
  render(<App />)
  await screen.findByRole('radio', { name: '1' })
  fireEvent.click(screen.getByRole('button', { name: '切换语言' }))
  expect(screen.getByRole('heading', { name: 'Hidden information' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  expect(fakeApi.calls('create')).toHaveLength(0)
  expect(fakeApi.state.creds.sessionId).toBe('active')
})

it('translates dynamic validation messages and result labels', () => {
  expect(translateText('导入失败：需要 schemaVersion 2', 'en')).toBe('Import failed: schemaVersion 2 required')
  expect(translateText('已答 8/16 · 缺失 8', 'en')).toBe('Answered 8/16 · Missing 8')
  expect(translateText('room code not found', 'zh')).toContain('邀请码')
  localStorage.setItem(LANGUAGE_KEY, 'en')
  render(<I18nProvider><ExperimentResults session={soloSnapshot({ status: 'COMPLETED', rounds: [round({ status: 'REVEALED', guess: 1, target: 1, correct: true })] })} /></I18nProvider>)
  expect(screen.getByRole('heading', { name: 'Experiment results' })).toBeInTheDocument()
  expect(screen.getByText('Chance baseline')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/)
  cleanup()
  render(<I18nProvider><ExperimentResults session={soloSnapshot({ experimentType: 'telepathy', protocolVersion: 3, chanceBaseline: null, status: 'COMPLETED', rounds: [round({ status: 'REVEALED', guess: 4, target: 4, correct: true })] })} /></I18nProvider>)
  expect(screen.getByText('Match rate')).toBeInTheDocument()
  expect(screen.getByText('Protocol v3')).toBeInTheDocument()
  expect(screen.queryByText('Chance baseline')).toBeNull()
  expect(screen.queryByText(/Sending \/ control/)).toBeNull()
  expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/)
})

it('ends the opening after 1.4 seconds and respects reduced motion', () => {
  vi.useFakeTimers()
  const { unmount } = render(<OpeningAnimation enabled />)
  expect(screen.getByTestId('opening-animation')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1400))
  expect(screen.queryByTestId('opening-animation')).toBeNull()
  unmount()
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: query.includes('reduced-motion') }))
  render(<OpeningAnimation enabled />)
  expect(screen.queryByTestId('opening-animation')).toBeNull()
})
