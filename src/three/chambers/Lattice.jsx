import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import { rng } from '../rand'

// II — 10⁻¹⁰ m — the atomic lattice.
// A 7×7×7 grid of breathing chrome spheres, joined by faint bonds.
// A diagonal excitation wave rolls through the crystal forever.

const G = 7 // grid size
const STEP = 7 // spacing
const HALF = ((G - 1) * STEP) / 2

export default function Lattice() {
  const group = useRef()
  const inst = useRef()
  const sparks = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const { phases, bondPositions } = useMemo(() => {
    const r = rng(41)
    const phases = new Float32Array(G * G * G)
    for (let i = 0; i < phases.length; i++) phases[i] = r() * Math.PI * 2
    const pts = []
    const at = (x, y, z) => [x * STEP - HALF, y * STEP - HALF, z * STEP - HALF]
    for (let x = 0; x < G; x++)
      for (let y = 0; y < G; y++)
        for (let z = 0; z < G; z++) {
          if (x < G - 1) pts.push(...at(x, y, z), ...at(x + 1, y, z))
          if (y < G - 1) pts.push(...at(x, y, z), ...at(x, y + 1, z))
          if (z < G - 1) pts.push(...at(x, y, z), ...at(x, y, z + 1))
        }
    return { phases, bondPositions: new Float32Array(pts) }
  }, [])

  useEffect(() => {
    // initial placement so the first visible frame is correct
    let i = 0
    for (let x = 0; x < G; x++)
      for (let y = 0; y < G; y++)
        for (let z = 0; z < G; z++) {
          dummy.position.set(x * STEP - HALF, y * STEP - HALF, z * STEP - HALF)
          dummy.scale.setScalar(0.55)
          dummy.updateMatrix()
          inst.current.setMatrixAt(i++, dummy.matrix)
        }
    inst.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  useChamber(1, group, (state, dt, dCam) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    const span = (G - 1) * STEP * 1.732
    const wavePos = ((t * 9) % (span * 1.6)) - span * 0.3
    let i = 0
    for (let x = 0; x < G; x++)
      for (let y = 0; y < G; y++)
        for (let z = 0; z < G; z++) {
          const px = x * STEP - HALF
          const py = y * STEP - HALF
          const pz = z * STEP - HALF
          const diag = (px + py + pz) * 0.577 + span * 0.5
          const wave = Math.exp(-Math.pow(diag - wavePos, 2) * 0.02)
          const s =
            0.5 +
            0.16 * Math.sin(t * 1.25 + phases[i]) +
            a.low * 0.45 +
            wave * 0.85
          dummy.position.set(px, py, pz)
          dummy.scale.setScalar(s)
          dummy.updateMatrix()
          inst.current.setMatrixAt(i, dummy.matrix)
          i++
        }
    inst.current.instanceMatrix.needsUpdate = true

    group.current.rotation.y = t * 0.045
    group.current.rotation.x = Math.sin(t * 0.11) * 0.18

    const sm = sparks.current?.material
    if (sm) {
      sm.uniforms.uTime.value = t
      sm.uniforms.uAudio.value = a.high
    }
  })

  return (
    <group ref={group} position={[0, 0, centerZ(1)]}>
      <instancedMesh ref={inst} args={[null, null, G * G * G]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 3]} />
        <meshPhysicalMaterial
          color="#dde2ff"
          metalness={1}
          roughness={0.16}
          iridescence={1}
          iridescenceIOR={1.45}
          envMapIntensity={1.5}
        />
      </instancedMesh>
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={bondPositions.length / 3}
            array={bondPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#7fa8e8" transparent opacity={0.14} />
      </lineSegments>
      <ParticleField
        ref={sparks}
        count={700}
        seed={57}
        box={[24, 24, 24]}
        size={1.15}
        amp={1.1}
        alpha={0.65}
        colorA="#bfe0ff"
        colorB="#e8f2ff"
        fade={0.01}
      />
    </group>
  )
}
