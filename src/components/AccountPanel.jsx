import { useState } from 'react'
import { useAccount } from '../hooks/useAccount.jsx'
import { useI18n } from '../i18n/I18n.jsx'
import { downloadAccountReport } from '../lib/account-api.js'
import { buildReportModel } from '../../shared/report-model.js'
import { analyzeReport } from '../../shared/report-analysis.js'
import './AccountPanel.css'

export function AccountBanner({ active, onReport }) {
  const auth = useAccount(), { localize, t } = useI18n(), [error,setError] = useState('')
  return localize(<aside className="account-banner">
    <div><strong>{auth.loading ? '正在检查登录…' : auth.account ? auth.account.username : '游客模式'}</strong><p>{auth.account ? '测验结果与问卷按账号保存，可跨设备查看。' : '游客测验结束后，服务器不保留记录。本机历史可自行导出。'}</p></div>
    <div className="account-actions">{auth.account ? <><button className="ghost-btn" onClick={onReport}>我的报告</button><button className="ghost-btn" disabled={active} onClick={async()=>{try{await auth.logout()}catch{setError('退出失败，请重试')}}}>退出登录</button></> : <a className="primary-btn" href="/api/auth/login" aria-disabled={!auth.configured || active || auth.loading} onClick={event=>{if(!auth.configured || active || auth.loading) event.preventDefault()}}>{t('使用 raricy 账号登录')}</a>}
    {!auth.account && !auth.loading && !auth.configured && <span className="account-hint">登录尚未配置</span>}</div>
    {(error || auth.error) && <p className="account-hint" role="alert">{t(error || auth.error)}</p>}
  </aside>)
}

export function AccountReport({ onBack }) {
  const { account, history, refresh } = useAccount(), {language,localize} = useI18n(), [error,setError] = useState(''), [busy,setBusy] = useState(false), [networkPage,setNetworkPage]=useState(0)
  const m=buildReportModel(history,account,language), peers=m.peers.slice(networkPage*8,networkPage*8+8)
  const analysis=analyzeReport(m,language)
  async function download(){setBusy(true);setError('');try{await refresh();await downloadAccountReport(language)}catch{setError('报告生成失败，请检查登录状态后重试。')}finally{setBusy(false)}}
  const pos=(i,r)=>[170+Math.cos(-Math.PI/2+i*Math.PI/2)*r,170+Math.sin(-Math.PI/2+i*Math.PI/2)*r]
  return localize(<section className="account-report">
    <header className="history-header"><h2>灵性探索报告</h2><button className="ghost-btn" onClick={onBack}>返回</button></header>
    <p className="flow-note">根据本账号记录生成，图表展示测验表现与体验频率，不计算总灵性分。</p>
    <button className="primary-btn" disabled={busy} onClick={download}>{busy?'正在生成 PDF…':'导出 PDF 报告'}</button>
    {error && <p role="alert">{error}</p>}
    <div className="report-insights">
      <article><h3>{analysis.profile.label}</h3><p>{analysis.profile.description}</p><p className="flow-note">{analysis.profile.evidence}</p></article>
      <article><h3>近期观察与搭档分析</h3><p>{analysis.trends.find(tr=>tr.key==='dses'&&tr.direction!=='insufficient')?.text || analysis.trends.find(tr=>tr.direction!=='insufficient')?.text || '继续累积同组记录，以观察持续变化。'}</p><p>{analysis.partner.text}</p></article>
    </div>
    <div className="report-grid">
      <article><h3>各维度雷达图</h3><svg viewBox="0 0 340 340" role="img" aria-label="各维度雷达图">
        {[1,2,3,4,5].map(level=><polygon key={level} points={[0,1,2,3].map(i=>pos(i,level*20).join(',')).join(' ')} className="chart-grid"/>)}
        {m.dimensions.every(d=>d.value!==null)&&<polygon points={m.dimensions.map((d,i)=>pos(i,d.value).join(',')).join(' ')} className="chart-area"/>}
        {m.dimensions.map((d,i)=>{const p=pos(i,d.value??0),l=pos(i,132);return <g key={d.key}>{d.value!==null&&<circle cx={p[0]} cy={p[1]} r="4" className="chart-point"/>}<text x={l[0]} y={l[1]} textAnchor="middle">{d.label}</text></g>})}
      </svg><ul>{m.dimensions.map(d=><li key={d.key}>{d.label}: {d.value==null?'暂无数据':`${d.value.toFixed(1)} / 100 (n=${d.n})`}</li>)}</ul><p className="flow-note">DSES 以完整问卷均值换算为 0–100；实验轴为命中率或一致率。缺失项不补零。</p></article>
      <article><h3>心灵感应关系图</h3><svg viewBox="0 0 440 380" role="img" aria-label="心灵感应关系图">
        {peers.map((p,i)=>{const a=-Math.PI/2+i*Math.PI*2/peers.length,x=220+Math.cos(a)*140,y=180+Math.sin(a)*125;return <g key={p.key}><line x1="220" y1="180" x2={x} y2={y} className="chart-edge" strokeWidth={Math.min(5,1+Math.sqrt(p.n)/5)}/><circle cx={x} cy={y} r="17" className="chart-node"/><text x={x} y={y+31} textAnchor="middle">{p.label.slice(0,18)}</text><text x={x} y={y+47} textAnchor="middle">{p.n?`${(100*p.correct/p.n).toFixed(1)}% · n=${p.n}`:'暂无数据'}</text></g>})}
        <circle cx="220" cy="180" r="26" className="chart-point"/><text x="220" y="222" textAnchor="middle">{account.username}</text>
      </svg>{!peers.length&&<p>尚无双人实验记录</p>}{m.peers.length>8&&<div className="account-actions"><button disabled={!networkPage} onClick={()=>setNetworkPage(p=>p-1)}>上一页</button><button disabled={(networkPage+1)*8>=m.peers.length} onClick={()=>setNetworkPage(p=>p+1)}>下一页</button></div>}<p className="flow-note">仅展示本人的配对；游客身份不跨场关联。连线表示共同实验，并不表示超自然连接。</p></article>
    </div>
    <h3>各维度趋势</h3>
    {!m.series.length&&<p>完成测验或完整问卷后生成趋势图。</p>}
    {m.series.map(series=>{const times=series.points.map(p=>p.time),min=Math.min(...times),max=Math.max(...times);const pts=series.points.map(p=>[55+(max===min?240:(p.time-min)/(max-min)*480),120-p.value]);return <article className="trend-card" key={series.label}><h4>{series.label}</h4><svg viewBox="0 0 590 155" role="img" aria-label={series.label}>{[0,50,100].map(value=><g key={value}><line x1="55" y1={120-value} x2="535" y2={120-value} className="chart-grid"/><text x="15" y={124-value}>{value}</text></g>)}<polyline points={pts.map(p=>p.join(',')).join(' ')} className="chart-line"/>{pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="3" className="chart-point"/>)}<text x="55" y="145">{new Date(min).toLocaleDateString(language==='en'?'en-GB':'zh-CN')}</text><text x="535" y="145" textAnchor="end">{new Date(max).toLocaleDateString(language==='en'?'en-GB':'zh-CN')}</text></svg></article>})}
  </section>)
}
