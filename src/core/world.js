// Mutable world state, read every frame by the GL scene and (throttled) by the UI.
// Scroll is virtual: wheel / touch / keys accumulate into `target`,
// `current` chases it, both live on an unwrapped number line so the
// loop seam never produces a smoothing glitch.

const LOOP_PIXELS = 42000 // one full loop ≈ this much wheel travel

export const world = {
  target: 0,
  current: 0,
  velocity: 0, // progress units / second
  p: 0, // wrapped progress [0,1)
  entered: false,
  muted: false,
  started: false,
  hasScrolled: false,
  pointer: { x: 0, y: 0 }, // normalized -1..1
  audio: { low: 0, mid: 0, high: 0, level: 0 },
  quality: 1,
}

const PROGRESS_PER_PIXEL = 1 / LOOP_PIXELS

export function nudge(pixels) {
  if (!world.entered) return
  world.target += pixels * PROGRESS_PER_PIXEL
  if (Math.abs(pixels) > 2) world.hasScrolled = true
}

export function stepWorld(dt) {
  // critically-damped chase
  const k = 1 - Math.exp(-dt * 2.6)
  const before = world.current
  world.current += (world.target - world.current) * k
  world.velocity = dt > 0 ? (world.current - before) / dt : 0
  // keep the unwrapped line near zero to preserve float precision forever
  if (world.current > 4 && world.target > 4) {
    world.current -= 4
    world.target -= 4
  }
  if (world.current < -4 && world.target < -4) {
    world.current += 4
    world.target += 4
  }
  world.p = ((world.current % 1) + 1) % 1
}

// dev/testing hook: jump straight to a progress value
if (typeof window !== 'undefined') {
  window.__setProgress = (p) => {
    world.entered = true
    world.target = p
    world.current = p
    world.hasScrolled = true
  }
}

export function attachInput(el) {
  const onWheel = (e) => {
    e.preventDefault()
    nudge(e.deltaY)
  }
  let lastY = null
  const onTouchStart = (e) => {
    lastY = e.touches[0].clientY
  }
  const onTouchMove = (e) => {
    if (lastY == null) return
    const y = e.touches[0].clientY
    nudge((lastY - y) * 2.2)
    lastY = y
  }
  const onTouchEnd = () => {
    lastY = null
  }
  const onKey = (e) => {
    const big = window.innerHeight * 0.9
    if (e.code === 'ArrowDown') nudge(160)
    else if (e.code === 'ArrowUp') nudge(-160)
    else if (e.code === 'PageDown' || e.code === 'Space') nudge(big)
    else if (e.code === 'PageUp') nudge(-big)
  }
  const onMove = (e) => {
    world.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    world.pointer.y = (e.clientY / window.innerHeight) * 2 - 1
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: true })
  el.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('keydown', onKey)
  window.addEventListener('pointermove', onMove)
  return () => {
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('pointermove', onMove)
  }
}
