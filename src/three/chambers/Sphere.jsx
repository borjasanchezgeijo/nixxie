import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import { SIMPLEX } from '../glsl'

// VIII — 10⁷ m — one round room.
// A pastel planet hangs off the path with a breathing atmosphere,
// night-side cities glittering, and a small chrome moon in orbit.

const PLANET_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying float vDist;
void main() {
  vN = normalize(normalMatrix * normal);
  vP = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const PLANET_FRAG = /* glsl */ `
${SIMPLEX}
uniform float uTime;
uniform vec3 uSun; // view-space sun direction
uniform vec3 uFog;
uniform float uFogD;
varying vec3 vN;
varying vec3 vP;
varying float vDist;
void main() {
  vec3 p = vP;
  float cont = fbm(p * 2.2 + vec3(4.7));
  float land = smoothstep(0.02, 0.14, cont);
  vec3 ocean = mix(vec3(0.07, 0.27, 0.33), vec3(0.12, 0.42, 0.46), smoothstep(-0.4, 0.0, cont));
  vec3 soil = mix(vec3(0.78, 0.55, 0.42), vec3(0.88, 0.71, 0.52), fbm(p * 5.0 + 8.0));
  vec3 col = mix(ocean, soil, land);
  float ice = smoothstep(0.68, 0.85, abs(p.y) + cont * 0.08);
  col = mix(col, vec3(0.93, 0.92, 0.9), ice);
  float cloud = smoothstep(0.25, 0.6, fbm(p * 3.4 + vec3(uTime * 0.02, 0.0, uTime * 0.013)));
  col = mix(col, vec3(0.97), cloud * 0.55);

  float light = dot(normalize(vN), normalize(uSun)) * 0.5 + 0.5;
  light = pow(light, 1.4);
  float night = 1.0 - smoothstep(0.25, 0.55, light);
  vec3 lit = col * (0.06 + light * 1.1);
  float spark = pow(max(snoise(p * 38.0), 0.0), 7.0) * land * night * (1.0 - cloud);
  lit += spark * vec3(1.0, 0.75, 0.45) * 2.4;
  // dusk terminator blush
  float term = smoothstep(0.32, 0.5, light) * (1.0 - smoothstep(0.5, 0.68, light));
  lit += term * vec3(0.45, 0.18, 0.12);
  float fogF = 1.0 - exp(-pow(vDist * uFogD, 2.0));
  lit = mix(lit, uFog, fogF);
  gl_FragColor = vec4(lit, 1.0);
}
`

const ATMO_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying float vDist;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const ATMO_FRAG = /* glsl */ `
uniform float uBreath;
varying vec3 vN;
varying vec3 vV;
varying float vDist;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.2);
  vec3 col = mix(vec3(0.35, 0.6, 1.0), vec3(0.7, 0.85, 1.0), rim);
  float dim = exp(-pow(vDist * 0.009, 2.0));
  gl_FragColor = vec4(col, rim * (0.55 + uBreath * 0.25) * dim);
}
`

export default function Sphere() {
  const group = useRef()
  const planet = useRef()
  const moon = useRef()
  const stars = useRef()

  const planetUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(0.8, 0.3, 0.6) },
      uFog: { value: new THREE.Color('#04060f') },
      uFogD: { value: 0.006 },
    }),
    []
  )
  const atmoUniforms = useMemo(() => ({ uBreath: { value: 0 } }), [])

  useChamber(7, group, (state) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    planetUniforms.uTime.value = t
    atmoUniforms.uBreath.value = a.low
    if (state.scene.fog) {
      planetUniforms.uFog.value.copy(state.scene.fog.color)
      planetUniforms.uFogD.value = state.scene.fog.density
    }
    if (planet.current) planet.current.rotation.y = t * 0.03
    if (moon.current) {
      moon.current.position.set(Math.cos(t * 0.09) * 19, Math.sin(t * 0.13) * 4, Math.sin(t * 0.09) * 19)
    }
    const sm = stars.current?.material
    if (sm) {
      sm.uniforms.uTime.value = t
      sm.uniforms.uAudio.value = a.high * 0.3
    }
  })

  return (
    <group ref={group} position={[0, 0, centerZ(7)]}>
      <group position={[-14, 2, -30]}>
        <mesh ref={planet}>
          <sphereGeometry args={[11, 128, 128]} />
          <shaderMaterial vertexShader={PLANET_VERT} fragmentShader={PLANET_FRAG} uniforms={planetUniforms} />
        </mesh>
        <mesh scale={1.13}>
          <sphereGeometry args={[11, 64, 64]} />
          <shaderMaterial
            vertexShader={ATMO_VERT}
            fragmentShader={ATMO_FRAG}
            uniforms={atmoUniforms}
            transparent
            depthWrite={false}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh ref={moon}>
          <sphereGeometry args={[1.5, 48, 48]} />
          <meshPhysicalMaterial
            color="#ffffff"
            metalness={1}
            roughness={0.12}
            iridescence={1}
            iridescenceIOR={1.5}
            envMapIntensity={1.6}
          />
        </mesh>
      </group>

      <ParticleField
        ref={stars}
        count={3000}
        seed={139}
        box={[120, 70, 110]}
        size={0.85}
        amp={0.25}
        alpha={0.75}
        colorA="#cdd8ff"
        colorB="#ffffff"
        fade={0.005}
      />
    </group>
  )
}
