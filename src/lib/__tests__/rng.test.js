import { describe, it, expect } from 'vitest'
import { generateTarget } from '../rng.js'

describe('rng.generateTarget', () => {
  it('returns an integer in {1,2,3,4,5}', () => {
    for (let i = 0; i < 200; i++) {
      const t = generateTarget('round-' + i)
      expect(t).toBeGreaterThanOrEqual(1)
      expect(t).toBeLessThanOrEqual(5)
      expect(Number.isInteger(t)).toBe(true)
    }
  })

  it('accepts an arbitrary roundId (does not crash, ignores for RNG)', () => {
    expect(() => generateTarget('')).not.toThrow()
    expect(() => generateTarget(null)).not.toThrow()
    expect(() => generateTarget(undefined)).not.toThrow()
    expect(() => generateTarget('a-b-c-d-e')).not.toThrow()
  })
})
