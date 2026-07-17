/**
 * Self-implemented numerical primitives for the Beta distribution.
 *
 * - logGamma (Lanczos approximation, g=7, n=9)
 * - logBeta(a, b) = logGamma(a) + logGamma(b) - logGamma(a+b)
 * - logBetaPdf(x, a, b)
 * - betainc(x, a, b)      — regularized incomplete Beta CDF
 * - betaincinv(p, a, b)   — inverse CDF (Newton + bisection)
 *
 * No external numerical libraries are used. We deliberately keep the
 * implementation finite and auditable per 06-statistics.md 6.4.1.
 */

// ---------- gamma / log gamma ----------

const LANCZOS_G = 7
const LANCZOS_N = 9
const LANCZOS_COEFS = [
  0.99999999999980993,
  676.520368121885,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
]

function logGamma(z) {
  if (z < 0.5) {
    // reflection: logGamma(z) = log(pi / sin(pi*z)) - logGamma(1-z)
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  }
  z -= 1
  let x = LANCZOS_COEFS[0]
  for (let i = 1; i < LANCZOS_N; i++) {
    x += LANCZOS_COEFS[i] / (z + i)
  }
  const t = z + LANCZOS_G + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

function logBeta(a, b) {
  return logGamma(a) + logGamma(b) - logGamma(a + b)
}

export function logBetaPdf(x, alpha, beta) {
  if (x <= 0 || x >= 1) return -Infinity
  return (
    (alpha - 1) * Math.log(x) +
    (beta - 1) * Math.log(1 - x) -
    logBeta(alpha, beta)
  )
}

// ---------- regularized incomplete Beta I_x(a, b) ----------

// Continued fraction by Lentz's method (Numerical Recipes §6.4 style).
// Returns I_x(a, b). Validates 0 <= x <= 1 and a, b > 0.
function betacfInner(x, a, b) {
  const MAX_ITER = 300
  const EPS = 1e-15
  const FPMIN = 1e-300

  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d

  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

export function betainc(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  if (a <= 0 || b <= 0 || !Number.isFinite(x)) {
    throw new Error(`betainc: invalid input x=${x}, a=${a}, b=${b}`)
  }
  // Cephes-style prefactor: bt = x^a (1-x)^b / B(a, b)
  // (NR-C uses lgamma(a+1) which yields bt with an extra /a; the matching CF
  // compensates for it. With the standard CF whose numerators don't include
  // /a, we must drop the +1 here.)
  const bt = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x),
  )
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacfInner(x, a, b)) / a
  }
  return 1 - (bt * betacfInner(1 - x, b, a)) / b
}

// ---------- inverse regularized incomplete Beta I_x^{-1}(p) ----------

function _bisectInv(p, a, b, lo, hi) {
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi)
    const v = betainc(mid, a, b)
    if (Math.abs(v - p) < 1e-12) return mid
    if (v < p) lo = mid
    else hi = mid
  }
  return 0.5 * (lo + hi)
}

export function betaincinv(p, a, b) {
  if (p <= 0) return 0
  if (p >= 1) return 1
  if (a <= 0 || b <= 0) throw new Error('betaincinv: a,b must be > 0')

  // Newton-Raphson starting from a reasonable seed.
  // d/dp I_x(a, b) = x^{a-1} (1-x)^{b-1} / B(a, b)
  let x = a / (a + b) // mode-like seed
  // Push towards an edge if p is near 0 or 1
  if (p < 0.05) x = Math.max(1e-9, p)
  if (p > 0.95) x = Math.min(1 - 1e-9, p)

  let lo = 0, hi = 1
  for (let i = 0; i < 100; i++) {
    const f = betainc(x, a, b) - p
    if (Math.abs(f) < 1e-14) return x
    // numerical derivative
    let dx
    if (x < 1e-6 || x > 1 - 1e-6) {
      // fall back to bisection near edges
      return _bisectInv(p, a, b, lo, hi)
    }
    const logD = (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta(a, b)
    const d = Math.exp(logD)
    if (d <= 0) {
      return _bisectInv(p, a, b, lo, hi)
    }
    dx = f / d
    const newX = x - dx
    if (newX <= lo || newX >= hi) {
      // bracket
      return _bisectInv(p, a, b, lo, hi)
    }
    x = newX
  }
  return _bisectInv(p, a, b, lo, hi)
}

// Expose logGamma for diagnostics
export { logGamma, logBeta }
