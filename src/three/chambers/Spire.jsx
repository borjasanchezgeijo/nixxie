import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import { rng } from '../rand'

// VI — 10⁴ m — geometry grows ambitious.
// A dusk city of black crystal towers rises from the floor and hangs
// from the ceiling, each wearing one strip of magenta light. A
// corridor through the middle lets the camera pass.

const COUNT_FLOOR = 110
const COUNT_CEIL = 70
const FLOOR_Y = -25
const CEIL_Y = 25

export default function Spire() {
  const group = useRef()
  const towers = useRef()
  const strips = useRef()
  const ceilTowers = useRef()
  const ceilStrips = useRef()
  const flies = useRef()
  const stripMat = useRef()
  const ceilStripMat = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const buildLayout = (seed, count) => {
    const r = rng(seed)
    const items = []
    for (let i = 0; i < count; i++) {
      let x = (r() * 2 - 1) * 52
      if (Math.abs(x) < 8) x = Math.sign(x || 1) * (8 + r() * 6)
      const z = (r() * 2 - 1) * 72
      const h = 10 + r() * 34
      const w = 1.1 + r() * 2.4
      items.push({ x, z, h, w, ph: r() * Math.PI * 2 })
    }
    return items
  }

  const floor = useMemo(() => buildLayout(113, COUNT_FLOOR), [])
  // ceiling spires are slightly shorter on average so they don't crowd the floor
  const ceil = useMemo(() => {
    const r = rng(311)
    const items = []
    for (let i = 0; i < COUNT_CEIL; i++) {
      let x = (r() * 2 - 1) * 54
      if (Math.abs(x) < 8) x = Math.sign(x || 1) * (8 + r() * 6)
      const z = (r() * 2 - 1) * 72
      const h = 8 + r() * 26
      const w = 1.0 + r() * 2.1
      items.push({ x, z, h, w, ph: r() * Math.PI * 2 })
    }
    return items
  }, [])

  useEffect(() => {
    floor.forEach((it, i) => {
      dummy.position.set(it.x, FLOOR_Y + it.h / 2, it.z)
      dummy.scale.set(it.w, it.h, it.w)
      dummy.rotation.set(0, it.ph * 0.2, 0)
      dummy.updateMatrix()
      towers.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(it.x + it.w * 0.42, FLOOR_Y + it.h / 2, it.z + it.w * 0.42)
      dummy.scale.set(0.16, it.h * 0.92, 0.16)
      dummy.updateMatrix()
      strips.current.setMatrixAt(i, dummy.matrix)
    })
    towers.current.instanceMatrix.needsUpdate = true
    strips.current.instanceMatrix.needsUpdate = true

    ceil.forEach((it, i) => {
      dummy.position.set(it.x, CEIL_Y - it.h / 2, it.z)
      dummy.scale.set(it.w, it.h, it.w)
      dummy.rotation.set(0, it.ph * 0.2, 0)
      dummy.updateMatrix()
      ceilTowers.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(it.x + it.w * 0.42, CEIL_Y - it.h / 2, it.z + it.w * 0.42)
      dummy.scale.set(0.16, it.h * 0.92, 0.16)
      dummy.updateMatrix()
      ceilStrips.current.setMatrixAt(i, dummy.matrix)
    })
    ceilTowers.current.instanceMatrix.needsUpdate = true
    ceilStrips.current.instanceMatrix.needsUpdate = true
  }, [floor, ceil, dummy])

  useChamber(5, group, (state) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    const pulse = 0.55 + a.high * 1.4 + Math.sin(t * 2.1) * 0.1
    if (stripMat.current) {
      stripMat.current.color.setRGB(1.0 * pulse, 0.32 * pulse, 0.72 * pulse)
    }
    if (ceilStripMat.current) {
      // ceiling strips drift one beat ahead — the city answers itself
      const cp = 0.5 + a.high * 1.3 + Math.sin(t * 2.1 + 1.7) * 0.1
      ceilStripMat.current.color.setRGB(0.72 * cp, 0.36 * cp, 1.0 * cp)
    }
    const fm = flies.current?.material
    if (fm) {
      fm.uniforms.uTime.value = t
      fm.uniforms.uAudio.value = a.high * 0.8
    }
  })

  return (
    <group ref={group} position={[0, 0, centerZ(5)]}>
      <instancedMesh ref={towers} args={[null, null, COUNT_FLOOR]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color="#171024"
          metalness={0.85}
          roughness={0.32}
          envMapIntensity={1.1}
        />
      </instancedMesh>
      <instancedMesh ref={strips} args={[null, null, COUNT_FLOOR]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial ref={stripMat} color="#ff52b8" toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={ceilTowers} args={[null, null, COUNT_CEIL]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color="#120a1c"
          metalness={0.85}
          roughness={0.34}
          envMapIntensity={1.0}
        />
      </instancedMesh>
      <instancedMesh ref={ceilStrips} args={[null, null, COUNT_CEIL]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial ref={ceilStripMat} color="#b85cff" toneMapped={false} />
      </instancedMesh>

      <mesh position={[0, FLOOR_Y - 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[160, 180]} />
        <meshStandardMaterial color="#120a18" roughness={0.6} metalness={0.5} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[0, CEIL_Y + 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[160, 180]} />
        <meshStandardMaterial color="#0e0716" roughness={0.7} metalness={0.45} envMapIntensity={0.55} />
      </mesh>

      <ParticleField
        ref={flies}
        count={650}
        seed={127}
        box={[44, 26, 70]}
        size={1.2}
        amp={2.6}
        alpha={0.6}
        colorA="#ff6ec0"
        colorB="#b96aff"
        fade={0.011}
      />
    </group>
  )
}
