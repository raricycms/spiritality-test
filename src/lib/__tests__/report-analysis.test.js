import {it,expect} from 'vitest'
import {buildReportModel} from '../../../shared/report-model.js'
import {analyzeReport} from '../../../shared/report-analysis.js'
const rounds=(n,k)=>Array.from({length:n},(_,i)=>({status:'REVEALED',target:1,guess:i<k?1:2}))
const s=(id,type,n,k,partner,time=1)=>({id,experimentType:type,protocolVersion:type==='telepathy'?3:2,status:'COMPLETED',createdAt:time,settings:{candidateSet:'digits'},rounds:rounds(n,k),partner})
it('withholds trend and partner rankings when samples are insufficient',()=>{
  const a=analyzeReport(buildReportModel({experiments:[s('one','telepathy',1,1,{sub:'p',username:'P'})]}, {username:'Me'}),'zh')
  expect(a.profile.label).toBe('初步探索型');expect(a.partner.leaders).toHaveLength(0)
  expect(a.partner.detail).toContain('10');expect(a.trends.every(t=>t.direction==='insufficient')).toBe(true)
})
it('describes rising DSES experience without making a general ability claim',()=>{
  const dses=[1,3,5,6].map((score,i)=>({createdAt:i+1,answers:Array(16).fill(score)}))
  const a=analyzeReport(buildReportModel({dses},{username:'Me'}),'zh')
  expect(a.trends.find(t=>t.key==='dses').direction).toBe('up')
  expect(a.trends.find(t=>t.key==='dses').text).toContain('更频繁')
  expect(a.profile.label).toBe('体验记录型')
})
it('ranks only adequately sampled account partners and labels the actual match counts',()=>{
  const experiments=[s('a','telepathy',20,12,{sub:'a',username:'Alice'}),s('b','telepathy',10,8,{sub:'b',username:'Bob'}),s('c','telepathy',1,1,{sub:'c',username:'Tiny'})]
  const a=analyzeReport(buildReportModel({experiments},{username:'Me'}),'zh')
  expect(a.partner.leaders.map(p=>p.label)).toEqual(['Bob'])
  expect(a.partner.detail).toContain('Bob 8/10');expect(a.partner.detail).not.toContain('Tiny')
})
it('provides a multi-dimensional profile only when each experiment has adequate data',()=>{
  const experiments=['hidden','precognition','telepathy'].map(type=>s(type,type,20,10))
  const a=analyzeReport(buildReportModel({experiments,dses:[{createdAt:1,answers:Array(16).fill(3)}]},{username:'Me'}),'en')
  expect(a.profile.label).toBe('Multi-dimensional explorer')
  expect(a.dimensions).toHaveLength(4);expect(a.profile.description).not.toMatch(/[\u3400-\u9fff]/)
})
it('classifies focused, paired and steady exploration separately',()=>{
  const make=experiments=>analyzeReport(buildReportModel({experiments},{username:'Me'}),'zh').profile.label
  expect(make([s('h','hidden',80,20)])).toBe('单项深耕型')
  expect(make([s('t','telepathy',30,20)])).toBe('双人协作型')
  expect(make([s('h','hidden',20,5),s('p','precognition',20,5)])).toBe('渐进探索型')
})
it('keeps settings separate for both trends and best-partner commentary',()=>{
  const previous=s('old','telepathy',100,100,{sub:'old',username:'Old'},1)
  const current={...s('new','telepathy',10,6,{sub:'new',username:'New'},2),settings:{candidateSet:'faces'}}
  const a=analyzeReport(buildReportModel({experiments:[previous,current]},{username:'Me'}),'zh')
  expect(a.partner.leaders[0].label).toBe('New')
  expect(a.trends.find(tr=>tr.key==='telepathy').direction).toBe('insufficient')
})
it('reports tied partners with their own denominators',()=>{
  const experiments=[s('a','telepathy',20,10,{sub:'a',username:'A'}),s('b','telepathy',10,5,{sub:'b',username:'B'})]
  const a=analyzeReport(buildReportModel({experiments},{username:'Me'}),'zh')
  expect(a.partner.leaders).toHaveLength(2);expect(a.partner.detail).toContain('A 10/20');expect(a.partner.detail).toContain('B 5/10')
})
it('gives mixed trends a synthesis that keeps their directions separate',()=>{
  const experiments=[1,2,3,4].flatMap((time,i)=>[s('h'+i,'hidden',30,3+i*6,null,time),s('p'+i,'precognition',30,24-i*6,null,time)])
  const a=analyzeReport(buildReportModel({experiments},{username:'Me'}),'zh')
  expect(a.trends.find(t=>t.key==='hidden').direction).toBe('up')
  expect(a.trends.find(t=>t.key==='precognition').direction).toBe('down')
  expect(a.synthesis.text).toContain('不同步');expect(a.synthesis.text).toContain('隐藏信息感知');expect(a.synthesis.text).toContain('未来事件预知')
})
it('describes declining experience and withholds under-sampled experiment trends',()=>{
  const dses=[6,5,3,1].map((score,i)=>({createdAt:i,answers:Array(16).fill(score)}))
  const experiments=[s('a','hidden',5,0,null,1),s('b','hidden',15,4,null,2),s('c','hidden',50,40,null,3)]
  const a=analyzeReport(buildReportModel({experiments,dses},{username:'Me'}),'en')
  expect(a.trends.find(tr=>tr.key==='dses').direction).toBe('down');expect(a.trends.find(tr=>tr.key==='hidden').direction).toBe('insufficient')
})
