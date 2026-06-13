import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import PetalBloom from '../PetalBloom'
import { SIMPLEX } from '../glsl'

// III — 10⁻⁶ m — the first interiors.
// Soft translucent cells drift and swell with the bass; warm
// organelles glitter inside the chamber like suspended cargo.

const BLOB_VERT = /* glsl */ `
${SIMPLEX}
uniform float uTime;
uniform float uSeed;
uniform float uLow;
varying vec3 vNormal;
varying vec3 vView;
varying float vDist;
void main() {
  float n = fbm(normal * 1.5 + vec3(uSeed) + vec3(0.0, uTime * 0.16, 0.0));
  float wobble = 1.0 + n * (0.14 + uLow * 0.12);
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
  float alpha = 0.16 + fr * (0.55 + uLow * 0.25);
  float dim = exp(-pow(vDist * 0.011, 2.0));
  gl_FragColor = vec4(col, alpha * dim);
}
`

const BLOBS = [
  { p: [-16, 6, -42], r: 7.5, seed: 1.3, deep: '#0d3a38', glow: '#5fe8d2' },
  { p: [18, -8, -26], r: 5.2, seed: 4.1, deep: '#0e2e3c', glow: '#6fd2ff' },
  { p: [-24, -10, -4], r: 9.0, seed: 7.8, deep: '#123c30', glow: '#7df0c0' },
  { p: [13, 10, 8], r: 4.4, seed: 2.9, deep: '#0d3440', glow: '#8fe0e8' },
  { p: [-8, 14, 30], r: 6.3, seed: 9.2, deep: '#0f3a2c', glow: '#66e8b8' },
  { p: [25, -3, 38], r: 8.1, seed: 5.5, deep: '#0c303a', glow: '#5fc8e8' },
  { p: [-19, -6, 56], r: 5.8, seed: 3.6, deep: '#114038', glow: '#80f0d8' },
  { p: [7, -14, 60], r: 4.0, seed: 8.4, deep: '#0d2e38', glow: '#74dcd2' },
]

function Blob({ p, r, seed, deep, glow }) {
  const mesh = useRef()
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
  Blob.registry = Blob.registry || []
  return (
    <mesh
      ref={(m) => {
        mesh.current = m
        if (m) m.userData.update = (t, low) => {
          uniforms.uTime.value = t
          uniforms.uLow.value = low
          m.position.set(
            p[0] + Math.sin(t * 0.21 + seed * 3.0) * 2.2,
            p[1] + Math.cos(t * 0.17 + seed * 5.0) * 1.8,
            p[2] + Math.sin(t * 0.13 + seed * 7.0) * 2.0
          )
          m.rotation.y = t * 0.05 + seed
        }
      }}
      position={p}
      scale={r}
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, 5]} />
      <shaderMaterial
        vertexShader={BLOB_VERT}
        fragmentShader={BLOB_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
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
        count={1800}
        seed={71}
        box={[32, 20, 66]}
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
