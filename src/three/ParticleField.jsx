import { useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { SIMPLEX, IRIDESCENT } from './glsl'
import { rng, gauss } from './rand'

const VERT = /* glsl */ `
${SIMPLEX}
attribute float aSeed;
uniform float uTime;
uniform float uAmp;
uniform float uSize;
uniform float uAudio;
uniform float uFade;
varying float vSeed;
varying float vDim;
void main() {
  vSeed = aSeed;
  vec3 pos = position;
  float t = uTime * 0.05;
  vec3 dis = vec3(
    snoise(position * 0.035 + vec3(t, 0.0, 0.0)),
    snoise(position * 0.035 + vec3(0.0, t, 17.0)),
    snoise(position * 0.035 + vec3(0.0, 31.0, t))
  );
  pos += dis * uAmp * (1.0 + uAudio * 1.4);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;
  gl_PointSize = uSize * (0.55 + 0.9 * fract(aSeed * 7.31)) * (1.0 + uAudio) * (170.0 / max(dist, 1.0));
  vDim = exp(-pow(dist * uFade, 2.0));
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
${IRIDESCENT}
uniform float uTime;
uniform float uAlpha;
uniform float uShift;
uniform float uMode; // 0 = iridescent, 1 = two-color lerp
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vSeed;
varying float vDim;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  float disc = pow(1.0 - r, 2.2);
  float tw = 0.55 + 0.45 * sin(uTime * (0.9 + fract(vSeed * 3.7) * 2.6) + vSeed * 43.0);
  vec3 col;
  if (uMode < 0.5) {
    col = iridescent(fract(vSeed * 5.13) + uShift + uTime * 0.012);
  } else {
    col = mix(uColorA, uColorB, fract(vSeed * 9.7));
  }
  gl_FragColor = vec4(col, disc * tw * uAlpha * vDim);
}
`

// A reusable audio-reactive particle field.
// distribution: { box: [x,y,z] } | { shell: { radius, thickness } }
const ParticleField = forwardRef(function ParticleField(
  {
    count = 2000,
    seed = 1,
    box = [50, 30, 80],
    shell = null,
    size = 1.6,
    amp = 2.0,
    alpha = 0.8,
    shift = 0,
    additive = true,
    colorA = null,
    colorB = null,
    fade = 0.012,
    ...props
  },
  outerRef
) {
  const matRef = useRef()
  useImperativeHandle(outerRef, () => ({ material: matRef.current }))

  const { positions, seeds } = useMemo(() => {
    const r = rng(seed * 7919 + 13)
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      if (shell) {
        const th = Math.acos(2 * r() - 1)
        const ph = r() * Math.PI * 2
        const rad = shell.radius + gauss(r) * shell.thickness
        positions[i * 3] = Math.sin(th) * Math.cos(ph) * rad
        positions[i * 3 + 1] = Math.cos(th) * rad
        positions[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * rad
      } else {
        positions[i * 3] = (r() * 2 - 1) * box[0]
        positions[i * 3 + 1] = (r() * 2 - 1) * box[1]
        positions[i * 3 + 2] = (r() * 2 - 1) * box[2]
      }
      seeds[i] = r()
    }
    return { positions, seeds }
  }, [count, seed, shell, box[0], box[1], box[2]])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: amp },
      uSize: { value: size },
      uAudio: { value: 0 },
      uAlpha: { value: alpha },
      uShift: { value: shift },
      uFade: { value: fade },
      uMode: { value: colorA ? 1 : 0 },
      uColorA: { value: new THREE.Color(colorA || '#ffffff') },
      uColorB: { value: new THREE.Color(colorB || colorA || '#ffffff') },
    }),
    []
  )

  return (
    <points {...props} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aSeed" count={count} array={seeds} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  )
})

export default ParticleField
