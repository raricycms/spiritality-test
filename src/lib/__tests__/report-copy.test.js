import { it, expect } from 'vitest'
import { NEKO_COPY_KEYS, nekoCopy, profileCopy, dimensionNarrative, trendNarrative, partnerNarrative, synthesisNarrative } from '../../../shared/report-copy.js'
import { buildReportModel, REPORT_LABELS } from '../../../shared/report-model.js'
import { analyzeReport } from '../../../shared/report-analysis.js'

const paragraphLengths = text => text.split(/\n\s*\n/).map(p => [...p.replace(/\s/g, '')].length)
const withinRange = text => {
  for (const [index, length] of paragraphLengths(text).entries()) {
    expect(length, `paragraph ${index + 1} (${length}): ${text}`).toBeGreaterThanOrEqual(30)
    expect(length, `paragraph ${index + 1} (${length}): ${text}`).toBeLessThanOrEqual(70)
  }
}
const keys = ['hidden', 'precognition', 'telepathy', 'dses']
const tiers = { hidden: ['above', 'near', 'below'], precognition: ['above', 'near', 'below'], telepathy: ['above', 'below'], dses: ['above', 'near', 'below'] }
const directions = ['up', 'stable', 'down', 'insufficient']

it('keeps all Neko notes and every profile in short Chinese paragraphs', () => {
  for (const key of NEKO_COPY_KEYS) withinRange(nekoCopy(key))
  for (const key of ['multi', 'early', 'pair', 'journal', 'focused', 'steady']) {
    withinRange(profileCopy(key))
    expect(profileCopy(key).split('\n\n')).toHaveLength(3)
  }
  expect(paragraphLengths(nekoCopy('welcome'))[0]).toBeGreaterThanOrEqual(40)
  expect(paragraphLengths(nekoCopy('welcome'))[0]).toBeLessThanOrEqual(60)
})

it('keeps every dimension, tier and available trend within the paragraph limit', () => {
  for (const key of keys) {
    for (const tier of tiers[key]) withinRange(dimensionNarrative(key, tier).text)
    for (const direction of directions.slice(0, 3)) withinRange(trendNarrative({ key, label: REPORT_LABELS.zh[key] }, direction))
  }
})

it('does not let arbitrary partner names or leader counts lengthen prose', () => {
  for (const name of ['Bob', '月', '很长的昵称'.repeat(100), 'A'.repeat(500)]) {
    for (const [leaders, candidates] of [[0, 0], [1, 1], [1, 10], [2, 2], [100, 100]]) {
      withinRange(partnerNarrative(name, leaders, candidates))
      expect(partnerNarrative(name, leaders, candidates)).not.toContain(name)
    }
  }
})

it('keeps all 256 combinations of four-direction synthesis within the limit', () => {
  for (let i = 0; i < 256; i++) {
    const trends = keys.map((key, j) => ({ key, label: REPORT_LABELS.zh[key], direction: directions[Math.floor(i / (4 ** j)) % 4] }))
    const text = synthesisNarrative(trends)
    withinRange(text)
    for (const trend of trends.filter(t => ['up', 'down'].includes(t.direction))) expect(text).toContain(trend.label)
  }
})

it('keeps missing, limited and guidance branches short in the integrated analysis', () => {
  for (const experiments of [[], [{ id: 'short', experimentType: 'telepathy', protocolVersion: 3, status: 'COMPLETED', createdAt: 1, settings: { candidateSet: 'digits' }, rounds: [{ status: 'REVEALED', target: 1, guess: 1 }] }]]) {
    const a = analyzeReport(buildReportModel({ experiments }, { username: 'Me' }))
    for (const text of [a.profile.description, ...a.dimensions.map(d => d.text), ...a.trends.map(t => t.text), a.partner.text, a.synthesis.text, ...a.guidance]) withinRange(text)
  }
})

it('keeps English counterparts aligned, human-readable and free of banned stock phrasing', () => {
  const pairs = NEKO_COPY_KEYS.map(key => [nekoCopy(key), nekoCopy(key, true)])
  pairs.push(...['multi', 'early', 'pair', 'journal', 'focused', 'steady'].map(key => [profileCopy(key), profileCopy(key, true)]))
  for (const key of keys) {
    for (const tier of tiers[key]) pairs.push([dimensionNarrative(key, tier).text, dimensionNarrative(key, tier, true).text])
    for (const direction of directions.slice(0, 3)) pairs.push([trendNarrative({ key }, direction), trendNarrative({ key }, direction, true)])
  }
  for (const [zh, en] of pairs) {
    expect(en.split('\n\n')).toHaveLength(zh.split('\n\n').length)
    expect(en).not.toMatch(/[\u3400-\u9fff]|—|\b(?:delve|tapestry|testament|pivotal|leverage|seamless|holistic|myriad|synergy)\b/i)
    expect(en).not.toMatch(/not only|not just|it's not .*it's|in conclusion|it's worth noting/i)
  }
})
