import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import PetalBloom from '../PetalBloom'
import { SIMPLEX } from '../glsl'
import { rng } from '../rand'

// III — 10⁻⁶ m — the first interiors.
// Soft translucent cells drift and swell with the bass. Inside each
// of the larger cells a single glowing nucleus burns. Between the
// cells: warm organelles, chrome vesicles and a slow tide of drifting motes.

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
  { p: [-16, 6, -42], r: 7.5, seed: 1.3, deep: '#0d3a38', glow: '#5fe8d2', nucleus: '#ff9a78' },
  { p: [18, -8, -26], r: 5.2, seed: 4.1, deep: '#0e2e3c', glow: '#6fd2ff', nucleus: '#ffd0a0' },
  { p: [-24, -10, -4], r: 9.0, seed: 7.8, deep: '#123c30', glow: '#7df0c0', nucleus: '#ff7a59' },
  { p: [13, 10, 8], r: 4.4, seed: 2.9, deep: '#0d3440', glow: '#8fe0e8' },
  { p: [-8, 14, 30], r: 6.3, seed: 9.2, deep: '#0f3a2c', glow: '#66e8b8', nucleus: '#ffbe6a' },
  { p: [25, -3, 38], r: 8.1, seed: 5.5, deep: '#0c303a', glow: '#5fc8e8', nucleus: '#ffa470' },
  { p: [-19, -6, 56], r: 5.8, seed: 3.6, deep: '#114038', glow: '#80f0d8' },
  { p: [7, -14, 60], r: 4.0, seed: 8.4, deep: '#0d2e38', glow: '#74dcd2' },
  // warm-toned interlopers for color contrast
  { p: [-30, 4, -16], r: 5.5, seed: 6.1, deep: '#3a1530', glow: '#ff8fb2', nucleus: '#ffe2bc' },
  { p: [30, 8, -56], r: 6.8, seed: 2.2, deep: '#321a2e', glow: '#ff7aa6' },
  { p: [-4, -16, 16], r: 4.6, seed: 4.7, deep: '#28303a', glow: '#bfa0ff' },
  { p: [20, 14, 24], r: 3.6, seed: 7.0, deep: '#2c3a2a', glow: '#c8f0a8' },
  { p: [-12, -2, -68], r: 7.2, seed: 1.9, deep: '#1a2840', glow: '#9fc8ff', nucleus: '#fff0c0' },
  { p: [4, 4, 48], r: 3.2, seed: 8.9, deep: '#2a3438', glow: '#9bf0d6' },
]

function Blob({ p, r, seed, deep, glow, nucleus }) {
  const grp = useRef()
  const matRef = useRef()
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
        grp.current = g
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
            // nucleus drifts off-center; pulses with low end
            const breath = 1 + Math.sin(t * 0.9 + seed * 4.0) * 0.15 + low * 0.4
            nucRef.current.scale.setScalar(0.22 * breath)
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
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial color={nucleus} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

// chrome organelles that drift between the cells — small iridescent vesicles
const ORGANELLES = (() => {
  const r = rng(307)
  const items = []
  for (let i = 0; i < 36; i++) {
    items.push({
      p: [(r() * 2 - 1) * 32, (r() * 2 - 1) * 18, (r() * 2 - 1) * 62],
      s: 0.32 + r() * 0.55,
      ph: r() * Math.PI * 2,
      sp: 0.4 + r() * 0.6,
    })
  }
  return items
})()

export default function Membrane() {
  const group = useRef()
  const motes = useRef()
  const halo1 = useRef()
  const halo2 = useRef()
  const orgRef = useRef()
  const orgDummy = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    if (!orgRef.current) return
    ORGANELLES.forEach((o, i) => {
      orgDummy.position.set(...o.p)
      orgDummy.scale.setScalar(o.s)
      orgDummy.updateMatrix()
      orgRef.current.setMatrixAt(i, orgDummy.matrix)
    })
    orgRef.current.instanceMatrix.needsUpdate = true
  }, [orgDummy])

  useChamber(2, group, (state) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    group.current.traverse((o) => {
      if (o.userData.update) o.userData.update(t, a.low)
    })
    if (orgRef.current) {
      ORGANELLES.forEach((o, i) => {
        orgDummy.position.set(
          o.p[0] + Math.sin(t * 0.18 * o.sp + o.ph) * 3.4,
          o.p[1] + Math.cos(t * 0.21 * o.sp + o.ph * 1.7) * 2.6,
          o.p[2] + Math.sin(t * 0.13 * o.sp + o.ph * 0.6) * 3.0
        )
        orgDummy.rotation.set(t * 0.4 + o.ph, t * 0.3 + o.ph * 1.3, 0)
        orgDummy.scale.setScalar(o.s * (1 + a.mid * 0.12))
        orgDummy.updateMatrix()
        orgRef.current.setMatrixAt(i, orgDummy.matrix)
      })
      orgRef.current.instanceMatrix.needsUpdate = true
    }
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
      <instancedMesh ref={orgRef} args={[null, null, ORGANELLES.length]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 2]} />
        <meshPhysicalMaterial
          color="#e8e2ff"
          metalness={1}
          roughness={0.18}
          iridescence={1}
          iridescenceIOR={1.5}
          envMapIntensity={1.6}
        />
      </instancedMesh>
      <ParticleField
        ref={motes}
        count={2400}
        seed={71}
        box={[34, 22, 70]}
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
