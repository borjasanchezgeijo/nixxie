import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import { rng } from '../rand'

// II — 10⁻¹⁰ m — the atomic lattice.
// A 7×7×7 grid of breathing chrome spheres, joined by faint bonds.
// A diagonal excitation wave rolls through the crystal forever.
// Each atom is interactive: hover to highlight, click to send a
// spherical ripple outward through the bonded grid.

const G = 7 // grid size
const STEP = 7 // spacing
const HALF = ((G - 1) * STEP) / 2
const TOTAL = G * G * G

export default function Lattice() {
  const group = useRef()
  const inst = useRef()
  const sparks = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorTmp = useMemo(() => new THREE.Color(), [])

  // hover + ripples live in refs — they don't need to trigger React renders
  const hover = useRef(-1)
  const prevHover = useRef(-1)
  const ripples = useRef([])

  const { phases, bondPositions, baseColors } = useMemo(() => {
    const r = rng(41)
    const phases = new Float32Array(TOTAL)
    for (let i = 0; i < phases.length; i++) phases[i] = r() * Math.PI * 2

    // bond geometry
    const pts = []
    const at = (x, y, z) => [x * STEP - HALF, y * STEP - HALF, z * STEP - HALF]
    for (let x = 0; x < G; x++)
      for (let y = 0; y < G; y++)
        for (let z = 0; z < G; z++) {
          if (x < G - 1) pts.push(...at(x, y, z), ...at(x + 1, y, z))
          if (y < G - 1) pts.push(...at(x, y, z), ...at(x, y + 1, z))
          if (z < G - 1) pts.push(...at(x, y, z), ...at(x, y, z + 1))
        }

    // a few atoms wear a warmer hue — copper and gold guests in the crystal
    const c = new THREE.Color()
    const baseColors = new Float32Array(TOTAL * 3)
    const r2 = rng(43)
    for (let i = 0; i < TOTAL; i++) {
      const v = r2()
      const hex = v < 0.05 ? '#ffd0a0' : v < 0.09 ? '#ff9a78' : '#dde2ff'
      c.set(hex)
      baseColors[i * 3] = c.r
      baseColors[i * 3 + 1] = c.g
      baseColors[i * 3 + 2] = c.b
    }
    return { phases, bondPositions: new Float32Array(pts), baseColors }
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

    // seed per-instance base colors
    for (let j = 0; j < TOTAL; j++) {
      colorTmp.fromArray(baseColors, j * 3)
      inst.current.setColorAt(j, colorTmp)
    }
    if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true
  }, [dummy, baseColors, colorTmp])

  const setHover = (id) => {
    if (hover.current === id) return
    hover.current = id
    window.dispatchEvent(new CustomEvent('lattice-hot', { detail: { hot: id !== -1 } }))
  }

  const onPointerMove = (e) => {
    e.stopPropagation()
    setHover(e.instanceId ?? -1)
  }
  const onPointerOut = (e) => {
    e.stopPropagation()
    setHover(-1)
  }
  const onPointerDown = (e) => {
    e.stopPropagation()
    const id = e.instanceId
    if (id == null) return
    const gx = Math.floor(id / (G * G))
    const gy = Math.floor(id / G) % G
    const gz = id % G
    ripples.current.push({
      cx: gx * STEP - HALF,
      cy: gy * STEP - HALF,
      cz: gz * STEP - HALF,
      t0: performance.now() / 1000,
    })
    if (ripples.current.length > 6) ripples.current.shift()
  }

  useChamber(1, group, (state, dt, dCam) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    const span = (G - 1) * STEP * 1.732
    const wavePos = ((t * 9) % (span * 1.6)) - span * 0.3

    // expire dead ripples
    const live = ripples.current.filter((r) => t - r.t0 < 2.6)
    ripples.current = live

    const hoverId = hover.current
    const RIPPLE_SPEED = 26
    const RIPPLE_LIFE = 2.6
    const RIPPLE_WIDTH = 3.0

    let i = 0
    for (let x = 0; x < G; x++)
      for (let y = 0; y < G; y++)
        for (let z = 0; z < G; z++) {
          const px = x * STEP - HALF
          const py = y * STEP - HALF
          const pz = z * STEP - HALF
          const diag = (px + py + pz) * 0.577 + span * 0.5
          const wave = Math.exp(-Math.pow(diag - wavePos, 2) * 0.02)

          // additive spherical ripples from click points
          let ripple = 0
          for (let k = 0; k < live.length; k++) {
            const r = live[k]
            const age = t - r.t0
            const dx = px - r.cx
            const dy = py - r.cy
            const dz = pz - r.cz
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
            const front = age * RIPPLE_SPEED
            const ring = Math.exp(-Math.pow(dist - front, 2) / (RIPPLE_WIDTH * RIPPLE_WIDTH))
            ripple += ring * (1 - age / RIPPLE_LIFE) * 1.7
          }

          const hovered = i === hoverId
          const hoverBoost = hovered ? 0.55 : 0

          const s =
            0.5 +
            0.16 * Math.sin(t * 1.25 + phases[i]) +
            a.low * 0.45 +
            wave * 0.85 +
            ripple +
            hoverBoost
          dummy.position.set(px, py, pz)
          dummy.scale.setScalar(s)
          dummy.updateMatrix()
          inst.current.setMatrixAt(i, dummy.matrix)
          i++
        }
    inst.current.instanceMatrix.needsUpdate = true

    // restore previous hover color, brighten current hover
    if (prevHover.current !== hoverId) {
      if (prevHover.current !== -1 && prevHover.current < TOTAL) {
        colorTmp.fromArray(baseColors, prevHover.current * 3)
        inst.current.setColorAt(prevHover.current, colorTmp)
      }
      if (hoverId !== -1) {
        colorTmp.setRGB(1.4, 1.25, 1.05)
        inst.current.setColorAt(hoverId, colorTmp)
      }
      if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true
      prevHover.current = hoverId
    }

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
      <instancedMesh
        ref={inst}
        args={[null, null, TOTAL]}
        frustumCulled={false}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
      >
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
