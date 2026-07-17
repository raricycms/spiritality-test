/**
 * useSpiritualityProbability — compute the three views from history.
 */

import { useMemo } from 'react'
import { aggregateRounds } from '../lib/statistics.js'
import {
  spiritualityProbPointNull,
  spiritualityProbOneSided,
  posteriorCredibleInterval,
  posteriorMean,
} from '../lib/statistics.js'

export function useSpiritualityProbability(history, settings) {
  return useMemo(() => {
    // Aggregate across all sessions; ABANDONED/in-progress not counted.
    let k = 0,
      n = 0
    for (const s of history) {
      // For COMPLETED sessions, count only REVEALED rounds.
      // Skip IN_PROGRESS sessions partially (still counts their REVEALED rounds).
      const a = aggregateRounds(s.rounds)
      k += a.k
      n += a.n
    }
    if (n === 0) {
      return {
        k,
        n,
        probPointNull: null,
        probOneSided: null,
        credible: null,
        posteriorMean: null,
        pHat: null,
      }
    }
    const prior = {
      alpha: settings.priorAlpha,
      beta: settings.priorBeta,
    }
    return {
      k,
      n,
      pHat: k / n,
      probPointNull: spiritualityProbPointNull(k, n, { prior }),
      probOneSided: spiritualityProbOneSided(
        k,
        n,
        settings.oneSidedThreshold,
        prior,
      ),
      credible: posteriorCredibleInterval(k, n, settings.credibleLevel, prior),
      posteriorMean: posteriorMean(k, n, prior),
    }
  }, [history, settings])
}
