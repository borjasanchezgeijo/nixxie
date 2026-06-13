import { CHAMBERS, N, wrapDelta } from '../config/chambers'
import { useWorldState, sup } from './useWorldState'

// Chapter title cards — the museum's only language.
// Each card breathes in around its chamber's center and out again.
export default function Titles() {
  const { p, entered } = useWorldState()
  if (!entered) return null

  let best = 0
  let bestDist = 1
  CHAMBERS.forEach((_, i) => {
    const d = Math.abs(wrapDelta(p, (i + 0.5) / N))
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  })

  const c = CHAMBERS[best]
  const dN = bestDist * N // 0 at center .. 0.5 at edge
  const vis = Math.max(0, 1 - Math.pow(dN / 0.42, 2))
  if (vis <= 0.01) return null

  const ink = c.ink === 'dark' ? 'var(--ink-dark)' : 'var(--ink-light)'

  return (
    <div
      className="title-card"
      style={{
        color: ink,
        opacity: vis,
        transform: `translateY(${(1 - vis) * 1.4}rem)`,
      }}
    >
      <span className="numeral">ROOM {c.numeral}</span>
      <div className="name">{c.name}</div>
      <div className="sub">{c.subtitle}</div>
      <div className="scaleline">10{sup(c.exponent)} m</div>
    </div>
  )
}
