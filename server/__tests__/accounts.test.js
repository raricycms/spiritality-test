import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createExperimentServer } from '../index.js'
import { createAccountStore } from '../accounts.js'
import { createMemoryStorage } from '../storage.js'

async function fixture(file) {
  const origin='http://127.0.0.1', redirectUri=`${origin}/oauth/callback`, revoked=new Set(), exchanges=[]
  const authFetch=async(url,init={})=>{
    if(url.pathname.endsWith('/token')) { const body=new URLSearchParams(init.body);exchanges.push({body,headers:init.headers});return new Response(JSON.stringify({access_token:`test:${body.get('code')}`,token_type:'Bearer',expires_in:7776000})) }
    if(url.pathname.endsWith('/userinfo')) { const token=init.headers.authorization.slice(7);if(revoked.has(token))return new Response('{}',{status:401});const sub=token.slice(5);return new Response(JSON.stringify({sub,username:`user-${sub}`})) }
    if(url.pathname.endsWith('/revoke')) { revoked.add(JSON.parse(init.body).token);return new Response('{}') }
    throw new Error('Unexpected provider call')
  }
  let now=1000000
  const storage=createMemoryStorage(), accounts=createAccountStore({memory:!file,file,clock:()=>now})
  const app=createExperimentServer({storage,accountStore:accounts,clock:()=>now,random:()=>0,authConfig:{clientId:'test-client',clientSecret:'test-secret',redirectUri,baseUrl:'https://raricy.com'},authFetch,logger:{error(){}}})
  const {port}=await app.listen(0,'127.0.0.1'),base=`http://127.0.0.1:${port}`
  async function request(route,{cookie,method='GET',body,token,requestOrigin=origin}={}) {
    const res=await fetch(base+route,{method,redirect:'manual',headers:{...(cookie?{cookie}:{}),...(method!=='GET'?{origin:requestOrigin}:{}),...(token?{authorization:`Bearer ${token}`} : {}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
    let data=null;if(res.headers.get('content-type')?.includes('application/json'))data=await res.json()
    return {res,data}
  }
  async function login(sub){const start=await request('/api/auth/login'),url=new URL(start.res.headers.get('location')),state=url.searchParams.get('state'),binding=start.res.headers.get('set-cookie').split(';')[0];const cb=await request(`/oauth/callback?state=${state}&code=${sub}`,{cookie:binding});assert.equal(cb.res.status,302);const cookie=cb.res.headers.getSetCookie().find(c=>c.startsWith('raricy_session=')).split(';')[0];return {cookie,state,binding}}
  return {app,request,login,storage,accounts,exchanges,revoked,redirectUri,advance:ms=>{now+=ms}}
}

test('OAuth state is cookie-bound, one-use; Basic exchange uses the exact callback URI',async()=>{
  const f=await fixture()
  try {
    const start=await f.request('/api/auth/login'),url=new URL(start.res.headers.get('location')),state=url.searchParams.get('state'),binding=start.res.headers.get('set-cookie').split(';')[0]
    assert.equal(url.pathname,'/oauth/authorize');assert.equal(url.searchParams.get('scope'),'profile')
    assert.equal((await f.request(`/oauth/callback?code=alice&state=${state}`)).res.status,400)
    const callback=await f.request(`/oauth/callback?code=alice&state=${state}`,{cookie:binding});assert.equal(callback.res.status,302)
    assert.equal(f.exchanges[0].body.get('redirect_uri'),f.redirectUri)
    assert.match(f.exchanges[0].headers.authorization,/^Basic /)
    assert.equal((await f.request(`/oauth/callback?code=alice&state=${state}`,{cookie:binding})).res.status,400)
    assert.match(callback.res.headers.get('set-cookie'),/HttpOnly/)
  }finally{await f.app.close()}
})

test('guest results never enter storage and terminal solo sessions purge state and credentials',async()=>{
  const f=await fixture()
  try {
    const create=await f.request('/api/experiments',{method:'POST',body:{experimentType:'hidden',roundsPerSession:5,account:{sub:'spoof'}}}),s=create.data
    assert.equal(f.storage.data,null)
    for(let i=0;i<5;i++){
      const result=await f.request(`/api/experiments/${s.sessionId}/guess`,{method:'POST',token:s.token,body:{roundId:s.snapshot.activeRound.id,guess:1}})
      assert.equal(result.res.status,200);s.snapshot=result.data
      if(i<4)s.snapshot=(await f.request(`/api/experiments/${s.sessionId}/next`,{method:'POST',token:s.token,body:{roundId:s.snapshot.activeRound.id}})).data
    }
    assert.equal(s.snapshot.status,'COMPLETED');assert.equal(f.storage.data,null)
    assert.equal(Object.keys(f.app.service.state.sessions).length,0);assert.equal(Object.keys(f.app.service.state.tokens).length,0)
    assert.deepEqual(await f.accounts.history({sub:'spoof'}),{experiments:[],dses:[]})
    assert.equal((await f.request('/api/account/history')).res.status,401)
  }finally{await f.app.close()}
})

test('accounts are isolated; terminal results survive restart and DSES scores/timestamps come from answers/server',async()=>{
  await fs.mkdir('.tmp',{recursive:true});const dir=await fs.mkdtemp(path.resolve('.tmp/accounts-test-')),file=path.join(dir,'accounts.json'),f=await fixture(file)
  try{
    const alice=await f.login('alice'),bob=await f.login('bob')
    const s=(await f.request('/api/experiments',{method:'POST',cookie:alice.cookie,body:{experimentType:'precognition',roundsPerSession:5,account:{sub:'bob'}}})).data
    await f.request(`/api/experiments/${s.sessionId}/guess`,{method:'POST',token:s.token,cookie:alice.cookie,body:{roundId:s.snapshot.activeRound.id,guess:1}})
    await f.request(`/api/experiments/${s.sessionId}/abandon`,{method:'POST',token:s.token,cookie:alice.cookie})
    const answers=Array(16).fill(6)
    const record=await f.request('/api/account/dses',{method:'POST',cookie:alice.cookie,body:{answers,sub:'bob',createdAt:1,mean:0}})
    assert.equal(record.res.status,201);assert.equal(record.data.createdAt,1000000);assert.equal(record.data.mean,undefined)
    assert.equal((await f.request('/api/account/dses',{method:'POST',cookie:alice.cookie,body:{answers:Array(16).fill(99)}})).res.status,400)
    assert.equal((await f.request('/api/account/dses',{method:'POST',cookie:alice.cookie,requestOrigin:'https://evil.example',body:{answers}})).res.status,403)
    assert.equal((await f.request('/api/account/history',{cookie:bob.cookie})).data.experiments.length,0)
    const stored=await createAccountStore({file}).history({sub:'alice'})
    assert.equal(stored.experiments.length,1);assert.equal(stored.dses.length,1)
    const raw=await fs.readFile(file,'utf8');assert.ok(!raw.includes(s.token));assert.ok(!raw.includes('test:alice'));assert.ok(!raw.includes('test-secret'))
    f.revoked.add('test:alice');assert.equal((await f.request('/api/account/history',{cookie:alice.cookie})).res.status,401)
  }finally{await f.app.close();await fs.rm(dir,{recursive:true,force:true})}
})

test('paired archive belongs to each logged participant; guest partners remain anonymous and raw room state expires',async()=>{
  const f=await fixture()
  try{
    const a=await f.login('alice'),b=await f.login('bob')
    const s=(await f.request('/api/experiments',{method:'POST',cookie:a.cookie,body:{experimentType:'telepathy',roundsPerSession:5}})).data
    const r=(await f.request('/api/rooms/join',{method:'POST',cookie:b.cookie,body:{code:s.snapshot.roomCode}})).data
    await f.request(`/api/experiments/${s.sessionId}/abandon`,{method:'POST',cookie:a.cookie,token:s.token})
    assert.equal((await f.request('/api/account/history',{cookie:a.cookie})).data.experiments[0].partner.sub,'bob')
    assert.equal((await f.request('/api/account/history',{cookie:b.cookie})).data.experiments[0].partner.sub,'alice')
    await f.request(`/api/experiments/${s.sessionId}`,{cookie:b.cookie,token:r.token})
    assert.equal(Object.keys(f.app.service.state.sessions).length,0)
    const guest=(await f.request('/api/experiments',{method:'POST',body:{experimentType:'telepathy',roundsPerSession:5}})).data
    await f.request('/api/rooms/join',{method:'POST',cookie:a.cookie,body:{code:guest.snapshot.roomCode}})
    await f.request(`/api/experiments/${guest.sessionId}/abandon`,{method:'POST',token:guest.token})
    const history=(await f.request('/api/account/history',{cookie:a.cookie})).data
    assert.deepEqual(history.experiments.at(-1).partner,{username:null})
    f.advance(300001);await f.app.service.sweep();assert.equal(Object.keys(f.app.service.state.sessions).length,0)
    assert.equal(f.storage.data,null)
  }finally{await f.app.close()}
})

test('expired OAuth state and logout revoke access; unauthenticated report export is denied',async()=>{
  const f=await fixture()
  try{
    const start=await f.request('/api/auth/login'),state=new URL(start.res.headers.get('location')).searchParams.get('state'),binding=start.res.headers.get('set-cookie').split(';')[0]
    f.advance(600001);assert.equal((await f.request(`/oauth/callback?code=alice&state=${state}`,{cookie:binding})).res.status,400)
    const a=await f.login('alice');assert.equal((await f.request('/api/auth/logout',{cookie:a.cookie,method:'POST'})).res.status,200)
    assert.ok(f.revoked.has('test:alice'));assert.equal((await f.request('/api/account/report.pdf',{cookie:a.cookie})).res.status,401)
  }finally{await f.app.close()}
})

test('signed-in PDF export contains a real paginated document even with no records',async()=>{
  const f=await fixture()
  try{
    const a=await f.login('alice')
    for(const language of ['zh','en']) {
      const report=await f.request(`/api/account/report.pdf?lang=${language}`,{cookie:a.cookie})
      assert.equal(report.res.status,200);assert.equal(report.res.headers.get('content-type'),'application/pdf')
      assert.equal(report.res.headers.get('cache-control'),'no-store')
      const bytes=Buffer.from(await report.res.arrayBuffer())
      assert.equal(bytes.subarray(0,4).toString(),'%PDF')
      assert.ok((bytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>=7)
    }
  }finally{await f.app.close()}
})
