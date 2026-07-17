/**
 * Random target generation.
 *
 * CRITICAL: This module is the SOLE producer of digits that go into a round.target.
 * Components MUST NOT call generateTarget() directly; they must go through
 * src/lib/state-machine.js which owns the timing (see 03-core-mechanics.md 3.1).
 *
 * @param {string} roundId - the UUID of the round being generated; logged for
 *   auditability, NOT used in the RNG (kept independent so tests can swap).
 * @returns {1|2|3|4|5}
 */
export function generateTarget(roundId) {
  // roundId intentionally unused at runtime — present in the signature so spies
  // and stack traces can correlate. Do NOT seed the RNG with it; the seed must
  // remain uniform across rounds to keep the symmetry-of-options invariant.
  void roundId
  return Math.floor(Math.random() * 5) + 1
}
