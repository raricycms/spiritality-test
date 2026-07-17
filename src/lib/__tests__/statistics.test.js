import { describe, it, expect } from 'vitest'
import { betainc, betaincinv, logBetaPdf, logBeta } from '../betainc.js'
import {
  spiritualityProbPointNull,
  spiritualityProbOneSided,
  posteriorCredibleInterval,
  posteriorMean,
  aggregateRounds,
} from '../statistics.js'

describe('betainc / betaincinv — sanity against known values', () => {
  it('I_0.5(1,1) = 0.5', () => {
    expect(betainc(0.5, 1, 1)).toBeCloseTo(0.5, 10)
  })

  it('I_0.5(a, a) = 0.5 (symmetry)', () => {
    for (const a of [2, 5, 10, 25, 100]) {
      expect(betainc(0.5, a, a)).toBeCloseTo(0.5, 8)
    }
  })

  it('I_x(a, b) = 1 - I_{1-x}(b, a) (swap symmetry)', () => {
    for (const [x, a, b] of [
      [0.20, 21, 81],
      [0.40, 7, 4],
      [0.75, 12, 5],
      [0.10, 50, 12],
    ]) {
      expect(betainc(x, a, b)).toBeCloseTo(1 - betainc(1 - x, b, a), 10)
    }
  })

  it('betainc(0, a, b) = 0; betainc(1, a, b) = 1', () => {
    expect(betainc(0, 2, 3)).toBe(0)
    expect(betainc(1, 2, 3)).toBe(1)
  })

  it('betaincinv round-trips betainc', () => {
    const cases = [
      [0.05, 5, 7],
      [0.5, 3, 9],
      [0.7, 12, 4],
      [0.95, 2, 8],
      [0.025, 41, 111],
      [0.975, 41, 111],
      [0.46, 21, 81],
    ]
    for (const [p, a, b] of cases) {
      const x = betaincinv(p, a, b)
      const back = betainc(x, a, b)
      expect(back).toBeCloseTo(p, 6)
    }
  })

  it('handles large-parameter regimes without numerical blow-up', () => {
    // Beta(5e6, 5e6) is extremely narrow around 0.5; I_0.5 should be ~0.5
    const v = betainc(0.5, 5_000_000, 5_000_000)
    expect(v).toBeGreaterThan(0.49)
    expect(v).toBeLessThan(0.51)
    // Beta(21M, 79M) is sharp around 0.21; I_0.20 is left tail (underflows to ~0)
    const v2 = betainc(0.20, 21_000_001, 79_000_001)
    expect(v2).toBeGreaterThanOrEqual(0)
    expect(v2).toBeLessThan(0.5)
    // ... but I_0.21 covers most of the mass
    const v3 = betainc(0.21, 21_000_001, 79_000_001)
    expect(v3).toBeGreaterThan(0.5)
  })
})

describe('logBetaPdf', () => {
  it('matches manual calculation for Beta(2, 3) at x=0.40', () => {
    // B(2, 3) = Γ(2)Γ(3)/Γ(5) = 1·2/24 = 1/12  →  log B = -log 12
    // pdf = x^(α-1)(1-x)^(β-1) / B(α,β)
    // log pdf = (α-1) log x + (β-1) log(1-x) - log B(α,β)
    //        = 1·log(0.4) + 2·log(0.6) - log(1/12)
    //        = 1·log(0.4) + 2·log(0.6) + log(12)
    const expected =
      Math.log(0.4) + 2 * Math.log(0.6) + Math.log(12)
    const got = logBetaPdf(0.4, 2, 3)
    expect(got).toBeCloseTo(expected, 10)
  })

  it('returns -Infinity for x at edges', () => {
    expect(logBetaPdf(0, 2, 3)).toBe(-Infinity)
    expect(logBetaPdf(1, 2, 3)).toBe(-Infinity)
  })

  it('logBeta is symmetric', () => {
    expect(logBeta(3, 5)).toBeCloseTo(logBeta(5, 3), 12)
  })
})

describe('spiritualityProbPointNull — Savage-Dickey', () => {
  it('returns null when n = 0', () => {
    expect(spiritualityProbPointNull(0, 0)).toBe(null)
  })

  it('user counter-example (n=1e8, k=21e6) yields ~1', () => {
    const p = spiritualityProbPointNull(21_000_000, 100_000_000)
    expect(p).toBeGreaterThan(0.999)
    expect(p).toBeLessThanOrEqual(1)
  })

  it('all-correct (k=n) yields ~1', () => {
    expect(spiritualityProbPointNull(30, 30)).toBeGreaterThan(0.999)
  })

  it('all-wrong (k=0, n=30) yields high (posterior concentrated at 0)', () => {
    const p = spiritualityProbPointNull(0, 30)
    // Posterior Beta(1, 31) has density 0.0385 at 0.20 → BF_01=0.0385 → P≈0.962
    expect(p).toBeGreaterThan(0.90)
    expect(p).toBeLessThan(0.99)
  })

  it('inconclusive near-random (k=6, n=30) at exactly 20% → H₀ slight edge', () => {
    const p = spiritualityProbPointNull(6, 30)
    expect(p).toBeGreaterThan(0.05)
    expect(p).toBeLessThan(0.30)
  })

  it('n=100, k=21 (slight above 20%) → H₀ favoured because 21% is well within noise', () => {
    const p = spiritualityProbPointNull(21, 100)
    // Posterior Beta(22, 81) density at 0.20 ≈ peak·exp(-(z=0.79)²/2) ≈ 9.3 → BF_01≈9.3 → P≈0.10
    expect(p).toBeGreaterThan(0.05)
    expect(p).toBeLessThan(0.20)
  })

  it('n=150, k=40 (≈27%) → moderate evidence for H₁', () => {
    const p = spiritualityProbPointNull(40, 150)
    // Posterior mode at 0.267; 0.20 is ~2σ below; P ≈ 0.38
    expect(p).toBeGreaterThan(0.30)
    expect(p).toBeLessThan(0.50)
  })

  it('n=1000, k=210 (exactly 21% with large n) → still H₀ edge', () => {
    const p = spiritualityProbPointNull(210, 1000)
    // At n=1000, 21% is only 0.79σ from H_0 → strong H_0 preference
    expect(p).toBeLessThan(0.10)
    expect(p).toBeGreaterThan(0)
  })

  it('n=10, k=5 (50% with tiny n) → ambiguous', () => {
    const p = spiritualityProbPointNull(5, 10)
    // Small n, large deviation: posterior mode at 0.444, 0.20 is far away → high P
    expect(p).toBeGreaterThan(0.7)
    expect(p).toBeLessThanOrEqual(1)
  })
})

describe('spiritualityProbOneSided', () => {
  it('returns null when n=0', () => {
    expect(spiritualityProbOneSided(0, 0)).toBe(null)
  })

  it('all-correct n=30 → near 1', () => {
    expect(spiritualityProbOneSided(30, 30)).toBeGreaterThan(0.95)
  })

  it('n=100, k=20 (exactly at threshold) → ~50%', () => {
    const p = spiritualityProbOneSided(20, 100)
    expect(p).toBeGreaterThan(0.40)
    expect(p).toBeLessThan(0.60)
  })

  it('n=100, k=21 (just above 20%) → posterior mean slightly above threshold', () => {
    const p = spiritualityProbOneSided(21, 100)
    // Posterior Beta(22, 80) has mean ≈ 0.216, mode ≈ 0.21; ~63% mass above 0.20
    expect(p).toBeGreaterThan(0.55)
    expect(p).toBeLessThan(0.70)
  })
})

describe('posterior helpers', () => {
  it('posteriorMean is correct', () => {
    // Beta(1+40, 1+110) = Beta(41, 111)
    expect(posteriorMean(40, 150)).toBeCloseTo(41 / 152, 10)
  })

  it('posteriorCredibleInterval covers posteriorMean', () => {
    const ci = posteriorCredibleInterval(40, 150, 0.95)
    // Beta(41, 111): mean ≈ 0.27, 95% CI ≈ [0.20, 0.34]
    expect(ci.low).toBeLessThan(0.22)
    expect(ci.high).toBeGreaterThan(0.32)
    expect(ci.low).toBeLessThan(posteriorMean(40, 150))
    expect(ci.high).toBeGreaterThan(posteriorMean(40, 150))
  })

  it('returns null when n=0', () => {
    expect(posteriorCredibleInterval(0, 0)).toBe(null)
  })
})

describe('aggregateRounds', () => {
  it('only counts REVEALED rounds', () => {
    const rounds = [
      { status: 'REVEALED', correct: true },
      { status: 'REVEALED', correct: false },
      { status: 'TARGET_READY', correct: null },
      { status: 'ABANDONED', correct: null },
      { status: 'GUESSING', correct: null },
    ]
    expect(aggregateRounds(rounds)).toEqual({ k: 1, n: 2 })
  })
})
