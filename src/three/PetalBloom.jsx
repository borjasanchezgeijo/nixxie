import { useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { SIMPLEX } from './glsl'

const VERT = /* glsl */ `
varying vec2 vUv;
varying float vDist;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
${SIMPLEX}
uniform float uTime;
uniform float uSeed;
uniform float uPetals;
uniform float uAlpha;
uniform float uSoft;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uFade;
uniform float uWarp;
varying vec2 vUv;
varying float vDist;
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  // domain warp — petals melt and smear instead of staying radial
  q += uWarp * vec2(
    snoise(vec3(q * 1.3 + uSeed * 3.0, uTime * 0.07)),
    snoise(vec3(q * 1.3 - uSeed * 2.0, uTime * 0.07 + 31.0))
  );
  float r = length(q);
  float a = atan(q.y, q.x);
  float n = 0.0;
  n += 0.6 * snoise(vec3(q * 1.7, uTime * 0.06 + uSeed * 7.0));
  n += 0.3 * snoise(vec3(q * 3.4, uTime * 0.09 + uSeed * 13.0));
  float petal = 1.0;
  if (uPetals > 0.5) {
    petal = 0.62 + 0.38 * pow(abs(cos(a * uPetals * 0.5 + uSeed * 6.28 + uTime * 0.05)), 0.85);
  }
  float rad = (0.62 + n * 0.16) * petal;
  float m = 1.0 - smoothstep(0.0, rad, r);
  m = pow(m, uSoft);
  vec3 col = mix(uColorA, uColorB, clamp(r * 1.5 + n * 0.45, 0.0, 1.0));
  float swirl = clamp(0.5 + 0.5 * sin(a * 2.0 + n * 3.0 + uSeed * 9.0), 0.0, 1.0);
  col = mix(col, uColorC, swirl * 0.45);
  float dim = exp(-pow(vDist * uFade, 2.0));
  gl_FragColor = vec4(col, m * uAlpha * dim);
}
`

// A defocused gradient bloom — the museum's softest material.
// petals = 0 renders a pure radial blob (clouds, coronas, glows);
// petals >= 4 renders a blurred flower silhouette.
const PetalBloom = forwardRef(function PetalBloom(
  {
    size = 30,
    petals = 6,
    seed = 0,
    alpha = 0.8,
    soft = 1.6,
    colorA = '#ff4fa0',
    colorB = '#ffb37a',
    colorC = '#b9a8ff',
    additive = false,
    fade = 0.011,
    warp = 0,
    ...props
  },
  outerRef
) {
  const matRef = useRef()
  const meshRef = useRef()
  useImperativeHandle(outerRef, () => ({ material: matRef.current, mesh: meshRef.current }))

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: seed },
      uPetals: { value: petals },
      uAlpha: { value: alpha },
      uSoft: { value: soft },
      uFade: { value: fade },
      uWarp: { value: warp },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uColorC: { value: new THREE.Color(colorC) },
    }),
    []
  )

  return (
    <mesh ref={meshRef} scale={size} frustumCulled={false} {...props}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </mesh>
  )
})

export default PetalBloom
