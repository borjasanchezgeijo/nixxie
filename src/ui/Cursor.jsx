import { useEffect, useRef } from 'react'

// A dot that is exactly where you are, a ring that is where you
// just were. Difference-blended so it survives every background.
export default function Cursor() {
  const dot = useRef()
  const ring = useRef()

  useEffect(() => {
    let x = innerWidth / 2
    let y = innerHeight / 2
    let rx = x
    let ry = y
    let raf
    let sceneHot = false
    const onMove = (e) => {
      x = e.clientX
      y = e.clientY
      const interactive = e.target.closest?.('button, a, .tick')
      ring.current?.classList.toggle('hot', !!interactive || sceneHot)
    }
    const onSceneHot = (e) => {
      sceneHot = !!e.detail?.hot
      ring.current?.classList.toggle('hot', sceneHot)
    }
    const tick = () => {
      raf = requestAnimationFrame(tick)
      rx += (x - rx) * 0.14
      ry += (y - ry) * 0.14
      if (dot.current) dot.current.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`
      if (ring.current) ring.current.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('lattice-hot', onSceneHot)
    tick()
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('lattice-hot', onSceneHot)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <div ref={dot} className="cursor-dot" />
      <div ref={ring} className="cursor-ring" />
    </>
  )
}
