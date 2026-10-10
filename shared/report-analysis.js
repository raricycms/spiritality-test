import { profileCopy, dimensionNarrative, trendNarrative, partnerNarrative, synthesisNarrative, nekoCopy } from './report-copy.js'

/** Transparent descriptive rules. These are exploration profiles, not validated ability cutoffs. */
export const ANALYSIS_RULES = Object.freeze({ dimensionRounds: 20, partnerRounds: 10, trendSessions: 3, trendRoundsPerWindow: 10, experimentChangePoints: 5, dsesChangePoints: 5 })

export function analyzeReport(model, language = 'zh') {
  const en=language==='en', t=(zh,english)=>en?english:zh
  const totalRounds=model.groups.reduce((sum,g)=>sum+g.n,0)
  const covered=model.dimensions.slice(0,3).filter(d=>d.n>=ANALYSIS_RULES.dimensionRounds).length
  const byType=Object.fromEntries(['hidden','precognition','telepathy'].map(type=>[type,model.groups.filter(g=>g.type===type).reduce((sum,g)=>sum+g.n,0)]))
  const dominant=Object.entries(byType).sort((a,b)=>b[1]-a[1])[0]
  let profile
  if(covered===3 && model.completeQuestionnaireCount) profile={label:t('多维探索型','Multi-dimensional explorer'),description:''}
  else if(totalRounds<20 && model.completeQuestionnaireCount<3) profile={label:t('初步探索型','Early explorer'),description:''}
  else if(byType.telepathy>=20 && byType.telepathy/Math.max(1,totalRounds)>=.5) profile={label:t('双人协作型','Pair-focused explorer'),description:''}
  else if(model.completeQuestionnaireCount>=3 && totalRounds<60) profile={label:t('体验记录型','Experience journaler'),description:''}
  else if(dominant[1]>=20 && dominant[1]/Math.max(1,totalRounds)>=.7) profile={label:t('单项深耕型','Focused explorer'),description:''}
  else profile={label:t('渐进探索型','Steady explorer'),description:''}
  const profileKeys={'多维探索型':'multi','Multi-dimensional explorer':'multi','初步探索型':'early','Early explorer':'early','双人协作型':'pair','Pair-focused explorer':'pair','体验记录型':'journal','Experience journaler':'journal','单项深耕型':'focused','Focused explorer':'focused','渐进探索型':'steady','Steady explorer':'steady'}
  profile.key=profileKeys[profile.label]
  profile.description=profileCopy(profile.key,en)
  profile.evidence=t(`${totalRounds} 个有效回合，${covered}/3 个实验维度达到 20 回合，${model.completeQuestionnaireCount} 份完整 DSES。`,`${totalRounds} valid rounds; ${covered}/3 experiment dimensions have at least 20 rounds; ${model.completeQuestionnaireCount} complete DSES questionnaires.`)

  const dimensions=model.dimensions.map(d=>{
    const base={key:d.key,label:d.label}
    if(d.value===null)return {...base,status:'missing',verdict:t('等待开启','Ready to begin'),text:nekoCopy('dimension_missing',en)}
    if(d.key!=='dses' && d.n<ANALYSIS_RULES.dimensionRounds)return {...base,status:'limited',verdict:t('刚刚起步','A first chapter'),text:nekoCopy('dimension_limited',en)}
    const tier=d.key==='dses'?(d.mean>=4?'above':d.mean>=2.5?'near':'below'):d.key==='telepathy'?(d.value>=50?'above':'below'):(d.value-20>5?'above':d.value-20< -5?'below':'near')
    return {...base,status:'observed',tier,...dimensionNarrative(d.key,tier,en)}
  })

  const trends=model.dimensions.map(d=>{
    const series=d.key==='dses'?model.series.find(s=>s.label===d.label):model.groups.find(g=>g.key===d.group)
    const points=series?.points || [],span=Math.min(3,Math.floor(points.length/2))
    const insufficient=()=>({key:d.key,label:d.label,direction:'insufficient',text:nekoCopy('trend_insufficient',en)})
    if(points.length<ANALYSIS_RULES.trendSessions || !span)return insufficient()
    const first=points.slice(0,span),last=points.slice(-span)
    const earlyN=first.reduce((sum,p)=>sum+p.n,0),lateN=last.reduce((sum,p)=>sum+p.n,0)
    if(d.key!=='dses' && Math.min(earlyN,lateN)<ANALYSIS_RULES.trendRoundsPerWindow)return insufficient()
    const avg=arr=>d.key==='dses'?arr.reduce((sum,p)=>sum+p.value,0)/arr.length:arr.reduce((sum,p)=>sum+p.correct,0)/arr.reduce((sum,p)=>sum+p.n,0)*100
    const early=avg(first),late=avg(last),delta=late-early,direction=delta>5?'up':delta< -5?'down':'stable'
    return {key:d.key,label:d.label,direction,early,late,delta,span,text:trendNarrative(d,direction,en),detail:t(`比较最早与最近各 ${span} 份记录：较早 ${early.toFixed(1)}，近期 ${late.toFixed(1)}，展示值差 ${delta>=0?'+':''}${delta.toFixed(1)}。`,`Comparing the first and latest ${span} records: earlier ${early.toFixed(1)}, recent ${late.toFixed(1)}, display difference ${delta>=0?'+':''}${delta.toFixed(1)}.`)}
  })
  const pairGroup=model.dimensions.find(d=>d.key==='telepathy').group
  const candidates=model.peers.filter(p=>p.key.startsWith('account:') && (p.groups[pairGroup]?.n || 0)>=10).map(p=>({...p,...p.groups[pairGroup]})).sort((a,b)=>b.correct/b.n-a.correct/a.n || b.n-a.n)
  const best=candidates[0],leaders=best?candidates.filter(p=>Math.abs(p.correct/p.n-best.correct/best.n)<1e-9):[]
  const names=leaders.slice(0,3).map(p=>p.label).join(en?', ':'、')+(leaders.length>3?t(` 等 ${leaders.length} 位`, ` and ${leaders.length-3} others`):'')
  const samples=leaders.slice(0,3).map(p=>`${p.label} ${p.correct}/${p.n}`).join(en?'; ':'；')
  const partner={leaders,group:pairGroup,text:partnerNarrative(names,leaders.length,candidates.length,en),detail:best?t(`搭档比较依据：${samples}；当前最高一致率 ${(best.correct/best.n*100).toFixed(1)}%，${candidates.length} 位搭档符合条件。`,`Partner comparison: ${samples}; leading agreement ${(best.correct/best.n*100).toFixed(1)}%; ${candidates.length} eligible partners.`):t('暂无达到同组 10 回合的登录搭档。','No signed-in partner has 10 comparable rounds yet.')}

  const guidance=[]
  if(covered<3)guidance.push(nekoCopy('guidance_explore',en))
  if(!model.completeQuestionnaireCount)guidance.push(nekoCopy('guidance_dses',en))
  if(byType.telepathy)guidance.push(nekoCopy('guidance_partner',en))
  guidance.push(nekoCopy('guidance_rhythm',en))
  return {profile,dimensions,trends,partner,synthesis:{text:synthesisNarrative(trends,en)},guidance,totalRounds,covered}
}
