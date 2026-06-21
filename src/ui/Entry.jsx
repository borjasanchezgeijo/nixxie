import { useState } from 'react'
import { world } from '../core/world'
import { startAudio } from '../audio/AudioEngine'

const LETTERS = "LILY’S GARDEN".split('')
const MID = (LETTERS.length - 1) / 2

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
      <h1 className="e-title" aria-label="Lily’s Garden">
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            style={{
              '--ry': `${(i - MID) * 4}deg`,
              '--tz': `${(MID - Math.abs(i - MID)) * 18}px`,
              '--d': `${0.5 + i * 0.07}s`,
            }}
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
      </h1>
      <button className="e-enter" onClick={enter} disabled={leaving}>
        ENTER
      </button>
    </div>
  )
}
