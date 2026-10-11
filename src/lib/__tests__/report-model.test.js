import { describe,it,expect } from 'vitest'
import { buildReportModel } from '../../../shared/report-model.js'
const s=(id,type,set,createdAt,rounds,partner)=>({id,experimentType:type,protocolVersion:type==='telepathy'?3:2,status:'COMPLETED',createdAt,settings:{candidateSet:set},rounds,partner})
const round=(target,guess)=>({status:'REVEALED',target,guess})
describe('report observations',()=>{
  it('keeps missing axes distinct from zero and excludes incomplete DSES',()=>{
    const m=buildReportModel({experiments:[s('1','hidden','digits',1,[round(1,2)])],dses:[{createdAt:1,answers:[6,...Array(15).fill(null)]}]},{username:'me'})
    expect(m.dimensions.map(d=>d.value)).toEqual([0,null,null,null]);expect(m.series).toHaveLength(1)
  })
  it('does not pool protocols or symbols and uses actual round counts rather than supplied correct flags',()=>{
    const m=buildReportModel({experiments:[s('1','hidden','digits',1,[round(1,1)]),s('2','hidden','letters',2,[{...round(1,2),correct:true}])],dses:[{createdAt:1,answers:Array(16).fill(6)}]},{username:'me'})
    expect(m.dimensions[0].value).toBe(0);expect(m.dimensions[0].n).toBe(1);expect(m.dimensions[3].value).toBe(100);expect(m.series).toHaveLength(3)
  })
  it('aggregates repeated account partners but never links anonymous partners across rooms',()=>{
    const m=buildReportModel({experiments:[s('1','telepathy','digits',1,[round(1,1)],{sub:'a',username:'A'}),s('2','telepathy','digits',2,[round(1,2)],{sub:'a',username:'A'}),s('3','telepathy','digits',3,[]),s('4','telepathy','digits',4,[])]},{username:'me'})
    expect(m.peers).toHaveLength(3);expect(m.peers[0]).toMatchObject({n:2,correct:1,sessions:2})
  })
})
