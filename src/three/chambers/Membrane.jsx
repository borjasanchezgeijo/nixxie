import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import PetalBloom from '../PetalBloom'
import { SIMPLEX } from '../glsl'

// III — 10⁻⁶ m — the first interiors.
// Translucent cells drift and swell with the bass. Inside the larger
// ones a single warm nucleus burns and pulses. The chamber holds
// nothing harder than these membranes — no chrome, no edges.

const BLOB_VERT = /* glsl */ `
${SIMPLEX}
uniform float uTime;
uniform float uSeed;
uniform float uLow;
varying vec3 vNormal;
varying vec3 vView;
varying float vDist;
void main() {
  // two-octave domain warp + the unit-sphere normal gives membranes
  // that wobble and crinkle individually instead of breathing uniformly
  vec3 n = normal;
  float n1 = fbm(n * 1.4 + vec3(uSeed) + vec3(0.0, uTime * 0.18, 0.0));
  float n2 = fbm(n * 3.1 + vec3(uSeed * 1.7) - vec3(uTime * 0.11, 0.0, 0.0));
  float wobble = 1.0 + n1 * (0.16 + uLow * 0.14) + n2 * 0.07;
  vec3 pos = position * wobble;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const BLOB_FRAG = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uGlow;
uniform float uLow;
varying vec3 vNormal;
varying vec3 vView;
varying float vDist;
void main() {
  float fr = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
  vec3 col = mix(uDeep, uGlow, fr);
  // brighter rim so the membrane reads as a soap film at glancing angles
  float rim = pow(fr, 0.55) * 0.35;
  col += rim * uGlow;
  float alpha = 0.16 + fr * (0.55 + uLow * 0.25);
  float dim = exp(-pow(vDist * 0.011, 2.0));
  gl_FragColor = vec4(col, alpha * dim);
}
`

// hand-tuned ensemble: a constellation of cells in mixed palettes,
// with the largest ones holding a warm nucleus.
const BLOBS = [
  // tealish ancestors
  { p: [-16, 6, -42], r: 7.5, seed: 1.3, deep: '#0d3a38', glow: '#5fe8d2', nucleus: '#ff9a78', nucScale: 0.22 },
  { p: [18, -8, -26], r: 5.2, seed: 4.1, deep: '#0e2e3c', glow: '#6fd2ff', nucleus: '#ffd0a0', nucScale: 0.20 },
  { p: [-24, -10, -4], r: 9.0, seed: 7.8, deep: '#123c30', glow: '#7df0c0', nucleus: '#ff7a59', nucScale: 0.22 },
  { p: [13, 10, 8], r: 4.4, seed: 2.9, deep: '#0d3440', glow: '#8fe0e8' },
  { p: [-8, 14, 30], r: 6.3, seed: 9.2, deep: '#0f3a2c', glow: '#66e8b8', nucleus: '#ffbe6a', nucScale: 0.20 },
  { p: [25, -3, 38], r: 8.1, seed: 5.5, deep: '#0c303a', glow: '#5fc8e8', nucleus: '#ffa470', nucScale: 0.22 },
  { p: [-19, -6, 56], r: 5.8, seed: 3.6, deep: '#114038', glow: '#80f0d8' },
  { p: [7, -14, 60], r: 4.0, seed: 8.4, deep: '#0d2e38', glow: '#74dcd2' },
  // magenta/violet contrasts
  { p: [-30, 4, -16], r: 7.2, seed: 6.1, deep: '#3a1530', glow: '#ff8fb2', nucleus: '#ffe2bc', nucScale: 0.20 },
  { p: [30, 8, -56], r: 6.8, seed: 2.2, deep: '#321a2e', glow: '#ff7aa6', nucleus: '#f0d8a0', nucScale: 0.20 },
  { p: [-4, -16, 16], r: 4.6, seed: 4.7, deep: '#28303a', glow: '#bfa0ff' },
  { p: [20, 14, 24], r: 3.6, seed: 7.0, deep: '#2c3a2a', glow: '#c8f0a8' },
  { p: [-12, -2, -68], r: 8.5, seed: 1.9, deep: '#1a2840', glow: '#9fc8ff', nucleus: '#fff0c0', nucScale: 0.20 },
  { p: [4, 4, 48], r: 3.2, seed: 8.9, deep: '#2a3438', glow: '#9bf0d6' },
  // ten more — a denser interior, varied in scale and palette
  { p: [-8, 9, -8], r: 3.0, seed: 5.0, deep: '#2a3030', glow: '#a8e8d0' },
  { p: [9, -12, -10], r: 2.6, seed: 3.1, deep: '#34202c', glow: '#ffb0c8' },
  { p: [-22, 11, 18], r: 4.2, seed: 9.7, deep: '#222e2c', glow: '#90e0c4' },
  { p: [22, 6, 0], r: 3.8, seed: 0.6, deep: '#202836', glow: '#a0c8f0' },
  { p: [-6, -8, -22], r: 2.8, seed: 6.8, deep: '#1f3530', glow: '#7adfae' },
  { p: [12, 12, -42], r: 5.0, seed: 4.2, deep: '#2a1f30', glow: '#d0a0ff' },
  { p: [-28, -4, 42], r: 4.8, seed: 7.3, deep: '#0f3236', glow: '#6fd0d8', nucleus: '#ffc890', nucScale: 0.18 },
  { p: [16, -10, 56], r: 3.4, seed: 1.5, deep: '#143030', glow: '#8de0c8' },
  { p: [-2, 16, 0], r: 2.4, seed: 8.0, deep: '#332838', glow: '#e0a8e8' },
  { p: [28, 4, 56], r: 4.4, seed: 2.7, deep: '#2c1a2c', glow: '#ff96b8', nucleus: '#fff0d0', nucScale: 0.18 },
]

function Blob({ p, r, seed, deep, glow, nucleus, nucScale = 0.22 }) {
  const matRef = useRef()
  const nucMatRef = useRef()
  const nucRef = useRef()
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: seed },
      uLow: { value: 0 },
      uDeep: { value: new THREE.Color(deep) },
      uGlow: { value: new THREE.Color(glow) },
    }),
    []
  )
  return (
    <group
      ref={(g) => {
        if (g) g.userData.update = (t, low) => {
          uniforms.uTime.value = t
          uniforms.uLow.value = low
          g.position.set(
            p[0] + Math.sin(t * 0.21 + seed * 3.0) * 2.2,
            p[1] + Math.cos(t * 0.17 + seed * 5.0) * 1.8,
            p[2] + Math.sin(t * 0.13 + seed * 7.0) * 2.0
          )
          g.rotation.y = t * 0.05 + seed
          if (nucRef.current) {
            const breath = 1 + Math.sin(t * 0.9 + seed * 4.0) * 0.15 + low * 0.4
            nucRef.current.scale.setScalar(nucScale * breath)
            nucRef.current.position.set(
              Math.sin(t * 0.3 + seed * 2.0) * 0.18,
              Math.cos(t * 0.27 + seed * 1.4) * 0.18,
              Math.sin(t * 0.23 + seed * 0.9) * 0.18
            )
          }
        }
      }}
      position={p}
      scale={r}
    >
      <mesh ref={matRef} frustumCulled={false}>
        <icosahedronGeometry args={[1, 5]} />
        <shaderMaterial
          vertexShader={BLOB_VERT}
          fragmentShader={BLOB_FRAG}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      {nucleus && (
        <mesh ref={nucRef}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial ref={nucMatRef} color={nucleus} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

export default function Membrane() {
  const group = useRef()
  const motes = useRef()
  const halo1 = useRef()
  const halo2 = useRef()

  useChamber(2, group, (state) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    group.current.traverse((o) => {
      if (o.userData.update) o.userData.update(t, a.low)
    })
    const mm = motes.current?.material
    if (mm) {
      mm.uniforms.uTime.value = t
      mm.uniforms.uAudio.value = a.mid * 0.7
    }
    ;[halo1, halo2].forEach((h, i) => {
      if (h.current?.material) {
        h.current.material.uniforms.uTime.value = t
        h.current.material.uniforms.uAlpha.value = 0.12 + a.low * 0.08
        h.current.mesh.rotation.z = t * 0.015 * (i ? -1 : 1)
      }
    })
  })

  return (
    <group ref={group} position={[0, 0, centerZ(2)]}>
      {BLOBS.map((b, i) => (
        <Blob key={i} {...b} />
      ))}
      <ParticleField
        ref={motes}
        count={2600}
        seed={71}
        box={[36, 24, 72]}
        size={1.05}
        amp={2.4}
        alpha={0.55}
        colorA="#ff9a78"
        colorB="#ffd9b0"
        fade={0.012}
      />
      <PetalBloom
        ref={halo1}
        position={[-20, 2, -60]}
        size={85}
        petals={0}
        seed={4.4}
        alpha={0.13}
        soft={2.6}
        colorA="#0a4038"
        colorB="#2ea890"
        colorC="#177888"
        additive
      />
      <PetalBloom
        ref={halo2}
        position={[22, -6, 50]}
        size={70}
        petals={0}
        seed={8.8}
        alpha={0.13}
        soft={2.6}
        colorA="#0c3640"
        colorB="#28b8a8"
        colorC="#1a8a98"
        additive
      />
    </group>
  )
}
