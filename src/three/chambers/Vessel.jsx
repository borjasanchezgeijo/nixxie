import { useRef } from 'react'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import PetalBloom from '../PetalBloom'

// V — 10² m — hollow things that hold us.
// A pale hall overgrown: enormous distorted blooms melt and smear
// through the warm air while chrome spheres hover between them
// like exhibits, drawn toward a window of light at the far end.

const FLORA = [
  { p: [-20, 8, -64], s: 70, petals: 7, seed: 2.3, warp: 0.3, a: '#e02468', b: '#ff8a2a', c: '#7a2ce0', al: 0.95 },
  { p: [18, -4, -58], s: 56, petals: 5, seed: 7.1, warp: 0.35, a: '#1f9e8e', b: '#ffd02a', c: '#ff4f7a', al: 0.95 },
  { p: [-30, 12, -54], s: 48, petals: 6, seed: 7.7, warp: 0.36, a: '#2a6ee0', b: '#8a2ce0', c: '#ff8ac2', al: 0.9 },
  { p: [-8, -10, -50], s: 44, petals: 9, seed: 4.6, warp: 0.28, a: '#ff5a36', b: '#e02468', c: '#2a6ee0', al: 0.92 },
  { p: [24, 10, -44], s: 58, petals: 6, seed: 9.4, warp: 0.38, a: '#8a2ce0', b: '#ff8ac2', c: '#ffb02a', al: 0.94 },
  { p: [-26, 0, -38], s: 50, petals: 8, seed: 1.8, warp: 0.3, a: '#ff7a1f', b: '#d02ca0', c: '#1f9e8e', al: 0.92 },
  { p: [14, -12, -36], s: 34, petals: 7, seed: 0.9, warp: 0.32, a: '#1f9e8e', b: '#ff4f9a', c: '#ffd06a', al: 0.86 },
  { p: [8, 14, -32], s: 40, petals: 5, seed: 6.7, warp: 0.28, a: '#2a8ee0', b: '#ff4f7a', c: '#ffd06a', al: 0.88 },
  { p: [30, -6, -30], s: 42, petals: 8, seed: 3.9, warp: 0.3, a: '#e02446', b: '#ffb02a', c: '#5a2ce0', al: 0.88 },
  { p: [-14, -8, -26], s: 46, petals: 7, seed: 3.2, warp: 0.34, a: '#e0a01f', b: '#e02468', c: '#5a2ce0', al: 0.9 },
  { p: [22, 2, -20], s: 38, petals: 6, seed: 8.8, warp: 0.28, a: '#ff4f9a', b: '#8ae04f', c: '#ff8a2a', al: 0.86 },
  { p: [-4, 6, -16], s: 30, petals: 5, seed: 5.5, warp: 0.3, a: '#d02ca0', b: '#fff0d2', c: '#2a6ee0', al: 0.82 },
]

const SPHERES = [
  { p: [-9, -2, -40], r: 2.4, sp: 0.5 },
  { p: [8, 3, -22], r: 1.5, sp: 0.8 },
  { p: [-7, 5, -2], r: 1.9, sp: 0.6 },
  { p: [10, -4, 14], r: 2.8, sp: 0.4 },
  { p: [-10, 0, 34], r: 1.3, sp: 0.9 },
  { p: [7, 6, 52], r: 2.1, sp: 0.55 },
]

export default function Vessel() {
  const group = useRef()
  const dust = useRef()
  const glow = useRef()
  const flora = useRef([])
  const spheres = useRef([])

  useChamber(4, group, (state) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    flora.current.forEach((f, i) => {
      if (!f?.material) return
      f.material.uniforms.uTime.value = t
      f.material.uniforms.uWarp.value = FLORA[i].warp * (1 + a.mid * 0.5)
      const base = FLORA[i].s
      f.mesh.scale.setScalar(base * (1 + a.mid * 0.08 + Math.sin(t * 0.23 + i * 1.9) * 0.03))
      f.mesh.rotation.z = t * 0.022 * (i % 2 ? -1 : 1) + i * 1.2
    })
    spheres.current.forEach((m, i) => {
      if (!m) return
      const s = SPHERES[i]
      m.position.y = s.p[1] + Math.sin(t * s.sp + i * 2.1) * 1.6
      m.rotation.y = t * 0.3
    })
    const dm = dust.current?.material
    if (dm) {
      dm.uniforms.uTime.value = t
      dm.uniforms.uAudio.value = a.high * 0.4
    }
    if (glow.current?.material) {
      glow.current.material.uniforms.uTime.value = t
      glow.current.material.uniforms.uAlpha.value = 0.4 + a.low * 0.12
    }
  })

  return (
    <group ref={group} position={[0, 0, centerZ(4)]}>
      {FLORA.map((f, i) => (
        <PetalBloom
          key={i}
          ref={(r) => (flora.current[i] = r)}
          position={f.p}
          size={f.s}
          petals={f.petals}
          seed={f.seed}
          alpha={f.al}
          soft={1.35}
          warp={f.warp}
          fade={0.008}
          colorA={f.a}
          colorB={f.b}
          colorC={f.c}
        />
      ))}

      <mesh position={[0, -13.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[130, 190]} />
        <meshStandardMaterial color="#ddd2bf" roughness={0.95} metalness={0} />
      </mesh>

      {SPHERES.map((s, i) => (
        <mesh key={i} ref={(m) => (spheres.current[i] = m)} position={s.p}>
          <sphereGeometry args={[s.r, 48, 48]} />
          <meshPhysicalMaterial
            color="#ffffff"
            metalness={1}
            roughness={0.08}
            iridescence={0.9}
            iridescenceIOR={1.5}
            envMapIntensity={1.7}
          />
        </mesh>
      ))}

      <PetalBloom
        ref={glow}
        position={[0, 4, -72]}
        size={58}
        petals={0}
        seed={6.1}
        alpha={0.45}
        soft={1.7}
        colorA="#fff3dc"
        colorB="#ffc98f"
        colorC="#ff9a8a"
      />

      <ParticleField
        ref={dust}
        count={750}
        seed={91}
        box={[20, 16, 70]}
        size={0.8}
        amp={1.2}
        alpha={0.4}
        colorA="#fff0d2"
        colorB="#ffe2b0"
        fade={0.014}
      />

      <pointLight position={[0, 8, 24]} intensity={900} distance={90} color="#ffe2b8" decay={1.8} />
      <pointLight position={[0, 2, -50]} intensity={1300} distance={100} color="#ffc98f" decay={1.8} />
    </group>
  )
}
