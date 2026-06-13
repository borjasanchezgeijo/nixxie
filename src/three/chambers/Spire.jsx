import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import { rng } from '../rand'

// VI — 10⁴ m — geometry grows ambitious.
// A dusk city of black crystal towers, each wearing one strip of
// magenta light. A corridor through the middle lets the camera pass.

const COUNT = 110

export default function Spire() {
  const group = useRef()
  const towers = useRef()
  const strips = useRef()
  const flies = useRef()
  const stripMat = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const layout = useMemo(() => {
    const r = rng(113)
    const items = []
    for (let i = 0; i < COUNT; i++) {
      let x = (r() * 2 - 1) * 52
      if (Math.abs(x) < 8) x = Math.sign(x || 1) * (8 + r() * 6)
      const z = (r() * 2 - 1) * 72
      const h = 10 + r() * 34
      const w = 1.1 + r() * 2.4
      items.push({ x, z, h, w, ph: r() * Math.PI * 2 })
    }
    return items
  }, [])

  useEffect(() => {
    layout.forEach((it, i) => {
      dummy.position.set(it.x, -25 + it.h / 2, it.z)
      dummy.scale.set(it.w, it.h, it.w)
      dummy.rotation.set(0, it.ph * 0.2, 0)
      dummy.updateMatrix()
      towers.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(it.x + it.w * 0.42, -25 + it.h / 2, it.z + it.w * 0.42)
      dummy.scale.set(0.16, it.h * 0.92, 0.16)
      dummy.updateMatrix()
      strips.current.setMatrixAt(i, dummy.matrix)
    })
    towers.current.instanceMatrix.needsUpdate = true
    strips.current.instanceMatrix.needsUpdate = true
  }, [layout, dummy])

  useChamber(5, group, (state) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    if (stripMat.current) {
      const pulse = 0.55 + a.high * 1.4 + Math.sin(t * 2.1) * 0.1
      stripMat.current.color.setRGB(1.0 * pulse, 0.32 * pulse, 0.72 * pulse)
    }
    const fm = flies.current?.material
    if (fm) {
      fm.uniforms.uTime.value = t
      fm.uniforms.uAudio.value = a.high * 0.8
    }
  })

  return (
    <group ref={group} position={[0, 0, centerZ(5)]}>
      <instancedMesh ref={towers} args={[null, null, COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color="#171024"
          metalness={0.85}
          roughness={0.32}
          envMapIntensity={1.1}
        />
      </instancedMesh>
      <instancedMesh ref={strips} args={[null, null, COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial ref={stripMat} color="#ff52b8" toneMapped={false} />
      </instancedMesh>

      <mesh position={[0, -25.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[160, 180]} />
        <meshStandardMaterial color="#120a18" roughness={0.6} metalness={0.5} envMapIntensity={0.6} />
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
