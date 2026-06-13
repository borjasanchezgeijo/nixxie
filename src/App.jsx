import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import Experience from './three/Experience'
import { attachInput } from './core/world'
import Entry from './ui/Entry'
import Titles from './ui/Titles'
import Ruler from './ui/Ruler'
import Hud from './ui/Hud'
import Cursor from './ui/Cursor'
import MobileCard from './ui/MobileCard'

function Precompile() {
  // compile every chamber's materials behind the entry curtain,
  // so no chamber ever stutters on first approach. Chambers re-assert
  // their own visibility every frame, so flipping it here is safe.
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const id = setTimeout(() => {
      scene.traverse((o) => (o.visible = true))
      gl.compile(scene, camera)
    }, 60)
    return () => clearTimeout(id)
  }, [gl, scene, camera])
  return null
}

export default function App() {
  const [mobile] = useState(
    () => window.matchMedia('(max-width: 880px)').matches || 'ontouchstart' in window && window.innerWidth < 1100
  )
  const stage = useRef()

  useEffect(() => {
    if (mobile || !stage.current) return
    return attachInput(stage.current)
  }, [mobile])

  if (mobile) return <MobileCard />

  return (
    <div className="stage" ref={stage}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 60, near: 0.1, far: 320, position: [0, 0, 0] }}
      >
        <Experience />
        <Precompile />
      </Canvas>
      <Titles />
      <Ruler />
      <Hud />
      <Entry />
      <Cursor />
    </div>
  )
}
