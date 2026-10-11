/**
 * v2 experiment statistics (protocol 2).
 *
 * This module is additive: it does not touch the legacy v1 helpers in
 * `./statistics.js`. It reuses the pure Beta-distribution primitives from
 * that module (P(p > threshold | data) and the credible interval) so there is
 * a single numerical implementation.
 *
 * Only REVEALED rounds count. ABANDONED / SENDING / TARGET_READY / GUESSING /
 * LOCKED rounds are never treated as wrong answers — they are simply excluded.
 *
 * Terminology note (see docs/09-implementation-contract.md):
 *   `probAboveChance` is a *parameter* posterior tail probability,
 *   P(p > baseline | data). It is NOT the probability that a supernatural
 *   capability exists, and must not be described as such in the UI.
 */

import {
  DEFAULT_PRIOR,
  posteriorCredibleInterval,
  spiritualityProbOneSided,
} from './statistics.js'
import { getCandidateSet } from '../../shared/candidate-sets.js'

/** Default five-choice chance baseline. */
export const DEFAULT_CHANCE_BASELINE = 0.2

/** Credible-interval level used by summaries. */
export const CREDIBLE_LEVEL = 0.95

/** Session statuses that expose terminal (revealed) condition data. */
export const TERMINAL_STATUSES = Object.freeze(['COMPLETED', 'ABANDONED'])

const TERMINAL_SET = new Set(TERMINAL_STATUSES)
const REVEALED = 'REVEALED'

/** True when a session is in a terminal (COMPLETED / ABANDONED) state. */
export function isTerminalSession(session) {
  return !!session && TERMINAL_SET.has(session.status)
}

/** True for protocol-2 snapshots (legacy v1 sessions are never mixed in). */
export function isProtocol2Session(session) {
  return !!session && session.protocolVersion === 2
}

export function isSupportedSession(session) {
  return isProtocol2Session(session) || (session?.protocolVersion === 3 && session.experimentType === 'telepathy')
}

/** Coerce an untrusted prior into a valid Beta(alpha, beta) or the default. */
function normalizePrior(prior) {
  if (
    !prior ||
    !Number.isFinite(prior.alpha) ||
    !Number.isFinite(prior.beta) ||
    prior.alpha <= 0 ||
    prior.beta <= 0
  ) {
    return DEFAULT_PRIOR
  }
  return { alpha: prior.alpha, beta: prior.beta }
}

/** Resolve a valid chanceBaseline; current protocols default to 0.2. */
export function resolveBaseline(session) {
  if (session?.protocolVersion === 3 && session.experimentType === 'telepathy') return null
  const b = session && session.chanceBaseline
  if (Number.isFinite(b) && b > 0 && b < 1) return b
  return DEFAULT_CHANCE_BASELINE
}

/** Count correct / revealed rounds (excludes every non-REVEALED status). */
function countRevealed(rounds) {
  let k = 0
  let n = 0
  if (Array.isArray(rounds)) {
    for (const r of rounds) {
      if (!r || r.status !== REVEALED) continue
      n++
      if (r.correct === true) k++
    }
  }
  return { k, n }
}

/**
 * Base summary object for a (k, n) count pair.
 * Every rate/probability/interval is `null` when n = 0.
 */
function statsFromCounts(k, n, baseline, prior) {
  const hasData = n > 0
  const accuracy = hasData ? k / n : null
  return {
    k,
    n,
    accuracy,
    baseline,
    excess: hasData && baseline != null ? accuracy - baseline : null,
    probAboveChance: baseline == null ? null : spiritualityProbOneSided(k, n, baseline, prior),
    credible: posteriorCredibleInterval(k, n, CREDIBLE_LEVEL, prior),
  }
}

/**
 * Sending / control split for a terminal telepathy session.
 * `difference` is the observed accuracy difference (sending - control) and is
 * null unless BOTH arms have at least one revealed round. No difference
 * interval is produced (no sound method implemented here).
 */
function summarizeConditions(session, baseline, prior) {
  const rounds = Array.isArray(session.rounds) ? session.rounds : []
  const sendingCounts = countRevealed(rounds.filter((r) => r && r.condition === 'sending'))
  const controlCounts = countRevealed(rounds.filter((r) => r && r.condition === 'control'))
  const sending = statsFromCounts(sendingCounts.k, sendingCounts.n, baseline, prior)
  const control = statsFromCounts(controlCounts.k, controlCounts.n, baseline, prior)
  const difference =
    sendingCounts.n > 0 && controlCounts.n > 0 ? sending.accuracy - control.accuracy : null
  return { sending, control, difference }
}

/**
 * Summarize a single v2 session.
 *
 * @param {object|null} session protocol-2 snapshot (or legacy session; treated generically)
 * @param {{alpha:number,beta:number}} [prior]
 * @returns {{
 *   k:number, n:number, accuracy:number|null, baseline:number,
 *   excess:number|null, probAboveChance:number|null,
 *   credible:{low:number,high:number}|null,
 *   conditions?:{sending:object,control:object,difference:number|null}
 * }}
 */
export function summarizeExperiment(session, prior = DEFAULT_PRIOR) {
  const p = normalizePrior(prior)
  const baseline = resolveBaseline(session)
  const { k, n } = countRevealed(session && session.rounds)
  const summary = statsFromCounts(k, n, baseline, p)

  if (session && session.experimentType === 'telepathy' && session.protocolVersion !== 3 && isTerminalSession(session)) {
    summary.conditions = summarizeConditions(session, baseline, p)
  }
  return summary
}

/** Prefer the richer of two same-id snapshots: longer > terminal > newer. */
function preferredSession(a, b) {
  const aRounds = Array.isArray(a.rounds) ? a.rounds.length : 0
  const bRounds = Array.isArray(b.rounds) ? b.rounds.length : 0
  if (aRounds !== bRounds) return aRounds > bRounds ? a : b

  const aTerminal = isTerminalSession(a) ? 1 : 0
  const bTerminal = isTerminalSession(b) ? 1 : 0
  if (aTerminal !== bTerminal) return aTerminal > bTerminal ? a : b

  const aTime = a.completedAt ?? a.createdAt ?? 0
  const bTime = b.completedAt ?? b.createdAt ?? 0
  if (aTime !== bTime) return aTime > bTime ? a : b
  return a
}

/**
 * Deduplicate sessions by id without discarding newer/longer data.
 * Entries without a usable id are dropped.
 */
export function dedupeSessions(sessions) {
  const map = new Map()
  for (const s of sessions || []) {
    if (!s || typeof s.id !== 'string' || s.id.length === 0) continue
    const prev = map.get(s.id)
    map.set(s.id, prev ? preferredSession(prev, s) : s)
  }
  return [...map.values()]
}

function latestTime(sessions) {
  let t = 0
  for (const s of sessions) {
    const v = s.completedAt ?? s.createdAt ?? 0
    if (v > t) t = v
  }
  return t
}

/**
 * Group v2 sessions for the history UI.
 *
 * Result shape (documented for parent review):
 *
 * ```
 * [{
 *   key: string,                 // `${experimentType}|v2|${baseline}` (stable)
 *   experimentType: string,
 *   protocolVersion: 2,
 *   baseline: number,
 *   count: number,               // deduped session count in this group
 *   sessions: Session[],         // deduped, newest-first
 *   summary: {                   // aggregated over all sessions in the group
 *     k, n, accuracy, baseline, excess, probAboveChance, credible,
 *     conditions? // telepathy groups only: { sending, control, difference }
 *   }
 * }]
 * ```
 *
 * Legacy v1 sessions are intentionally excluded — they are surfaced through
 * `loadLegacyHistory()` as a separate, non-aggregated section.
 */
export function groupExperimentHistory(sessions, prior = DEFAULT_PRIOR) {
  const p = normalizePrior(prior)
  const v2 = dedupeSessions((sessions || []).filter(isSupportedSession))

  const groupsByKey = new Map()
  for (const s of v2) {
    const experimentType = typeof s.experimentType === 'string' ? s.experimentType : 'unknown'
    const baseline = resolveBaseline(s)
    const candidateSet = getCandidateSet(s.settings?.candidateSet).id
    const key = `${experimentType}|v${s.protocolVersion}|${baseline}${candidateSet === 'digits' ? '' : `|${candidateSet}`}`
    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, { key, experimentType, protocolVersion: s.protocolVersion, baseline, candidateSet, sessions: [] })
    }
    groupsByKey.get(key).sessions.push(s)
  }

  const groups = []
  for (const group of groupsByKey.values()) {
    group.sessions.sort(
      (a, b) => (b.completedAt ?? b.createdAt ?? 0) - (a.completedAt ?? a.createdAt ?? 0),
    )

    let k = 0
    let n = 0
    for (const s of group.sessions) {
      const c = countRevealed(s.rounds)
      k += c.k
      n += c.n
    }
    const summary = statsFromCounts(k, n, group.baseline, p)

    if (group.experimentType === 'telepathy' && group.protocolVersion !== 3) {
      let sk = 0
      let sn = 0
      let ck = 0
      let cn = 0
      for (const s of group.sessions) {
        if (!isTerminalSession(s)) continue
        const rounds = Array.isArray(s.rounds) ? s.rounds : []
        const sc = countRevealed(rounds.filter((r) => r && r.condition === 'sending'))
        const cc = countRevealed(rounds.filter((r) => r && r.condition === 'control'))
        sk += sc.k
        sn += sc.n
        ck += cc.k
        cn += cc.n
      }
      const sending = statsFromCounts(sk, sn, group.baseline, p)
      const control = statsFromCounts(ck, cn, group.baseline, p)
      summary.conditions = {
        sending,
        control,
        difference: sn > 0 && cn > 0 ? sending.accuracy - control.accuracy : null,
      }
    }

    groups.push({ ...group, count: group.sessions.length, summary })
  }

  groups.sort((a, b) => latestTime(b.sessions) - latestTime(a.sessions))
  return groups
}
