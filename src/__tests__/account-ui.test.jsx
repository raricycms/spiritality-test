import { beforeEach,afterEach,it,expect,vi } from 'vitest'
import { render,screen,fireEvent,waitFor,cleanup,within } from '@testing-library/react'
import { App } from '../App.jsx'
import { fakeApi,soloSnapshot } from './helpers/fake-api.js'
const mock=vi.hoisted(()=>({account:null,history:{experiments:[],dses:[]},fail:false,download:vi.fn(),save:vi.fn()}))
vi.mock('../lib/experiment-api.js',async()=> (await import('./helpers/fake-api.js')).fakeApi)
vi.mock('../lib/account-api.js',()=>({
  getAccountSession:async()=>({account:mock.account,configured:true}),
  getAccountHistory:async()=>mock.history,
  logoutAccount:async()=>{},
  saveAccountDses:async answers=>{mock.save(answers);if(mock.fail)throw new Error('offline');const r={id:'server-id',createdAt:Date.now(),answers};mock.history={...mock.history,dses:[r]};return r},
  deleteAccountDses:async()=>{},clearAccountExperiments:async()=>{},
  downloadAccountReport:language=>mock.download(language),
}))
beforeEach(()=>{mock.account=null;mock.history={experiments:[],dses:[]};mock.fail=false;mock.download.mockReset();mock.save.mockReset();fakeApi.reset();localStorage.clear();sessionStorage.clear()})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('shows guest mode and an available raricy login link',async()=>{
  render(<App/>);await screen.findByText('游客模式')
  expect(screen.getByRole('link',{name:'使用 raricy 账号登录'})).toHaveAttribute('href','/api/auth/login')
  await waitFor(()=>expect(screen.getByRole('link',{name:'使用 raricy 账号登录'})).toHaveAttribute('aria-disabled','false'))
})
it('uses only the signed-in account history and switches PDF report language',async()=>{
  mock.account={sub:'a',username:'Alice'};mock.history={experiments:[soloSnapshot({id:'account-only',status:'COMPLETED',activeRound:null,rounds:[]})],dses:[]}
  localStorage.setItem('spirituality:v2:history',JSON.stringify([{id:'guest-only'}]))
  render(<App/>);await screen.findByText('Alice')
  fireEvent.click(screen.getByRole('button',{name:'我的报告'}))
  expect(screen.getByRole('heading',{name:'灵性探索报告'})).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'切换语言'}))
  expect(screen.getByRole('heading',{name:'Spirituality exploration report'})).toBeInTheDocument()
  expect(screen.getByRole('img',{name:'Dimension radar chart'})).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Export PDF report'}))
  await waitFor(()=>expect(mock.download).toHaveBeenCalledWith('en'))
  fireEvent.click(screen.getByRole('button',{name:'Sign out'}))
  await screen.findByText('Guest mode')
  expect(screen.queryByRole('heading',{name:'Spirituality exploration report'})).toBeNull()
})
it('saves logged-in DSES to the account without exposing local drafts; failed saves preserve answers',async()=>{
  mock.account={sub:'a',username:'Alice'};localStorage.setItem('spirituality:v2:dses:draft',JSON.stringify({answers:Array(16).fill(6)}))
  render(<App/>);await screen.findByText('Alice')
  fireEvent.click(screen.getByRole('button',{name:'填写问卷'}))
  const first=screen.getByRole('group',{name:/第 1 题 神圣/}),answer=within(first).getByRole('radio',{name:'每天多次'})
  expect(answer).not.toBeChecked()
  fireEvent.click(answer);mock.fail=true
  fireEvent.click(screen.getByRole('button',{name:'保存本次记录'}))
  await screen.findByText('账号保存失败，答案仍保留，请重试。');expect(answer).toBeChecked()
  mock.fail=false;fireEvent.click(screen.getByRole('button',{name:'保存本次记录'}))
  await screen.findByText('本次问卷已保存到账号。')
  expect(mock.save).toHaveBeenLastCalledWith([6,...Array(15).fill(null)])
  expect(localStorage.getItem('spirituality:v2:dses')).toBeNull()
  expect(screen.getByText('我的记录（账号）')).toBeInTheDocument()
})
