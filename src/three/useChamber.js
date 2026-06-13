import { useFrame } from '@react-three/fiber'
import { world } from '../core/world'
import { N, SPACING, wrapDelta } from '../config/chambers'

// Per-chamber frame hook. Toggles group visibility when the camera is
// within ±1.7 chamber-lengths, and hands the callback the signed
// distance d from the chamber center (d = 0 → camera at center).
export function useChamber(index, groupRef, onFrame) {
  const center = (index + 0.5) / N
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const d = wrapDelta(world.p, center) * N
    const visible = Math.abs(d) < 1.7
    if (groupRef.current) groupRef.current.visible = visible
    if (visible && onFrame) onFrame(state, dt, d)
  })
}

export const centerZ = (index) => -(index + 0.5) * SPACING
