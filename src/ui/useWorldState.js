import { useEffect, useState } from 'react'
import { world } from '../core/world'

// Throttled bridge from the mutable world to React — re-renders only
// when something the UI cares about actually moves.
export function useWorldState() {
  const [s, setS] = useState({ p: 0, entered: false, hasScrolled: false, muted: false })
  useEffect(() => {
    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      setS((prev) => {
        if (
          Math.abs(world.p - prev.p) > 0.00035 ||
          world.entered !== prev.entered ||
          world.hasScrolled !== prev.hasScrolled ||
          world.muted !== prev.muted
        ) {
          return { p: world.p, entered: world.entered, hasScrolled: world.hasScrolled, muted: world.muted }
        }
        return prev
      })
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
  return s
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '.': '·' }
export const sup = (n) =>
  String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('')
