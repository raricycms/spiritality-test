import { profileCopy, dimensionNarrative, trendNarrative, partnerNarrative, synthesisNarrative } from './report-copy.js'

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
    if(d.value===null)return {...base,status:'missing',verdict:t('等待开启','Ready to begin'),text:t(`你的${d.label}还留着一块空白，可以把它当作下一次探索的新入口。完成这个方向后，报告会为你添上相应的图形和解读。无需先准备一套特别的方法，按页面流程走一遍就好。第一份记录的意义，是给未来的变化留下起点；之后每次回来，你都能把新的尝试放在它旁边读。`,`Your ${d.label.toLowerCase()} is still an open space, ready to become a new direction. Complete the task to add its chart and commentary. Begin with the ordinary page instructions. The first record gives later changes a starting point, and each return adds a chapter you can read beside it.`)}
    if(d.key!=='dses' && d.n<ANALYSIS_RULES.dimensionRounds)return {...base,status:'limited',verdict:t('刚刚起步','A first chapter'),text:t(`你已经为${d.label}留下了第一批片段，这个方向正在从空白变成一段可以回访的经历。眼下最适合做的是保留相同设置，再完整试几次，看看自己的选择会怎样延续。你可以回想哪几轮决定得很快，哪几轮犹豫了更久。等这些片段多一些，报告就会给出更具体的表现分类与变化解读。`,`Your ${d.label.toLowerCase()} has its first observations and a chapter you can return to. Keep the same settings and complete a few more sessions. Notice which decisions arrive quickly and which take longer. As these moments accumulate, the report can offer a more specific description and trace changes over time.`)}
    const tier=d.key==='dses'?(d.mean>=4?'above':d.mean>=2.5?'near':'below'):d.key==='telepathy'?(d.value>=50?'above':'below'):(d.value-20>5?'above':d.value-20< -5?'below':'near')
    return {...base,status:'observed',tier,...dimensionNarrative(d.key,tier,en)}
  })

  const trends=model.dimensions.map(d=>{
    const series=d.key==='dses'?model.series.find(s=>s.label===d.label):model.groups.find(g=>g.key===d.group)
    const points=series?.points || [],span=Math.min(3,Math.floor(points.length/2))
    const insufficient=()=>({key:d.key,label:d.label,direction:'insufficient',text:t(`你的${d.label}时间线还在铺开。现在可以先记住每次测试或填写时的节奏，接着保留相同设置再回来几次。等前后的记录连接起来，就会看见这一方向如何变化。此刻不必急着寻找上升或回落，给这段探索留一点自然生长的空间。`,`Your ${d.label.toLowerCase()} timeline is still taking shape. Keep a familiar approach and return a few more times. Connected observations will make its changes easier to follow. For now, give this direction room to develop rather than looking for an immediate rise or fall.`)})
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
  if(covered<3)guidance.push(t('给尚未展开的方向留一次尝试。可以从最感兴趣的项目开始，完整走完流程，再决定要不要回访。不同的玩法会给画像带来不同角度，不必一天全部完成，按你舒服的节奏逐步补上即可。','Give an unexplored direction one complete visit. Begin with the task that interests you most, finish its process, and decide whether to return. Each task adds another angle; fill the map at a comfortable pace.'))
  if(!model.completeQuestionnaireCount)guidance.push(t('为生活体验留一页记录。完整填写一次 DSES 时，按最近一段时间的整体感受来回答，让它成为这条时间线的起点。以后再回来，前后的问卷就会给日常体验添上一段可以回顾的历史。','Give everyday experience a page of its own. Complete DSES using your experience of the recent period as a whole. This becomes the starting point for a timeline you can return to later.'))
  if(byType.telepathy)guidance.push(t('再约一次共同探索。选一位想继续测的搭档，保留熟悉的符号，各自独立完成选择，等揭晓之后再聊想法。也可以让彼此轮换发送者与接收者，给同一种组合留下两个视角。','Arrange another shared exploration. Return with a partner and familiar symbols, make choices independently, and discuss them after the reveal. You can also swap sender and receiver roles to add another view of the same pairing.'))
  guidance.push(t('给下一场一个简单、完整的节奏。先决定采用的设置和回合数，做完后再统一回看，不必只留下最满意的一次。如果你想换一种做法，一次调整一件事就好；这样以后翻回报告，会更容易把每段记录接在一起读。','Give the next session a simple, complete rhythm. Decide on settings and length first, then review afterward. Keep the less satisfying sessions too. If you want a new approach, adjust one thing at a time so future chapters are easier to read together.'))
  return {profile,dimensions,trends,partner,synthesis:{text:synthesisNarrative(trends,en)},guidance,totalRounds,covered}
}
