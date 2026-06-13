// Deterministic RNG (mulberry32) — the foam chamber is rendered twice
// (origin + loop ghost) and must be bit-identical, so all procedural
// geometry uses seeded randomness instead of Math.random().

export function rng(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const gauss = (r) => (r() + r() + r() + r() - 2) * 0.79
