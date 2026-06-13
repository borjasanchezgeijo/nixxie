// The spine of the museum: ten chambers, ten orders of magnitude.
// The journey descends in pitch as it ascends in scale, and at the far
// end of the universe the cosmic web dissolves back into quantum foam.

export const SPACING = 140 // world units between chamber centers
export const N = 10
export const TRAVEL = SPACING * N // full loop distance

export const CHAMBERS = [
  {
    id: 'foam',
    numeral: '1',
    name: 'FOAM',
    exponent: -35,
    subtitle: "space's network",
    bg: '#070310',
    fog: 0.020,
    ink: 'light',
  },
  {
    id: 'lattice',
    numeral: '2',
    name: 'LATTICE',
    exponent: -10,
    subtitle: 'matter learns repetition',
    bg: '#070d1c',
    fog: 0.016,
    ink: 'light',
  },
  {
    id: 'membrane',
    numeral: '3',
    name: 'MEMBRANE',
    exponent: -6,
    subtitle: 'the first interiors',
    bg: '#081716',
    fog: 0.014,
    ink: 'light',
  },
  {
    id: 'bloom',
    numeral: '4',
    name: 'BLOOM',
    exponent: 0,
    subtitle: 'the scale of touch',
    bg: '#f6f1ea',
    fog: 0.0115,
    ink: 'dark',
  },
  {
    id: 'vessel',
    numeral: '5',
    name: 'VESSEL',
    exponent: 2,
    subtitle: 'hollow things that hold us',
    bg: '#e9e2d6',
    fog: 0.0145,
    ink: 'dark',
  },
  {
    id: 'spire',
    numeral: '6',
    name: 'SPIRE',
    exponent: 4,
    subtitle: 'geometry grows ambitious',
    bg: '#190a1e',
    fog: 0.015,
    ink: 'light',
  },
  {
    id: 'terra',
    numeral: '7',
    name: 'TERRA',
    exponent: 6,
    subtitle: 'the ground becomes a map',
    bg: '#1c1410',
    fog: 0.009,
    ink: 'light',
  },
  {
    id: 'sphere',
    numeral: '8',
    name: 'SPHERE',
    exponent: 7,
    subtitle: 'one round room',
    bg: '#04060f',
    fog: 0.006,
    ink: 'light',
  },
  {
    id: 'star',
    numeral: '9',
    name: 'STAR',
    exponent: 9,
    subtitle: 'the lamp',
    bg: '#0a0303',
    fog: 0.009,
    ink: 'light',
  },
  {
    id: 'web',
    numeral: '10',
    name: 'WEB',
    exponent: 26,
    subtitle: 'scale is all',
    bg: '#030309',
    fog: 0.016,
    ink: 'light',
  },
]

// progress segment of chamber i: [i/N, (i+1)/N)
export const segOf = (p) => Math.floor(((p % 1) + 1) % 1 * N) % N
export const wrap01 = (x) => ((x % 1) + 1) % 1

// signed shortest distance between two wrapped progress values, in (-0.5, 0.5]
export const wrapDelta = (a, b) => {
  let d = wrap01(a) - wrap01(b)
  if (d > 0.5) d -= 1
  if (d < -0.5) d += 1
  return d
}
