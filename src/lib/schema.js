/**
 * Type / data shape definitions for the whole app.
 * Provided as JSDoc typedefs so editors and `// @ts-check` can use them.
 * No runtime exports — keep the file pure type-info.
 *
 * @typedef {1|2|3|4|5} Digit
 *
 * @typedef {'TARGET_READY' | 'GUESSING' | 'REVEALED' | 'ABANDONED'} RoundStatus
 *
 * @typedef {'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'} SessionStatus
 *
 * @typedef {Object} Round
 * @property {string} id
 * @property {number} index
 * @property {Digit} target   // frozen once generated
 * @property {number} createdAt
 * @property {Digit | null} guess
 * @property {RoundStatus} status
 * @property {boolean | null} correct
 * @property {number | null} revealedAt
 *
 * @typedef {Object} SessionSettings
 * @property {number} roundsPerSession
 * @property {number} exposureTimeMs
 *
 * @typedef {Object} SessionSummary
 * @property {number} total                   // REVEALED count
 * @property {number} correct
 * @property {number} accuracy
 * @property {number} computedAt
 * @property {number} spiritualityEffectiveProb // = P(p ≠ 0.20 | data) via Savage-Dickey
 *
 * @typedef {Object} Session
 * @property {string} id
 * @property {number} createdAt
 * @property {number | null} completedAt
 * @property {SessionStatus} status
 * @property {Round[]} rounds
 * @property {SessionSettings} settings
 * @property {SessionSummary} [summary]
 *
 * @typedef {Object} AppSettings
 * @property {'auto'|'light'|'dark'} theme
 * @property {number} roundsPerSession
 * @property {number} exposureTimeMs
 * @property {number} priorAlpha
 * @property {number} priorBeta
 * @property {'pointNull'|'oneSided'|'credibleInterval'} view
 * @property {number} oneSidedThreshold
 * @property {number} credibleLevel
 */

// Pure type-info module — runtime export empty
export const SCHEMA_VERSION = 1
