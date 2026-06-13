import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import PetalBloom from '../PetalBloom'
import { SIMPLEX } from '../glsl'

// VII — 10⁶ m — the ground becomes a map.
// Flying over a procedural continent at dusk: pine valleys, sand,
// snowcaps, slivers of glinting water, clouds drifting below the eye.

const TERRA_VERT = /* glsl */ `
${SIMPLEX}
uniform float uTime;
varying float vH;
varying vec2 vXY;
varying float vDist;
void main() {
  vec2 xy = position.xy;
  float e = fbm(vec3(xy * 0.016, 3.7)) * 8.0;
  e += pow(1.0 - abs(snoise(vec3(xy * 0.008, 9.1))), 2.2) * 7.5;
  e += snoise(vec3(xy * 0.05, 1.3)) * 0.8;
  float h = max(e, 0.4); // water table
  vec3 pos = vec3(position.x, position.y, h);
  vH = e;
  vXY = xy;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const TERRA_FRAG = /* glsl */ `
${SIMPLEX}
uniform float uTime;
uniform vec3 uFog;
uniform float uFogD;
varying float vH;
varying vec2 vXY;
varying float vDist;
void main() {
  vec3 col;
  float n = snoise(vec3(vXY * 0.08, 2.0)) * 0.5;
  if (vH < 0.4) {
    float glint = pow(max(snoise(vec3(vXY * 0.3, uTime * 0.35)), 0.0), 5.0);
    col = vec3(0.12, 0.30, 0.34) + glint * vec3(0.95, 0.82, 0.5);
  } else {
    vec3 pine = vec3(0.10, 0.22, 0.15);
    vec3 sage = vec3(0.38, 0.44, 0.26);
    vec3 sand = vec3(0.74, 0.62, 0.42);
    vec3 snow = vec3(0.96, 0.94, 0.9);
    col = mix(pine, sage, smoothstep(0.4, 4.2, vH + n));
    col = mix(col, sand, smoothstep(4.2, 8.0, vH + n));
    col = mix(col, snow, smoothstep(9.5, 12.5, vH + n));
  }
  // dusk sun from the west
  float sun = 0.78 + 0.3 * smoothstep(-60.0, 60.0, vXY.x);
  col *= sun * vec3(1.06, 0.98, 0.9);
  float fogF = 1.0 - exp(-pow(vDist * uFogD * 1.15, 2.0));
  // dissolve the plane's rim into the fog so its edge never reads as a cut
  float edgeF = smoothstep(52.0, 88.0, abs(vXY.y));
  edgeF = max(edgeF, smoothstep(100.0, 126.0, abs(vXY.x)));
  col = mix(col, uFog, clamp(max(fogF, edgeF), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`

const CLOUDS = [
  { p: [-26, -2, -48], s: 26 },
  { p: [18, 2, -30], s: 20 },
  { p: [-10, -4, -8], s: 30 },
  { p: [30, 0, 12], s: 22 },
  { p: [-32, 2, 32], s: 26 },
  { p: [8, -3, 48], s: 18 },
  { p: [22, 4, 64], s: 24 },
]

export default function Terra() {
  const group = useRef()
  const mat = useRef()
  const clouds = useRef([])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFog: { value: new THREE.Color('#1c1410') },
      uFogD: { value: 0.009 },
    }),
    []
  )

  useChamber(6, group, (state) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    uniforms.uTime.value = t
    if (state.scene.fog) {
      uniforms.uFog.value.copy(state.scene.fog.color)
      uniforms.uFogD.value = state.scene.fog.density
    }
    clouds.current.forEach((c, i) => {
      if (!c?.material) return
      c.material.uniforms.uTime.value = t
      c.material.uniforms.uAlpha.value = 0.3 + a.mid * 0.08
      c.mesh.position.x = CLOUDS[i].p[0] + Math.sin(t * 0.04 + i * 2.0) * 6
      c.mesh.scale.set(CLOUDS[i].s, CLOUDS[i].s * 0.45, 1)
    })
  })

  return (
    <group ref={group} position={[0, 0, centerZ(6)]}>
      {/* low enough that the tallest peaks stay clear of the camera's near plane;
          deep enough that the camera is already over terrain when the room opens */}
      <mesh position={[0, -22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[260, 190, 220, 170]} />
        <shaderMaterial ref={mat} vertexShader={TERRA_VERT} fragmentShader={TERRA_FRAG} uniforms={uniforms} />
      </mesh>
      {CLOUDS.map((c, i) => (
        <PetalBloom
          key={i}
          ref={(r) => (clouds.current[i] = r)}
          position={c.p}
          size={c.s}
          petals={0}
          seed={i * 1.37}
          alpha={0.42}
          soft={2.2}
          colorA="#fff4e2"
          colorB="#f2ddc2"
          colorC="#e8c9a8"
        />
      ))}
    </group>
  )
}
