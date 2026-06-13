import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { world, stepWorld } from '../core/world'
import { updateAudio } from '../audio/AudioEngine'
import { CHAMBERS, N, TRAVEL } from '../config/chambers'

import Foam from './chambers/Foam'
import Lattice from './chambers/Lattice'
import Membrane from './chambers/Membrane'
import BloomChamber from './chambers/Bloom'
import Vessel from './chambers/Vessel'
import Spire from './chambers/Spire'
import Terra from './chambers/Terra'
import Sphere from './chambers/Sphere'
import Star from './chambers/Star'
import Web from './chambers/Web'

function CameraRig() {
  const { camera } = useThree()
  const par = useRef({ x: 0, y: 0 })
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    stepWorld(dt)
    updateAudio(dt)
    const p = world.p

    // gentle periodic sway — integer frequencies so the loop seam is seamless
    const swayX = Math.sin(p * Math.PI * 2 * 2) * 3.2
    const swayY = Math.cos(p * Math.PI * 2 * 3) * 1.6

    // pointer parallax, critically damped
    const k = 1 - Math.exp(-dt * 3.2)
    par.current.x += (world.pointer.x - par.current.x) * k
    par.current.y += (world.pointer.y - par.current.y) * k

    camera.position.set(
      swayX + par.current.x * 2.4,
      swayY - par.current.y * 1.4,
      -p * TRAVEL
    )
    camera.rotation.set(
      -par.current.y * 0.05,
      -par.current.x * 0.07 + Math.sin(p * Math.PI * 2) * 0.04,
      Math.sin(p * Math.PI * 2 * 2) * 0.015
    )
  }, -2)
  return null
}

function Atmosphere() {
  const { scene } = useThree()
  const colors = useMemo(() => CHAMBERS.map((c) => new THREE.Color(c.bg)), [])
  const tmp = useMemo(() => new THREE.Color(), [])
  const fog = useMemo(() => new THREE.FogExp2('#070310', 0.02), [])

  useFrame(() => {
    const p = world.p
    // sample piecewise between chamber centers (center i at (i+0.5)/N)
    const x = ((p * N - 0.5) % N + N) % N
    const i0 = Math.floor(x) % N
    const i1 = (i0 + 1) % N
    let t = x - Math.floor(x)
    t = t * t * (3 - 2 * t) // smoothstep
    tmp.lerpColors(colors[i0], colors[i1], t)
    if (!scene.background) scene.background = new THREE.Color()
    scene.background.copy(tmp)
    scene.fog = fog
    fog.color.copy(tmp)
    fog.density = CHAMBERS[i0].fog + (CHAMBERS[i1].fog - CHAMBERS[i0].fog) * t
  }, -1)
  return null
}

function Studio() {
  // a self-contained environment map: violet / cyan / peach light strips
  // give every chrome surface the museum's iridescent reflections.
  return (
    <Environment frames={1} resolution={256}>
      <color attach="background" args={['#0a0a12']} />
      <Lightformer intensity={3.2} position={[0, 5, -9]} scale={[10, 10, 1]} color="#fff5e8" />
      <Lightformer intensity={2.4} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} color="#b9a8ff" />
      <Lightformer intensity={2.4} position={[5, -1, -1]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} color="#7adfff" />
      <Lightformer intensity={1.8} position={[0, -5, 2]} scale={[12, 4, 1]} color="#ffb37a" />
      <Lightformer form="ring" intensity={2.2} position={[0, 2, 8]} scale={4} color="#ff4fa0" />
    </Environment>
  )
}

export default function Experience() {
  return (
    <>
      <CameraRig />
      <Atmosphere />
      <Studio />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 6]} intensity={0.7} color="#fff2e2" />

      <Foam zOffset={0} />
      <Foam zOffset={-TRAVEL} />
      <Lattice />
      <Membrane />
      <BloomChamber />
      <Vessel />
      <Spire />
      <Terra />
      <Sphere />
      <Star />
      <Web />

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.65} luminanceThreshold={0.82} luminanceSmoothing={0.2} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.00045, 0.00045]} />
        <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.5} />
        <Vignette eskil={false} offset={0.16} darkness={0.5} />
      </EffectComposer>
    </>
  )
}

