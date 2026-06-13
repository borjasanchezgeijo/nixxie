import { CHAMBERS, N, wrapDelta, segOf } from '../config/chambers'
import { world } from '../core/world'
import { useWorldState, sup } from './useWorldState'

// The progress bar is a scale ruler: ten orders of magnitude,
// the marker is *you*. Ticks are doors — click one to travel.
export default function Ruler() {
  const { p, entered } = useWorldState()
  if (!entered) return null

  const seg = segOf(p)
  const ink = CHAMBERS[seg].ink === 'dark' ? 'var(--ink-dark)' : 'var(--ink-light)'

  const travelTo = (i) => {
    const center = (i + 0.5) / N
    world.target = world.current + wrapDelta(center, world.p)
    world.hasScrolled = true
  }

  return (
    <div className="ruler" style={{ color: ink }}>
      <div className="ticks">
        {CHAMBERS.map((c, i) => (
          <button
            key={c.id}
            className={`tick${i === seg ? ' active' : ''}`}
            style={{ top: `${((i + 0.5) / N) * 100}%` }}
            onClick={() => travelTo(i)}
            aria-label={`Travel to room ${c.numeral} — ${c.name}`}
          >
            10{sup(c.exponent)}
          </button>
        ))}
      </div>
      <div className="track">
        <div className="marker" style={{ top: `${p * 100}%` }} />
      </div>
    </div>
  )
}
