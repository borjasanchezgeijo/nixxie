import { CHAMBERS, N, segOf, wrapDelta } from '../config/chambers'
import { setMuted } from '../audio/AudioEngine'
import { useWorldState, sup } from './useWorldState'

// Quiet instruments: the live order-of-magnitude readout,
// the sound toggle, and the scroll hint that retires itself.
export default function Hud() {
  const { p, entered, hasScrolled, muted } = useWorldState()
  if (!entered) return null

  const seg = segOf(p)
  const ink = CHAMBERS[seg].ink === 'dark' ? 'var(--ink-dark)' : 'var(--ink-light)'

  // live exponent: lerp between chamber exponents, flickering at the seam
  const x = (((p * N - 0.5) % N) + N) % N
  const i0 = Math.floor(x) % N
  const i1 = (i0 + 1) % N
  const t = x - Math.floor(x)
  let expText
  if (i0 === N - 1) {
    // the seam: 10²⁶ collapses into 10⁻³⁵
    const flicker = Math.sin(performance.now() * 0.02) > 0
    expText = t < 0.5 ? sup(26) : flicker ? sup(26) : sup(-35)
  } else {
    const val = CHAMBERS[i0].exponent + (CHAMBERS[i1].exponent - CHAMBERS[i0].exponent) * t
    expText = sup(val.toFixed(1))
  }

  return (
    <>
      <div className="hud exponent" style={{ color: ink }}>
        ≈ 10{expText} m
      </div>
      <button className="hud sound" style={{ color: ink }} onClick={() => setMuted(!muted)}>
        {muted ? 'SOUND  ·  OFF' : 'SOUND  ·  ON'}
      </button>
      <div className={`hint${hasScrolled ? '' : ' show'}`} style={{ color: ink }}>
        <span>SCROLL</span>
        <span className="line" />
      </div>
    </>
  )
}
