import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, ShaderMaterial } from 'three';
import type { LakeDef, Palette } from '@game/shared';
import { useQuality } from '../store/quality';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  varying vec2 vLake;
  varying vec3 vWorld;
  varying float vWave;

  void main() {
    vLake = position.xy;
    float r = length(position.xy);
    float shoreCalm = 1.0 - smoothstep(uRadius - 13.0, uRadius, r);
    float w1 = sin(position.x * 0.105 + uTime * 1.15) * cos(position.y * 0.082 - uTime * 0.82);
    float w2 = sin((position.x + position.y) * 0.17 - uTime * 1.42) * 0.48;
    float w3 = cos(position.x * 0.035 - position.y * 0.12 + uTime * 0.55) * 0.3;
    vWave = (w1 + w2 + w3) / 1.78;
    vec3 p = position;
    p.z += vWave * 0.24 * shoreCalm;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  varying vec2 vLake;
  varying vec3 vWorld;
  varying float vWave;

  void main() {
    float r = length(vLake);
    if (r > uRadius) discard;

    float deepness = 1.0 - smoothstep(uRadius - 34.0, uRadius, r);
    vec3 water = mix(uShallow, uDeep, deepness);
    float ripple = sin(r * 0.32 - uTime * 2.2 + vWave * 3.0) * 0.5 + 0.5;
    water += vec3(0.025, 0.055, 0.075) * ripple * (0.25 + deepness * 0.35);

    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - abs(viewDir.y), 2.4);
    water = mix(water, uSky, fresnel * 0.62);
    float glint = pow(max(0.0, ripple * 0.72 + fresnel * 0.52 - 0.62), 5.0);
    water += vec3(0.34, 0.5, 0.62) * glint;

    float outer = smoothstep(uRadius - 5.5, uRadius - 1.1, r) * (1.0 - smoothstep(uRadius - 1.1, uRadius, r));
    float inner = smoothstep(uRadius - 10.5, uRadius - 8.2, r) * (1.0 - smoothstep(uRadius - 7.3, uRadius - 5.3, r));
    float broken = 0.52 + 0.48 * sin(vLake.x * 0.42 + vLake.y * 0.31 + uTime * 1.3);
    float foam = clamp(outer * (0.62 + broken * 0.38) + inner * broken * 0.42, 0.0, 1.0);
    water = mix(water, vec3(0.78, 0.9, 0.91), foam * 0.82);

    float edgeAlpha = 1.0 - smoothstep(uRadius - 0.65, uRadius, r);
    float alpha = (0.8 + fresnel * 0.12 + foam * 0.08) * edgeAlpha;
    gl_FragColor = vec4(water, alpha);
  }
`;

export function LakeWater({ lake, palette }: { lake: LakeDef; palette: Palette }) {
  const quality = useQuality((s) => s.quality);
  const segments = quality === 'high' ? 80 : quality === 'medium' ? 56 : 36;
  const material = useMemo(() => {
    const base = new Color(palette.water);
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRadius: { value: lake.radius + 5 },
        uDeep: { value: base.clone().multiplyScalar(0.48) },
        uShallow: { value: base.clone().lerp(new Color('#69bfc8'), 0.48) },
        uSky: { value: new Color(palette.sky).lerp(new Color('#9bc5dd'), 0.22) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
  }, [lake.radius, palette]);
  const ref = useRef<ShaderMaterial>(material);
  useFrame(({ clock }) => {
    ref.current.uniforms.uTime.value = clock.elapsedTime;
  });
  const size = (lake.radius + 5) * 2;
  return (
    <mesh position={[lake.x, lake.y + 0.035, lake.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[size, size, segments, segments]} />
      <primitive ref={ref} object={material} attach="material" />
    </mesh>
  );
}
