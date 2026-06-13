import { useState } from 'react'
import { world } from '../core/world'
import { startAudio } from '../audio/AudioEngine'

const LETTERS = 'SCALE'.split('')

export default function Entry() {
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)
  if (gone) return null

  const enter = async () => {
    setLeaving(true)
    world.entered = true
    try {
      await startAudio()
    } catch (e) {
      // audio matters but its absence should never lock the door
      console.warn('audio failed to start', e)
    }
    setTimeout(() => setGone(true), 2400)
  }

  return (
    <div className={`entry${leaving ? ' leaving' : ''}`}>
      <div className="blob a" />
      <div className="blob b" />
      <div className="blob c" />
      <div className="e-scale-note">10⁻³⁵ m ⟶ 10²⁶ m</div>
      <h1 className="e-title" aria-label="SCALE">
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            style={{
              '--ry': `${(i - 2) * 9}deg`,
              '--tz': `${(2 - Math.abs(i - 2)) * 46}px`,
              '--d': `${0.5 + i * 0.13}s`,
            }}
          >
            {ch}
          </span>
        ))}
      </h1>
      <button className="e-enter" onClick={enter} disabled={leaving}>
        ENTER
      </button>
    </div>
  )
}
