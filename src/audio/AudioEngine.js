// The score is generative and never the same twice.
// Three layers:
//   1. A Shepard drone — seven sine oscillators an octave apart whose
//      pitch glides DOWN exactly one octave per loop. An auditory illusion
//      of infinite descent, mirroring the visual illusion of infinite zoom.
//      At p=1 the drone is bit-identical to p=0: the seam is inaudible.
//   2. Generative chord pads — each chamber owns a harmony; chords are
//      strummed loosely every few seconds through a long reverb.
//   3. Sparkles — sparse high plucks through ping-pong delay, denser at
//      the quantum and cosmic ends of the journey (small ≈ vast).
// An analyser feeds low/mid/high bands back into the shaders.

import * as Tone from 'tone'
import { world } from '../core/world'
import { segOf } from '../config/chambers'

const CHORDS = [
  ['A3', 'B3', 'C4', 'E4', 'B4'], // I  FOAM — a-minor add9, high & sparse
  ['E2', 'B2', 'E3', 'G3', 'F#4'], // II LATTICE
  ['C3', 'G3', 'E4', 'B4', 'D5'], // III MEMBRANE — Cmaj9
  ['F2', 'C3', 'A3', 'E4', 'B4'], // IV BLOOM — F lydian
  ['D2', 'A2', 'F3', 'C4', 'E4'], // V  VESSEL — Dm9
  ['Bb1', 'F2', 'D3', 'A3', 'E4'], // VI SPIRE
  ['G1', 'D2', 'B2', 'F#3', 'E4'], // VII TERRA
  ['Eb2', 'Bb2', 'G3', 'D4', 'F4'], // VIII SPHERE
  ['C1', 'G1', 'Eb2', 'Bb2', 'D3'], // IX STAR — low blaze
  ['A1', 'E2', 'A2', 'C3', 'B3'], // X  WEB — returns to A: the tonal loop
]

const SPARKLE_NOTES = [
  ['A5', 'B5', 'C6', 'E6', 'G6'],
  ['E5', 'G5', 'B5', 'D6', 'F#6'],
  ['E5', 'G5', 'B5', 'C6', 'D6'],
  ['A5', 'C6', 'E6', 'F6', 'G6'],
  ['D5', 'F5', 'A5', 'C6', 'E6'],
  ['D5', 'F5', 'A5', 'Bb5', 'E6'],
  ['D5', 'E5', 'F#5', 'B5', 'D6'],
  ['Bb4', 'D5', 'G5', 'Bb5', 'D6'],
  ['G4', 'C5', 'Eb5', 'G5', 'Bb5'],
  ['A4', 'B4', 'C5', 'E5', 'A5'],
]

const SPARKLE_DENSITY = [0.5, 0.32, 0.2, 0.3, 0.14, 0.3, 0.18, 0.14, 0.1, 0.48]
const PAD_BRIGHTNESS = [2400, 1500, 1100, 2600, 1400, 1300, 1000, 800, 700, 2000]

const SHEPARD_N = 7
const SHEPARD_F0 = 22

let built = false
let master, fft, wave, shepardOscs, shepardGains, padFilter
let pad, sparkle, pulse, airGain

export async function startAudio() {
  await Tone.start()
  if (built) {
    setMuted(world.muted)
    return
  }
  built = true

  master = new Tone.Gain(0)
  const limiter = new Tone.Limiter(-2)
  master.connect(limiter)
  limiter.toDestination()

  fft = new Tone.Analyser('fft', 64)
  wave = new Tone.Analyser('waveform', 256)
  master.connect(fft)
  master.connect(wave)

  const reverb = new Tone.Reverb({ decay: 11, preDelay: 0.04, wet: 0.62 })
  reverb.connect(master)

  // ---- 1. Shepard drone ----
  // Each voice is three sines spread a few cents apart, so sustained
  // tones shimmer gently instead of sitting on one harsh frequency.
  const droneBus = new Tone.Gain(0.5)
  const droneFilter = new Tone.Filter(700, 'lowpass', -12)
  const droneDry = new Tone.Gain(0.45)
  droneBus.connect(droneFilter)
  droneFilter.connect(reverb)
  droneFilter.connect(droneDry)
  droneDry.connect(master)
  shepardOscs = []
  shepardGains = []
  for (let i = 0; i < SHEPARD_N; i++) {
    const g = new Tone.Gain(0)
    const o = new Tone.FatOscillator(SHEPARD_F0 * Math.pow(2, i), 'sine', 14)
    o.count = 3
    o.connect(g)
    g.connect(droneBus)
    o.start()
    shepardOscs.push(o)
    shepardGains.push(g)
  }

  // ---- 2. Chord pads ----
  padFilter = new Tone.Filter(1200, 'lowpass', -12)
  padFilter.connect(reverb)
  pad = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 16,
    oscillator: { type: 'fatsine', count: 3, spread: 14 },
    envelope: { attack: 2.8, decay: 1.5, sustain: 0.7, release: 7 },
    volume: -18,
  })
  pad.connect(padFilter)

  // ---- 3. Sparkles ----
  const delay = new Tone.PingPongDelay(0.37, 0.45)
  delay.wet.value = 0.5
  delay.connect(reverb)
  sparkle = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.004, decay: 0.4, sustain: 0, release: 1.8 },
    volume: -23,
  })
  sparkle.connect(delay)

  // ---- 4. Deep pulse (STAR chamber heartbeat) ----
  pulse = new Tone.MembraneSynth({
    pitchDecay: 0.12,
    octaves: 5,
    envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
    volume: -16,
  })
  pulse.connect(reverb)

  // ---- 5. Air — filtered pink noise breathing underneath ----
  const air = new Tone.Noise('pink')
  const airFilter = new Tone.Filter(420, 'bandpass')
  airFilter.Q.value = 1.6
  airGain = new Tone.Gain(0.012)
  air.connect(airFilter)
  airFilter.connect(airGain)
  airGain.connect(master)
  air.start()

  // ---- generative scheduling ----
  const T = Tone.getTransport()
  T.scheduleRepeat((time) => {
    const seg = segOf(world.p)
    const chord = CHORDS[seg]
    // strum 3-5 notes, loose timing, soft velocities
    const count = 3 + Math.floor(Math.random() * (chord.length - 2))
    const picked = [...chord].sort(() => Math.random() - 0.5).slice(0, count)
    picked.forEach((note) => {
      const t = time + Math.random() * 2.2
      const vel = 0.10 + Math.random() * 0.16
      const dur = 5 + Math.random() * 5
      pad.triggerAttackRelease(note, dur, t, vel)
    })
    padFilter.frequency.rampTo(PAD_BRIGHTNESS[seg], 3)
  }, 6.5)

  T.scheduleRepeat((time) => {
    const seg = segOf(world.p)
    if (Math.random() < SPARKLE_DENSITY[seg]) {
      const notes = SPARKLE_NOTES[seg]
      const note = notes[Math.floor(Math.random() * notes.length)]
      sparkle.triggerAttackRelease(note, 0.18, time + Math.random() * 0.3, 0.10 + Math.random() * 0.2)
    }
  }, 0.46)

  T.scheduleRepeat((time) => {
    const seg = segOf(world.p)
    if (seg === 8 && Math.random() < 0.85) {
      pulse.triggerAttackRelease('C1', 0.6, time, 0.5)
    } else if (seg === 7 && Math.random() < 0.3) {
      pulse.triggerAttackRelease('Eb1', 0.6, time, 0.3)
    }
  }, 4.2)

  T.start()
  master.gain.rampTo(world.muted ? 0 : 0.9, 2.5)
  world.started = true
}

export function setMuted(m) {
  world.muted = m
  if (master) master.gain.rampTo(m ? 0 : 0.9, 0.8)
}

let shepT = 0

// called once per frame from the render loop
export function updateAudio(dt) {
  if (!built) return
  const p = world.p
  shepT += dt

  // Shepard glide: each oscillator descends one octave per loop, gains
  // follow a raised-sine window over the register so top/bottom fade out.
  // A slow per-voice breath (±0.4%) keeps any one frequency from ever
  // standing perfectly still.
  for (let i = 0; i < SHEPARD_N; i++) {
    const x = (i + (1 - p)) / SHEPARD_N // 0..1 position in the stack
    const breath = 1 + Math.sin(shepT * 0.5 + i * 1.9) * 0.004
    const freq = SHEPARD_F0 * Math.pow(2, i + (1 - p)) * breath
    const win = Math.pow(Math.sin(Math.PI * x), 2)
    const weight = 1.0 - x * 0.5 // favor the low end, soften the upper voices
    shepardOscs[i].frequency.value = freq
    shepardGains[i].gain.value = win * weight * 0.05
  }

  // air swells with scroll velocity — the journey audibly "moves"
  if (airGain) {
    const v = Math.min(1, Math.abs(world.velocity) * 14)
    airGain.gain.value = 0.010 + v * 0.05
  }

  // analyser → bands
  const bins = fft.getValue()
  const lin = (db) => Math.max(0, Math.min(1, (db + 95) / 65))
  let low = 0
  let mid = 0
  let high = 0
  for (let i = 1; i <= 6; i++) low += lin(bins[i])
  for (let i = 7; i <= 24; i++) mid += lin(bins[i])
  for (let i = 25; i <= 56; i++) high += lin(bins[i])
  low /= 6
  mid /= 18
  high /= 32

  const w = wave.getValue()
  let rms = 0
  for (let i = 0; i < w.length; i++) rms += w[i] * w[i]
  rms = Math.sqrt(rms / w.length) * 3

  const a = world.audio
  const k = Math.min(1, dt * 7)
  a.low += (low - a.low) * k
  a.mid += (mid - a.mid) * k
  a.high += (high - a.high) * k
  a.level += (Math.min(1, rms) - a.level) * k
}
