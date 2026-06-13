import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import { rng } from '../rand'

// The floor / ceiling slab — softly elliptical so its rectangular rim
// dissolves into fog before a neighbouring chamber can see it.
const SLAB_VERT = /* glsl */ `
varying vec2 vXY;
varying float vDist;
void main() {
  vXY = position.xy;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`
const SLAB_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uFog;
uniform float uFogD;
varying vec2 vXY;
varying float vDist;
void main() {
  float ex = length(vXY * vec2(1.0 / 95.0, 1.0 / 105.0));
  float edge = smoothstep(0.55, 1.0, ex);
  float fog = 1.0 - exp(-pow(vDist * uFogD * 1.4, 2.0));
  vec3 col = mix(uBase, uFog, clamp(max(edge, fog), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`

// VI — 10⁴ m — geometry grows ambitious.
// A dense dusk city of black crystal towers rises from the floor and
// hangs from the ceiling; each wears one strip of magenta light. As
// the camera scrolls through, the towers gently reach toward it —
// floor towers rise, ceiling towers descend — so the room breathes
// instead of standing still like a movie set.

const COUNT_FLOOR = 320
const COUNT_CEIL = 220
const FLOOR_Y = -25
const CEIL_Y = 25

const buildLayout = (seed, count, opts) => {
  const r = rng(seed)
  const items = []
  for (let i = 0; i < count; i++) {
    let x = (r() * 2 - 1) * opts.xSpread
    if (Math.abs(x) < 7) x = Math.sign(x || 1) * (7 + r() * 5)
    const z = (r() * 2 - 1) * opts.zSpread
    const h = opts.hMin + r() * opts.hRange
    const w = opts.wMin + r() * opts.wRange
    items.push({
      x,
      z,
      h,
      w,
      ph: r() * Math.PI * 2,
      // organic per-tower scroll response: amplitude, frequency, phase
      reachAmp: 0.10 + r() * 0.16,
      bobAmp: 0.025 + r() * 0.03,
      bobFreq: 0.4 + r() * 0.5,
    })
  }
  return items
}

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

  const floorUniforms = useMemo(
    () => ({
      uBase: { value: new THREE.Color('#120a18') },
      uFog: { value: new THREE.Color('#190a1e') },
      uFogD: { value: 0.015 },
    }),
    []
  )
  const ceilingUniforms = useMemo(
    () => ({
      uBase: { value: new THREE.Color('#0e0716') },
      uFog: { value: new THREE.Color('#190a1e') },
      uFogD: { value: 0.015 },
    }),
    []
  )

  const floor = useMemo(
    () =>
      buildLayout(113, COUNT_FLOOR, {
        xSpread: 92,
        zSpread: 110,
        hMin: 8,
        hRange: 38,
        wMin: 1.0,
        wRange: 2.6,
      }),
    []
  )
  const ceil = useMemo(
    () =>
      buildLayout(311, COUNT_CEIL, {
        xSpread: 94,
        zSpread: 110,
        hMin: 7,
        hRange: 28,
        wMin: 0.9,
        wRange: 2.2,
      }),
    []
  )

  // initial placement so the first visible frame is correct even before
  // the per-frame update runs.
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

  // smoothed scroll-velocity drives an extra "reach" — towers stretch
  // toward the camera when the user is actively moving through.
  const reachState = useRef(0)

  useChamber(5, group, (state, dt, d) => {
    const t = state.clock.elapsedTime
    const a = world.audio

    // chamber proximity: 1 at center, 0 at ±1.6 edges
    const prox = Math.max(0, 1 - Math.pow(d / 1.3, 2))
    // outside-chamber presence: 1 inside, drops to 0 by |d|≈1.0 so
    // neighbouring chambers don't see the dense city as a smear.
    const ad = Math.abs(d)
    let presence = 1 - (ad - 0.4) / 0.6
    presence = Math.max(0, Math.min(1, presence))
    presence = presence * presence * (3 - 2 * presence) // smoothstep
    // tiny floor so degenerate matrices don't cause flicker
    const visH = Math.max(0.001, presence)
    if (state.scene.fog) {
      floorUniforms.uFog.value.copy(state.scene.fog.color)
      floorUniforms.uFogD.value = state.scene.fog.density
      ceilingUniforms.uFog.value.copy(state.scene.fog.color)
      ceilingUniforms.uFogD.value = state.scene.fog.density
    }
    // smooth a velocity-tracking reach signal
    const target = Math.min(1, Math.abs(world.velocity) * 0.7)
    reachState.current += (target - reachState.current) * (1 - Math.exp(-dt * 4))
    const reach = reachState.current

    // floor towers grow from the floor (anchored at FLOOR_Y) so they
    // never extend above where they should be visible — at presence=0
    // they shrink to ~zero height and disappear into the slab.
    floor.forEach((it, i) => {
      const effH = it.h * visH
      const lift =
        prox * it.h * it.reachAmp +
        Math.sin(t * it.bobFreq + it.ph) * it.h * it.bobAmp * visH +
        reach * it.h * 0.05 +
        a.low * it.h * 0.04 * visH
      const y = FLOOR_Y + effH / 2 + lift
      dummy.position.set(it.x, y, it.z)
      dummy.scale.set(it.w, effH, it.w)
      dummy.rotation.set(0, it.ph * 0.2 + t * 0.005, 0)
      dummy.updateMatrix()
      towers.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(it.x + it.w * 0.42, y, it.z + it.w * 0.42)
      dummy.scale.set(0.16, effH * 0.92, 0.16)
      dummy.rotation.set(0, it.ph * 0.2 + t * 0.005, 0)
      dummy.updateMatrix()
      strips.current.setMatrixAt(i, dummy.matrix)
    })
    towers.current.instanceMatrix.needsUpdate = true
    strips.current.instanceMatrix.needsUpdate = true

    // ceiling towers grow downward from the ceiling
    ceil.forEach((it, i) => {
      const effH = it.h * visH
      const drop =
        prox * it.h * it.reachAmp +
        Math.sin(t * it.bobFreq + it.ph + 1.6) * it.h * it.bobAmp * visH +
        reach * it.h * 0.05 +
        a.low * it.h * 0.04 * visH
      const y = CEIL_Y - effH / 2 - drop
      dummy.position.set(it.x, y, it.z)
      dummy.scale.set(it.w, effH, it.w)
      dummy.rotation.set(0, it.ph * 0.2 - t * 0.005, 0)
      dummy.updateMatrix()
      ceilTowers.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(it.x + it.w * 0.42, y, it.z + it.w * 0.42)
      dummy.scale.set(0.16, effH * 0.92, 0.16)
      dummy.rotation.set(0, it.ph * 0.2 - t * 0.005, 0)
      dummy.updateMatrix()
      ceilStrips.current.setMatrixAt(i, dummy.matrix)
    })
    ceilTowers.current.instanceMatrix.needsUpdate = true
    ceilStrips.current.instanceMatrix.needsUpdate = true

    const pulse = 0.55 + a.high * 1.4 + Math.sin(t * 2.1) * 0.1
    if (stripMat.current) {
      stripMat.current.color.setRGB(1.0 * pulse, 0.32 * pulse, 0.72 * pulse)
    }
    if (ceilStripMat.current) {
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
        <planeGeometry args={[230, 260]} />
        <shaderMaterial vertexShader={SLAB_VERT} fragmentShader={SLAB_FRAG} uniforms={floorUniforms} />
      </mesh>
      <mesh position={[0, CEIL_Y + 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[230, 260]} />
        <shaderMaterial vertexShader={SLAB_VERT} fragmentShader={SLAB_FRAG} uniforms={ceilingUniforms} />
      </mesh>

      <ParticleField
        ref={flies}
        count={900}
        seed={127}
        box={[60, 30, 110]}
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
