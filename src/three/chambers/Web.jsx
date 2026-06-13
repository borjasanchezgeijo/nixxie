import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import PetalBloom from '../PetalBloom'
import { SIMPLEX, IRIDESCENT } from '../glsl'
import { rng, gauss } from '../rand'

// X — 10²⁶ m — and it resembles the beginning.
// The cosmic web: galaxies strung along filaments between glowing
// nodes. As the camera passes through, every point lets go of its
// filament and drifts into a uniform shimmer — quantum foam — and
// the loop closes. The seam is a dissolve, not a cut.

const COUNT = 24000
const NODES = 16

const VERT = /* glsl */ `
${SIMPLEX}
attribute vec3 aAlt;
attribute float aSeed;
uniform float uTime;
uniform float uDissolve;
uniform float uAudio;
varying float vSeed;
varying float vDim;
void main() {
  vSeed = aSeed;
  float lag = fract(aSeed * 13.7) * 0.35; // points let go at slightly different times
  float dis = smoothstep(lag, 1.0, uDissolve);
  dis = dis * dis * (3.0 - 2.0 * dis);
  vec3 pos = mix(position, aAlt, dis);
  float t = uTime * 0.05;
  pos += vec3(
    snoise(pos * 0.04 + vec3(t, 0.0, 0.0)),
    snoise(pos * 0.04 + vec3(0.0, t, 17.0)),
    snoise(pos * 0.04 + vec3(0.0, 31.0, t))
  ) * (1.2 + dis * 2.2) * (1.0 + uAudio);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;
  gl_PointSize = (1.5 + dis * 0.4) * (0.55 + 0.9 * fract(aSeed * 7.31)) * (1.0 + uAudio * 0.8) * (170.0 / max(dist, 1.0));
  vDim = exp(-pow(dist * 0.011, 2.0));
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
${IRIDESCENT}
uniform float uTime;
varying float vSeed;
varying float vDim;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  float disc = pow(1.0 - r, 2.2);
  float tw = 0.55 + 0.45 * sin(uTime * (0.9 + fract(vSeed * 3.7) * 2.6) + vSeed * 43.0);
  vec3 col = iridescent(fract(vSeed * 5.13) + uTime * 0.012);
  gl_FragColor = vec4(col, disc * tw * 0.82 * vDim);
}
`

export default function Web() {
  const group = useRef()
  const mat = useRef()
  const glows = useRef([])

  const { positions, alts, seeds, nodePts } = useMemo(() => {
    const r = rng(199)
    const nodePts = []
    for (let i = 0; i < NODES; i++) {
      // z biased to +30..-86 so filaments never bleed back into the Star chamber
      nodePts.push(
        new THREE.Vector3((r() * 2 - 1) * 56, (r() * 2 - 1) * 34, 30 - r() * 116)
      )
    }
    // strands: connect nearby node pairs with a bowed quadratic curve
    const strands = []
    for (let i = 0; i < NODES; i++) {
      for (let j = i + 1; j < NODES; j++) {
        if (nodePts[i].distanceTo(nodePts[j]) < 75 && r() < 0.72) {
          const mid = nodePts[i].clone().add(nodePts[j]).multiplyScalar(0.5)
          mid.x += gauss(r) * 14
          mid.y += gauss(r) * 10
          mid.z += gauss(r) * 14
          strands.push(new THREE.QuadraticBezierCurve3(nodePts[i], mid, nodePts[j]))
        }
      }
    }
    const positions = new Float32Array(COUNT * 3)
    const alts = new Float32Array(COUNT * 3)
    const seeds = new Float32Array(COUNT)
    const clusterShare = Math.floor(COUNT * 0.22)
    for (let i = 0; i < COUNT; i++) {
      let v
      if (i < clusterShare) {
        const n = nodePts[Math.floor(r() * NODES)]
        v = new THREE.Vector3(n.x + gauss(r) * 4.2, n.y + gauss(r) * 4.2, n.z + gauss(r) * 4.2)
      } else {
        const s = strands[Math.floor(r() * strands.length)]
        v = s.getPoint(r())
        v.x += gauss(r) * 1.4
        v.y += gauss(r) * 1.4
        v.z += gauss(r) * 1.4
      }
      positions[i * 3] = v.x
      positions[i * 3 + 1] = v.y
      positions[i * 3 + 2] = v.z
      // the foam-like target: a homogeneous box matching chamber I's field
      alts[i * 3] = (r() * 2 - 1) * 60
      alts[i * 3 + 1] = (r() * 2 - 1) * 36
      alts[i * 3 + 2] = 30 - r() * 122
      seeds[i] = r()
    }
    return { positions, alts, seeds, nodePts }
  }, [])

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uDissolve: { value: 0 }, uAudio: { value: 0 } }),
    []
  )

  useChamber(9, group, (state, dt, d) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    uniforms.uTime.value = t
    uniforms.uAudio.value = a.high * 0.9 + a.level * 0.3
    // d goes 0 → +1.7 as the camera leaves the chamber toward the seam
    const dissolve = THREE.MathUtils.smoothstep(d, 0.15, 1.25)
    uniforms.uDissolve.value = dissolve
    group.current.rotation.z = t * 0.006
    glows.current.forEach((g, i) => {
      if (!g?.material) return
      g.material.uniforms.uTime.value = t
      g.material.uniforms.uAlpha.value = (0.2 + a.mid * 0.12) * (1 - dissolve)
    })
  })

  return (
    <group ref={group} position={[0, 0, centerZ(9)]}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-aAlt" count={COUNT} array={alts} itemSize={3} />
          <bufferAttribute attach="attributes-aSeed" count={COUNT} array={seeds} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          ref={mat}
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {nodePts.map((n, i) => (
        <PetalBloom
          key={i}
          ref={(r) => (glows.current[i] = r)}
          position={[n.x, n.y, n.z]}
          size={9 + (i % 4) * 3}
          petals={0}
          seed={i * 2.13}
          alpha={0.22}
          soft={2.4}
          colorA="#3b1d66"
          colorB="#b04fff"
          colorC="#28b8e0"
          additive
        />
      ))}
    </group>
  )
}
