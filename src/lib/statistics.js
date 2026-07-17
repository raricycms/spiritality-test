/**
 * Bayesian stats for the "spirituality is effective" probability.
 *
 * Default metric: Savage-Dickey density ratio.
 *
 *   BF_01 = f(p_0 | data) / f(p_0)
 *
 * With uniform Beta(1, 1) prior, f(p_0=0.20) = 1, so BF_01 = f(p_0 | data).
 *
 *   P(spirituality effective) = 1 / (1 + BF_01)
 *
 * Optional metrics exposed:
 * - spiritualityProbOneSided — P(p > threshold | data)
 * - posteriorCredibleInterval — symmetric credible interval
 * - posteriorMean
 *
 * All inputs/outputs are pure numbers. No I/O.
 */

import { logBetaPdf, betainc, betaincinv } from './betainc.js'

/** @typedef {{alpha:number, beta:number}} Prior */

/** Default prior: uniform Beta(1, 1). */
export const DEFAULT_PRIOR = Object.freeze({ alpha: 1, beta: 1 })

/** Default null value: the baseline random-guessing rate of 1/5. */
export const DEFAULT_NULL_VALUE = 0.20

const NUMERICAL_FLOOR = -745 // log underflow threshold for double precision

/**
 * Compute spiritualityEffectiveProb via Savage-Dickey density ratio.
 *
 * Returns null when n = 0 (no data). Otherwise returns a number in [0, 1].
 *
 * @param {number} k - correct count
 * @param {number} n - total revealed count
 * @param {{prior?: Prior, nullValue?: number}} [opts]
 * @returns {number | null}
 */
export function spiritualityProbPointNull(k, n, opts) {
  if (n <= 0) return null
  const prior = (opts && opts.prior) || DEFAULT_PRIOR
  const nullValue = (opts && opts.nullValue) ?? DEFAULT_NULL_VALUE

  const logPrior = logBetaPdf(nullValue, prior.alpha, prior.beta)
  const logPost = logBetaPdf(nullValue, prior.alpha + k, prior.beta + (n - k))
  let logBF01 = logPost - logPrior

  // Clamp logBF01 to avoid sigmoid producing 1 (which isn't wrong, but
  // numerical noise). For values heavily below the floor, return exactly 1.
  if (logBF01 < NUMERICAL_FLOOR) return 1
  if (logBF01 > 745) return 0
  return 1 / (1 + Math.exp(logBF01))
}

/**
 * One-sided posterior upper-tail: P(p > threshold | data).
 *
 * Returns null when n = 0.
 *
 * @param {number} k
 * @param {number} n
 * @param {number} [threshold=0.20]
 * @param {Prior} [prior]
 * @returns {number | null}
 */
export function spiritualityProbOneSided(k, n, threshold = 0.20, prior = DEFAULT_PRIOR) {
  if (n <= 0) return null
  const a = prior.alpha + k
  const b = prior.beta + (n - k)
  return 1 - betainc(threshold, a, b)
}

/**
 * Symmetric credible interval.
 *
 * @param {number} k
 * @param {number} n
 * @param {number} [level=0.95]
 * @param {Prior} [prior]
 * @returns {{low:number, high:number} | null}
 */
export function posteriorCredibleInterval(k, n, level = 0.95, prior = DEFAULT_PRIOR) {
  if (n <= 0) return null
  const a = prior.alpha + k
  const b = prior.beta + (n - k)
  const tail = (1 - level) / 2
  return {
    low: betaincinv(tail, a, b),
    high: betaincinv(1 - tail, a, b),
  }
}

/** Posterior mean of Beta(α₀+k, β₀+n-k). */
export function posteriorMean(k, n, prior = DEFAULT_PRIOR) {
  return (prior.alpha + k) / (prior.alpha + prior.beta + n)
}

/** Count correct & total from a list of rounds (REVEALED only). */
export function aggregateRounds(rounds) {
  let k = 0
  let n = 0
  for (const r of rounds) {
    if (r.status !== 'REVEALED') continue
    n++
    if (r.correct === true) k++
  }
  return { k, n }
}

/** Default AppSettings. */
export const DEFAULT_APP_SETTINGS = Object.freeze({
  theme: 'auto',
  roundsPerSession: 30,
  exposureTimeMs: 800,
  priorAlpha: 1,
  priorBeta: 1,
  view: 'pointNull',
  oneSidedThreshold: 0.20,
  credibleLevel: 0.95,
})

/** Default SessionSettings. */
export const DEFAULT_SESSION_SETTINGS = Object.freeze({
  roundsPerSession: 30,
  exposureTimeMs: 800,
})
