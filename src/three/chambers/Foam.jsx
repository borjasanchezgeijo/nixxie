import { useRef } from 'react'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import PetalBloom from '../PetalBloom'

// I — 10⁻³⁵ m — quantum foam.
// A homogeneous shimmer of iridescent probability. Rendered twice
// (zOffset 0 and -TRAVEL) so the loop seam is invisible: the field
// is seeded, so both copies are identical.

const WISPS = [
  { pos: [-22, 10, -30], size: 70, seed: 3.1, a: '#3b1d66', b: '#16d4e0', c: '#ff4fa0' },
  { pos: [26, -12, 10], size: 88, seed: 7.7, a: '#1d2a66', b: '#b04fff', c: '#28e0c8' },
  { pos: [-10, -18, 48], size: 62, seed: 5.2, a: '#43135c', b: '#ff6ec0', c: '#3fc8ff' },
  { pos: [18, 16, -58], size: 76, seed: 9.4, a: '#10306b', b: '#7adfff', c: '#c95cff' },
  { pos: [0, 4, 70], size: 58, seed: 2.6, a: '#371a5e', b: '#ff8fd0', c: '#52e8ff' },
]

export default function Foam({ zOffset = 0 }) {
  const group = useRef()
  const coarse = useRef()
  const fine = useRef()
  const wisps = useRef([])

  useChamber(0, group, (state, dt, d) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    const cm = coarse.current?.material
    if (cm) {
      cm.uniforms.uTime.value = t
      cm.uniforms.uAudio.value = a.high * 0.9 + a.level * 0.3
    }
    const fm = fine.current?.material
    if (fm) {
      fm.uniforms.uTime.value = t * 1.4
      fm.uniforms.uAudio.value = a.high * 1.3
    }
    wisps.current.forEach((w, i) => {
      if (!w?.material) return
      w.material.uniforms.uTime.value = t
      w.material.uniforms.uAlpha.value = 0.09 + a.mid * 0.07
      w.mesh.rotation.z = t * 0.02 * (i % 2 ? 1 : -1) + i
    })
    if (group.current) group.current.rotation.z = t * 0.008
  })

  return (
    <group ref={group} position={[0, 0, centerZ(0) + zOffset]}>
      <ParticleField
        ref={coarse}
        count={20000}
        seed={11}
        box={[60, 36, 92]}
        size={1.8}
        amp={3.2}
        alpha={0.8}
        shift={0}
        fade={0.011}
      />
      <ParticleField
        ref={fine}
        count={7000}
        seed={23}
        box={[40, 26, 92]}
        size={0.85}
        amp={4.5}
        alpha={0.5}
        shift={0.28}
        fade={0.013}
      />
      {WISPS.map((w, i) => (
        <PetalBloom
          key={i}
          ref={(r) => (wisps.current[i] = r)}
          position={w.pos}
          size={w.size}
          petals={0}
          seed={w.seed}
          alpha={0.1}
          soft={2.4}
          colorA={w.a}
          colorB={w.b}
          colorC={w.c}
          additive
        />
      ))}
    </group>
  )
}
