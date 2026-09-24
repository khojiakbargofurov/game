import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Points, PointsMaterial } from 'three';
import { usePreset } from '../store/quality';
import { useWeatherFx } from '../store/raceSettings';

/** Zarrachalar qutisi kamera atrofida (yarim o'lchamlar, m) — tashqariga chiqqan zarracha qarama-qarshi tomondan qaytadi */
const HALF_W = 32;
const HALF_H = 18;

const RAIN = { speed: 26, length: 0.9, wind: 0.18 };
const SNOW = { speed: 2.2, sway: 0.6 };

/** Yomg'ir (chiziqlar) yoki qor (nuqtalar) — faqat vizual, soni grafika sifatiga bog'liq */
export function Weather() {
  const { particles } = useWeatherFx();
  const count = usePreset().weatherParticles;
  if (particles === 'none') return null;
  return particles === 'rain' ? <Rain key={count} count={count} /> : <Snow key={count} count={count} />;
}

/** Tasodifiy boshlang'ich joylar (kameraga nisbatan) */
function scatter(count: number) {
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    base[i * 3] = (Math.random() * 2 - 1) * HALF_W;
    base[i * 3 + 1] = (Math.random() * 2 - 1) * HALF_H;
    base[i * 3 + 2] = (Math.random() * 2 - 1) * HALF_W;
  }
  return base;
}

/** Qutidagi koordinatani kamera atrofida [-half, half) oralig'iga o'rash */
const wrap = (v: number, half: number) => ((((v + half) % (2 * half)) + 2 * half) % (2 * half)) - half;

function Rain({ count }: { count: number }) {
  const { object, base, positions } = useMemo(() => {
    const base = scatter(count);
    const positions = new Float32Array(count * 6); // har tomchi — 2 uchli kesma
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({ color: '#c3cfdb', transparent: true, opacity: 0.55 });
    const object = new LineSegments(geometry, material);
    object.frustumCulled = false;
    return { object, base, positions };
  }, [count]);

  useFrame(({ camera }, dt) => {
    const { x: cx, y: cy, z: cz } = camera.position;
    const fall = RAIN.speed * Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) {
      base[i * 3 + 1] -= fall;
      // Dunyo koordinatasida o'rash — kamera siljiganda tomchilar u bilan "sudralmaydi"
      const x = cx + wrap(base[i * 3] - cx, HALF_W);
      const y = cy + wrap(base[i * 3 + 1] - cy, HALF_H);
      const z = cz + wrap(base[i * 3 + 2] - cz, HALF_W);
      base[i * 3] = x;
      base[i * 3 + 1] = y;
      base[i * 3 + 2] = z;
      const o = i * 6;
      positions[o] = x;
      positions[o + 1] = y;
      positions[o + 2] = z;
      positions[o + 3] = x + RAIN.wind;
      positions[o + 4] = y - RAIN.length;
      positions[o + 5] = z;
    }
    object.geometry.attributes.position.needsUpdate = true;
  });

  return <primitive object={object} />;
}

function Snow({ count }: { count: number }) {
  const { object, base, phase } = useMemo(() => {
    const base = scatter(count);
    const phase = Float32Array.from({ length: count }, () => Math.random() * Math.PI * 2);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(base, 3));
    const material = new PointsMaterial({ color: '#ffffff', size: 0.22, transparent: true, opacity: 0.9, depthWrite: false });
    const object = new Points(geometry, material);
    object.frustumCulled = false;
    return { object, base, phase };
  }, [count]);

  useFrame(({ camera, clock }, dt) => {
    const { x: cx, y: cy, z: cz } = camera.position;
    const step = Math.min(dt, 0.1);
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const sway = Math.sin(t * 0.8 + phase[i]) * SNOW.sway * step;
      base[i * 3] = cx + wrap(base[i * 3] + sway - cx, HALF_W);
      base[i * 3 + 1] = cy + wrap(base[i * 3 + 1] - SNOW.speed * step - cy, HALF_H);
      base[i * 3 + 2] = cz + wrap(base[i * 3 + 2] - cz, HALF_W);
    }
    object.geometry.attributes.position.needsUpdate = true;
  });

  return <primitive object={object} />;
}
