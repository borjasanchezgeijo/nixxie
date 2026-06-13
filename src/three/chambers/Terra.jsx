import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import PetalBloom from '../PetalBloom'
import { SIMPLEX } from '../glsl'

// VII — 10⁶ m — the ground becomes a map.
// Flying over a procedural continent at dusk: pine valleys, sand,
// snowcaps, slivers of glinting water, animated swells, drifting
// herds in the lowlands, and clusters of warm city lights at the
// foot of the foothills. The terrain only rises in the interior so
// its rim dissolves into the fog of the preceding room.

const TERRA_VERT = /* glsl */ `
${SIMPLEX}
uniform float uTime;
varying float vH;
varying float vRaw;
varying vec2 vXY;
varying vec2 vWave;
varying float vDist;
void main() {
  vec2 xy = position.xy;
  float e = fbm(vec3(xy * 0.016, 3.7)) * 8.0;
  e += pow(1.0 - abs(snoise(vec3(xy * 0.008, 9.1))), 2.2) * 7.5;
  e += snoise(vec3(xy * 0.05, 1.3)) * 0.8;
  // ramp terrain elevation toward the center — the rim stays at water
  // level so the plane edge reads as a fading shoreline, not a cut.
  float rim = smoothstep(0.0, 70.0, 150.0 - max(abs(xy.y), abs(xy.x) * 0.78));
  vRaw = e;
  e *= rim * rim;
  float h = max(e, 0.4); // water table
  // animated micro-swell on the water — picked up by the fragment shader
  // through the displaced height (small enough not to break the silhouette)
  if (e <= 0.42) {
    float w = snoise(vec3(xy * 0.18, uTime * 0.6)) * 0.04
            + snoise(vec3(xy * 0.32, uTime * 0.4 + 13.0)) * 0.025;
    h += w;
    vWave = vec2(
      snoise(vec3(xy * 0.5, uTime * 0.7)),
      snoise(vec3(xy * 0.5 + 11.0, uTime * 0.6))
    );
  } else {
    vWave = vec2(0.0);
  }
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
varying float vRaw;
varying vec2 vXY;
varying vec2 vWave;
varying float vDist;

// pseudo-random for stable per-cell jitter
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 col;
  float n = snoise(vec3(vXY * 0.08, 2.0)) * 0.5;
  if (vH < 0.4) {
    // animated water — depth gradient, Fresnel-like brighten near grazing
    // angles, and sharp sun glint moving with the swell
    vec3 deep = vec3(0.04, 0.16, 0.24);
    vec3 shallow = vec3(0.12, 0.34, 0.40);
    float shoreFalloff = smoothstep(0.4, 0.42, vRaw);
    vec3 water = mix(deep, shallow, 1.0 - smoothstep(-0.2, 0.4, vRaw + n * 0.3));
    // micro highlight from the wave normal proxy
    float micro = clamp(0.5 + 0.5 * (vWave.x + vWave.y), 0.0, 1.0);
    water += vec3(0.18, 0.22, 0.26) * pow(micro, 6.0);
    // sun glint — bright moving specks
    float glintField = snoise(vec3(vXY * 0.25 + vWave * 0.6, uTime * 0.45));
    float glint = pow(max(glintField, 0.0), 8.0);
    water += glint * vec3(1.0, 0.86, 0.55) * 1.6;
    // shoreline lift
    water = mix(water, vec3(0.42, 0.50, 0.40), shoreFalloff * 0.35);
    col = water;
  } else {
    vec3 pine = vec3(0.10, 0.22, 0.15);
    vec3 sage = vec3(0.38, 0.44, 0.26);
    vec3 sand = vec3(0.74, 0.62, 0.42);
    vec3 snow = vec3(0.96, 0.94, 0.9);
    col = mix(pine, sage, smoothstep(0.4, 4.2, vH + n));
    col = mix(col, sand, smoothstep(4.2, 8.0, vH + n));
    col = mix(col, snow, smoothstep(9.5, 12.5, vH + n));

    // migration herds — slow-moving dark specks in low valleys (vH 0.6..3.0)
    if (vH > 0.6 && vH < 3.0) {
      vec2 hp = floor(vXY * 0.45 + vec2(uTime * 0.08, uTime * 0.05));
      float h1 = hash(hp);
      vec2 jitter = vec2(hash(hp + 5.1), hash(hp + 9.7)) - 0.5;
      vec2 cell = fract(vXY * 0.45 + vec2(uTime * 0.08, uTime * 0.05)) - 0.5 - jitter * 0.7;
      float herd = smoothstep(0.16, 0.0, length(cell));
      herd *= step(0.86, h1);
      col = mix(col, vec3(0.08, 0.06, 0.05), herd * 0.55);
    }

    // distant villages — clustered warm pinprick lights at foothills (vH 1.5..5.5)
    if (vH > 1.5 && vH < 5.5) {
      vec2 cp = floor(vXY * 0.9);
      float c1 = hash(cp);
      vec2 cInner = fract(vXY * 0.9) - 0.5;
      float spark = smoothstep(0.10, 0.0, length(cInner));
      spark *= step(0.92, c1);
      // additional small twinkle within the village cluster
      float twinkle = 0.6 + 0.4 * sin(uTime * 2.4 + c1 * 32.0);
      col = mix(col, vec3(1.0, 0.74, 0.36), spark * 0.85 * twinkle);
    }
  }
  // dusk sun from the west
  float sun = 0.78 + 0.3 * smoothstep(-80.0, 80.0, vXY.x);
  col *= sun * vec3(1.06, 0.98, 0.9);
  float fogF = 1.0 - exp(-pow(vDist * uFogD * 1.4, 2.0));
  // dissolve the plane's rim into the fog so its edge never reads as a cut
  float edgeF = smoothstep(35.0, 130.0, abs(vXY.y));
  edgeF = max(edgeF, smoothstep(95.0, 170.0, abs(vXY.x)));
  col = mix(col, uFog, clamp(max(fogF, edgeF), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`

// clouds: a wide drift in the chamber interior + a low mist band at the
// seam toward the spire so the entry into terra is wrapped in vapor
const CLOUDS = [
  { p: [-26, -2, -48], s: 26 },
  { p: [18, 2, -30], s: 20 },
  { p: [-10, -4, -8], s: 30 },
  { p: [30, 0, 12], s: 22 },
  { p: [-32, 2, 32], s: 26 },
  { p: [8, -3, 48], s: 18 },
  { p: [22, 4, 64], s: 24 },
  // seam mist (positive local z, closer to spire) — sit lower in the world
  { p: [-42, -10, 90], s: 46 },
  { p: [32, -8, 105], s: 42 },
  { p: [-4, -12, 78], s: 50 },
  { p: [18, -10, 70], s: 30 },
  { p: [-22, -8, 110], s: 36 },
  { p: [44, -12, 84], s: 32 },
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
      {/* large enough that the rim-elevation fade can take 50+ units to
          dissolve the mountains back into the seam — no visible cut */}
      <mesh position={[0, -22, -25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[320, 320, 260, 260]} />
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
