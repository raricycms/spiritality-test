import { computeDsesScore } from '../src/lib/dses.js'
import { getCandidateSet } from './candidate-sets.js'
export const candidateSetName = (id, language='zh') => language==='en' ? ({digits:'Numbers',letters:'Letters',cosmos:'Celestial icons',colors:'Colors',faces:'Faces',directions:'Directions'}[id] || 'Numbers') : getCandidateSet(id).label

export const REPORT_LABELS = {
  zh: { hidden: '隐藏信息感知', precognition: '未来事件预知', telepathy: '双人一致率', dses: '日常灵性体验', guest: '游客搭档' },
  en: { hidden: 'Hidden information', precognition: 'Precognition', telepathy: 'Pair agreement', dses: 'Daily spiritual experience', guest: 'Guest partner' },
}
const keyOf = s => `${s.experimentType}|v${s.protocolVersion}|${s.settings?.candidateSet || 'digits'}`
export function roundCounts(session) {
  const valid = (session.rounds || []).filter(r => r.status === 'REVEALED' && Number.isInteger(r.target) && Number.isInteger(r.guess))
  return { n: valid.length, correct: valid.filter(r => r.target === r.guess).length }
}
/** Observations, never population norms or a composite supernatural-ability score. */
export function buildReportModel({ experiments = [], dses = [] }, account, language = 'zh') {
  const labels = REPORT_LABELS[language] || REPORT_LABELS.zh
  const sessions = [...experiments].filter(s => ['COMPLETED', 'ABANDONED'].includes(s.status)).sort((a,b) => a.createdAt - b.createdAt)
  const groups = new Map()
  for (const s of sessions) {
    const key = keyOf(s), counts = roundCounts(s)
    const group = groups.get(key) || { key, type: s.experimentType, version: s.protocolVersion, candidateSet: s.settings?.candidateSet || 'digits', n: 0, correct: 0, sessions: 0, last: 0, points: [] }
    group.n += counts.n; group.correct += counts.correct; group.sessions += 1; group.last = s.createdAt
    if (counts.n) group.points.push({ time: s.completedAt ?? s.createdAt, value: counts.correct / counts.n * 100, n: counts.n, correct: counts.correct })
    groups.set(key, group)
  }
  for (const group of groups.values()) group.points.sort((a,b)=>a.time-b.time)
  const completeDses = [...dses].filter(r => computeDsesScore(r.answers).answered === 16).sort((a,b)=>a.createdAt-b.createdAt)
  const dimensions = ['hidden', 'precognition', 'telepathy'].map(type => {
    const latest = [...groups.values()].filter(g=>g.type===type && g.n).sort((a,b)=>b.last-a.last)[0]
    return { key: type, label: labels[type], value: latest ? latest.correct/latest.n*100 : null, n: latest?.n || 0, group: latest?.key || null }
  })
  const lastDses = completeDses.at(-1), mean = lastDses ? computeDsesScore(lastDses.answers).mean : null
  dimensions.push({ key: 'dses', label: labels.dses, value: mean == null ? null : (mean-1)/5*100, n: lastDses ? 16 : 0, mean })
  const peers = new Map()
  for (const s of sessions.filter(s=>s.experimentType==='telepathy')) {
    const partner = s.partner
    const key = partner?.sub ? `account:${partner.sub}` : `guest:${s.id}`
    const counts = roundCounts(s)
    const peer = peers.get(key) || { key, label: partner?.username || labels.guest, n: 0, correct: 0, sessions: 0, groups: {} }
    peer.n += counts.n; peer.correct += counts.correct; peer.sessions += 1; peers.set(key, peer)
    if (partner?.username) peer.label = partner.username
    const group = peer.groups[keyOf(s)] || { n: 0, correct: 0, sessions: 0 }
    group.n += counts.n; group.correct += counts.correct; group.sessions += 1; peer.groups[keyOf(s)] = group
  }
  const series = [...groups.values()].filter(g=>g.points.length).map(g=>({ label: `${labels[g.type]} / v${g.version} / ${candidateSetName(g.candidateSet,language)}`, points: g.points }))
  if (completeDses.length) series.push({ label: labels.dses, points: completeDses.map(r=>({time:r.createdAt,value:(computeDsesScore(r.answers).mean-1)/5*100,n:16})) })
  return { account, dimensions, groups: [...groups.values()], peers: [...peers.values()], series, sessionCount: sessions.length, questionnaireCount: dses.length, completeQuestionnaireCount: completeDses.length }
}
