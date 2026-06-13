import { useRef } from 'react'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import PetalBloom from '../PetalBloom'

// IV — 10⁰ m — the scale of touch.
// The white chamber. Enormous defocused flower-gradients hang in a
// gallery of warm light, and one hard chrome knot tumbles among them —
// the soft world and the hard object, layered.

const FLOWERS = [
  { p: [-26, 8, -62], s: 80, petals: 7, seed: 1.7, a: '#ff4fa0', b: '#ffb37a', c: '#ffd9c2', al: 0.92 },
  { p: [24, -6, -48], s: 50, petals: 5, seed: 6.2, a: '#b9a8ff', b: '#9fc2ff', c: '#ffc2e8', al: 0.88 },
  { p: [-12, -12, -34], s: 38, petals: 9, seed: 3.9, a: '#ff7a59', b: '#ffc94f', c: '#ff9ad0', al: 0.85 },
  { p: [30, 12, -18], s: 54, petals: 6, seed: 8.1, a: '#ff5fae', b: '#ff9a6a', c: '#c9b0ff', al: 0.88 },
  { p: [-31, 2, -52], s: 46, petals: 8, seed: 2.4, a: '#9a8aff', b: '#ff8fc2', c: '#ffd0a8', al: 0.86 },
  { p: [10, 16, -10], s: 34, petals: 5, seed: 7.5, a: '#ffa84f', b: '#ff6a9a', c: '#b9d0ff', al: 0.8 },
  { p: [-18, -10, -40], s: 52, petals: 7, seed: 4.8, a: '#ff4f8a', b: '#c9a0ff', c: '#ffd9b8', al: 0.9 },
  { p: [27, -2, 0], s: 40, petals: 6, seed: 9.9, a: '#ffb37a', b: '#ff5fae', c: '#a8c2ff', al: 0.82 },
  { p: [-4, 14, -70], s: 70, petals: 8, seed: 5.3, a: '#e89aff', b: '#ff8a6a', c: '#ffe0c2', al: 0.88 },
  { p: [12, -14, 8], s: 32, petals: 5, seed: 1.1, a: '#ff6a8a', b: '#ffc24f', c: '#d0b8ff', al: 0.78 },
]

export default function BloomChamber() {
  const group = useRef()
  const knot = useRef()
  const ringA = useRef()
  const ringB = useRef()
  const pollen = useRef()
  const flowers = useRef([])

  useChamber(3, group, (state, dt) => {
    const t = state.clock.elapsedTime
    const a = world.audio

    flowers.current.forEach((f, i) => {
      if (!f?.material) return
      f.material.uniforms.uTime.value = t
      const base = FLOWERS[i].s
      f.mesh.scale.setScalar(base * (1 + a.mid * 0.07 + Math.sin(t * 0.2 + i * 2.2) * 0.025))
      f.mesh.rotation.z = t * 0.018 * (i % 2 ? 1 : -1) + i * 0.8
    })

    if (knot.current) {
      knot.current.rotation.x = t * 0.1
      knot.current.rotation.y = t * (0.14 + a.mid * 0.25)
      knot.current.position.y = 2 + Math.sin(t * 0.4) * 0.9
    }
    if (ringA.current) {
      ringA.current.rotation.x = t * 0.12 + 0.6
      ringA.current.rotation.y = t * 0.08
    }
    if (ringB.current) {
      ringB.current.rotation.x = -t * 0.09 + 1.9
      ringB.current.rotation.z = t * 0.11
    }
    const pm = pollen.current?.material
    if (pm) {
      pm.uniforms.uTime.value = t
      pm.uniforms.uAudio.value = a.high * 0.5
    }
  })

  return (
    <group ref={group} position={[0, 0, centerZ(3)]}>
      {FLOWERS.map((f, i) => (
        <PetalBloom
          key={i}
          ref={(r) => (flowers.current[i] = r)}
          position={f.p}
          size={f.s}
          petals={f.petals}
          seed={f.seed}
          alpha={f.al}
          soft={1.3}
          fade={0.0085}
          colorA={f.a}
          colorB={f.b}
          colorC={f.c}
        />
      ))}

      <group position={[10, 2, -28]}>
        <mesh ref={knot}>
          <torusKnotGeometry args={[4.4, 1.35, 420, 64]} />
          <meshPhysicalMaterial
            color="#ffffff"
            metalness={1}
            roughness={0.1}
            iridescence={1}
            iridescenceIOR={1.6}
            clearcoat={1}
            envMapIntensity={1.9}
          />
        </mesh>
        <mesh ref={ringA}>
          <torusGeometry args={[9.5, 0.22, 24, 140]} />
          <meshPhysicalMaterial color="#f0eee8" metalness={1} roughness={0.14} iridescence={1} envMapIntensity={1.6} />
        </mesh>
        <mesh ref={ringB}>
          <torusGeometry args={[12.6, 0.14, 24, 160]} />
          <meshPhysicalMaterial color="#f0eee8" metalness={1} roughness={0.14} iridescence={1} envMapIntensity={1.6} />
        </mesh>
      </group>

      <ParticleField
        ref={pollen}
        count={900}
        seed={83}
        box={[36, 22, 68]}
        size={0.95}
        amp={2.0}
        alpha={0.45}
        colorA="#b8862e"
        colorB="#d9a84f"
        additive={false}
        fade={0.012}
      />
    </group>
  )
}
