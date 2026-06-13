import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { world } from '../../core/world'
import { useChamber, centerZ } from '../useChamber'
import ParticleField from '../ParticleField'
import PetalBloom from '../PetalBloom'
import { SIMPLEX } from '../glsl'

// IX — 10⁹ m — the only lamp.
// A roiling plasma sphere, HDR-bright so the bloom pass ignites it.
// The generative score drops to its lowest register here; the surface
// breathes with the bass and a deep pulse beats every few seconds.

const SUN_VERT = /* glsl */ `
${SIMPLEX}
uniform float uTime;
uniform float uLow;
varying vec3 vP;
varying vec3 vN;
varying vec3 vV;
varying float vDist;
void main() {
  vP = normalize(position);
  float n = fbm(vP * 2.4 + vec3(0.0, uTime * 0.06, 0.0));
  vec3 pos = position * (1.0 + n * (0.04 + uLow * 0.05));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const SUN_FRAG = /* glsl */ `
${SIMPLEX}
uniform float uTime;
uniform float uLow;
uniform vec3 uFog;
uniform float uFogD;
varying vec3 vP;
varying vec3 vN;
varying vec3 vV;
varying float vDist;
void main() {
  vec3 p = vP;
  float f1 = fbm(p * 3.0 + vec3(0.0, uTime * 0.10, 0.0));
  float f2 = fbm(p * 7.0 - vec3(uTime * 0.14, 0.0, 0.0) + f1 * 0.8);
  float gran = pow(abs(snoise(p * 15.0 + vec3(0.0, 0.0, uTime * 0.22))), 2.0) * 0.35;
  float heat = clamp(0.52 + f1 * 0.45 + f2 * 0.35 + gran + uLow * 0.45, 0.0, 1.6);
  vec3 col = mix(vec3(0.32, 0.05, 0.02), vec3(1.0, 0.33, 0.1), smoothstep(0.0, 0.62, heat));
  col = mix(col, vec3(1.0, 0.83, 0.6), smoothstep(0.62, 1.0, heat));
  col = mix(col, vec3(1.0, 0.96, 0.9), smoothstep(0.98, 1.35, heat));
  float limb = pow(abs(dot(normalize(vN), normalize(vV))), 0.55);
  col *= limb;
  float fogF = 1.0 - exp(-pow(vDist * uFogD, 2.0));
  vec3 lit = mix(col * 1.65, uFog, fogF);
  gl_FragColor = vec4(lit, 1.0);
}
`

export default function Star() {
  const group = useRef()
  const corona1 = useRef()
  const corona2 = useRef()
  const flares = useRef()

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLow: { value: 0 },
      uFog: { value: new THREE.Color('#0a0303') },
      uFogD: { value: 0.009 },
    }),
    []
  )

  useChamber(8, group, (state) => {
    const t = state.clock.elapsedTime
    const a = world.audio
    uniforms.uTime.value = t
    uniforms.uLow.value = a.low
    if (state.scene.fog) {
      uniforms.uFog.value.copy(state.scene.fog.color)
      uniforms.uFogD.value = state.scene.fog.density
    }

    if (corona1.current?.material) {
      corona1.current.material.uniforms.uTime.value = t
      corona1.current.material.uniforms.uAlpha.value = 0.5 + a.low * 0.3
      corona1.current.mesh.scale.setScalar(72 * (1 + a.low * 0.12))
    }
    if (corona2.current?.material) {
      corona2.current.material.uniforms.uTime.value = t * 0.6
      corona2.current.material.uniforms.uAlpha.value = 0.16 + a.low * 0.1
      corona2.current.mesh.rotation.z = t * 0.01
    }
    const fm = flares.current?.material
    if (fm) {
      fm.uniforms.uTime.value = t
      fm.uniforms.uAudio.value = a.low * 1.5
    }
  })

  return (
    <group ref={group} position={[0, 0, centerZ(8)]}>
      <group position={[15, 1, -30]}>
        <mesh>
          <sphereGeometry args={[13, 128, 128]} />
          <shaderMaterial vertexShader={SUN_VERT} fragmentShader={SUN_FRAG} uniforms={uniforms} />
        </mesh>
        <PetalBloom
          ref={corona1}
          size={72}
          petals={0}
          seed={3.3}
          alpha={0.5}
          soft={2.0}
          colorA="#ff8a30"
          colorB="#ff4f2a"
          colorC="#ffc24f"
          additive
        />
        <PetalBloom
          ref={corona2}
          size={120}
          petals={0}
          seed={7.9}
          alpha={0.16}
          soft={2.6}
          colorA="#b8302a"
          colorB="#ff4fa0"
          colorC="#ff8a4f"
          additive
        />
        <ParticleField
          ref={flares}
          count={1500}
          seed={151}
          shell={{ radius: 16.5, thickness: 3.2 }}
          size={1.5}
          amp={2.8}
          alpha={0.7}
          colorA="#ff9a40"
          colorB="#ffd9a8"
          fade={0.008}
        />
      </group>
    </group>
  )
}
