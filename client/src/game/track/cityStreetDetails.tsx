import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
} from 'three';
import { createRng, type Track } from '@game/shared';
import { withCarEnv } from '../car/carEnv';

const CURB_TOP = 0.2;

interface Item {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: [number, number, number];
  color?: string;
  roll?: number;
}

interface ParkedCar extends Item {
  collider: [number, number, number];
}

interface Details {
  cars: ParkedCar[];
  cabins: Item[];
  wheels: Item[];
  signPoles: Item[];
  signs: Item[];
  adPillars: Item[];
  adGlow: Item[];
  plazas: Item[];
  benches: Item[];
  benchBacks: Item[];
  planters: Item[];
  plants: Item[];
}

const CAR_COLORS = ['#a52d43', '#25658f', '#d4d8de', '#2b303a', '#b58a38', '#e7e3d9', '#536b48'];
const SIGN_COLORS = ['#287dcc', '#d94a54', '#28a37a', '#df9f35'];

function placeDetails(track: Track): Details {
  const rng = createRng(track.def.seed + 811);
  const cars: ParkedCar[] = [];
  const cabins: Item[] = [];
  const wheels: Item[] = [];
  const signPoles: Item[] = [];
  const signs: Item[] = [];
  const adPillars: Item[] = [];
  const adGlow: Item[] = [];
  const plazas: Item[] = [];
  const benches: Item[] = [];
  const benchBacks: Item[] = [];
  const planters: Item[] = [];
  const plants: Item[] = [];
  const point = (s: number, side: number, off: number) => {
    const f = track.routeAt(s);
    return {
      f,
      x: f.x + f.tz * side * off,
      y: f.y + CURB_TOP,
      z: f.z - f.tx * side * off,
      yaw: Math.atan2(f.tx, f.tz),
    };
  };

  // Park qilingan mashinalar faqat to'g'ri ko'cha chetida; burilish va chorrahani to'smaydi.
  for (let s = 55; s < track.ROUTE_LENGTH; s += 82 + rng() * 34) {
    const a = track.routeAt(s - 10);
    const b = track.routeAt(s + 10);
    if (a.tx * b.tx + a.tz * b.tz < 0.992) continue;
    const side = rng() < 0.5 ? 1 : -1;
    const p = point(s, side, track.roadHalfWidth(s) - 1.05);
    const yaw = p.yaw + (side > 0 ? 0 : Math.PI);
    const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    cars.push({ x: p.x, y: p.y + 0.46, z: p.z, yaw, scale: [1.72, 0.62, 4.05], color, collider: [0.86, 0.58, 2.03] });
    cabins.push({ x: p.x, y: p.y + 0.96, z: p.z, yaw, scale: [1.46, 0.58, 1.95], color: '#88a8bd' });
    for (const lateral of [-0.9, 0.9]) {
      for (const along of [-1.3, 1.3]) {
        const x = p.x + Math.cos(yaw) * lateral + Math.sin(yaw) * along;
        const z = p.z - Math.sin(yaw) * lateral + Math.cos(yaw) * along;
        wheels.push({ x, y: p.y + 0.25, z, yaw, roll: Math.PI / 2, scale: [0.34, 0.22, 0.34] });
      }
    }
  }

  // Yo'l belgilari va yoritilgan reklama ustunlari.
  for (let s = 38, i = 0; s < track.ROUTE_LENGTH; s += 105, i++) {
    const side = i % 2 ? 1 : -1;
    const p = point(s, side, track.roadHalfWidth(s) + 2.7);
    signPoles.push({ x: p.x, y: p.y + 1.65, z: p.z, yaw: p.yaw, scale: [1, 1, 1] });
    signs.push({ x: p.x, y: p.y + 3.25, z: p.z, yaw: p.yaw + (side > 0 ? Math.PI : 0), scale: [0.14, 1.05, 1.55], color: SIGN_COLORS[i % SIGN_COLORS.length] });
  }
  for (let s = 120, i = 0; s < track.ROUTE_LENGTH; s += 205, i++) {
    const side = i % 2 ? -1 : 1;
    const p = point(s, side, track.roadHalfWidth(s) + 4.05);
    adPillars.push({ x: p.x, y: p.y + 1.55, z: p.z, yaw: p.yaw, scale: [1, 1, 1] });
    adGlow.push({ x: p.x, y: p.y + 1.65, z: p.z, yaw: p.yaw, scale: [1, 1, 1], color: i % 2 ? '#ff45b5' : '#35dfff' });
  }

  // Kichik piyodalar cho'ntaklari: boshqa rangli plita, skameyka va yashil planterlar.
  for (let s = 76, i = 0; s < track.ROUTE_LENGTH; s += 145, i++) {
    const side = i % 2 ? 1 : -1;
    const p = point(s, side, track.roadHalfWidth(s) + 3.55);
    plazas.push({ x: p.x, y: p.y + 0.015, z: p.z, yaw: p.yaw, scale: [2.6, 0.05, 9.5], color: i % 2 ? '#776b82' : '#6a7581' });
    const bx = p.x + Math.sin(p.yaw) * 1.5;
    const bz = p.z + Math.cos(p.yaw) * 1.5;
    benches.push({ x: bx, y: p.y + 0.52, z: bz, yaw: p.yaw, scale: [0.65, 0.16, 2.8] });
    benches.push({ x: bx, y: p.y + 0.25, z: bz, yaw: p.yaw, scale: [0.14, 0.5, 2.2] });
    benchBacks.push({ x: bx + Math.cos(p.yaw) * 0.28, y: p.y + 0.95, z: bz - Math.sin(p.yaw) * 0.28, yaw: p.yaw, scale: [0.12, 0.75, 2.8] });
    for (const along of [-3.3, 3.3]) {
      const x = p.x + Math.sin(p.yaw) * along;
      const z = p.z + Math.cos(p.yaw) * along;
      planters.push({ x, y: p.y + 0.38, z, yaw: 0, scale: [1, 1, 1] });
      plants.push({ x, y: p.y + 1.05, z, yaw: rng() * Math.PI, scale: [0.75, 0.75, 0.75], color: i % 3 ? '#4b7b55' : '#6c8e4a' });
    }
  }
  return { cars, cabins, wheels, signPoles, signs, adPillars, adGlow, plazas, benches, benchBacks, planters, plants };
}

const GEO = {
  box: new BoxGeometry(1, 1, 1),
  wheel: new CylinderGeometry(1, 1, 1, 10),
  pole: new CylinderGeometry(0.08, 0.1, 3.3, 7),
  ad: new CylinderGeometry(0.62, 0.72, 3.1, 12),
  adGlow: new CylinderGeometry(0.64, 0.74, 2.35, 12, 1, true),
  planter: new CylinderGeometry(0.62, 0.74, 0.75, 10),
  plant: new SphereGeometry(0.78, 8, 6),
};

const bodyMat = withCarEnv(new MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.3 }), 0.85);
const cabinMat = withCarEnv(new MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.12 }), 1.05);
const tireMat = new MeshStandardMaterial({ color: '#111318', roughness: 0.95 });
const poleMat = new MeshStandardMaterial({ color: '#363c46', metalness: 0.55, roughness: 0.48 });
const signMat = new MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.42, emissive: '#101522', emissiveIntensity: 0.35 });
const adMat = new MeshStandardMaterial({ color: '#242b36', metalness: 0.58, roughness: 0.35 });
const adGlowMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.76, toneMapped: false });
const plazaMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.94 });
const benchMat = new MeshStandardMaterial({ color: '#79563b', roughness: 0.82 });
const planterMat = new MeshStandardMaterial({ color: '#606873', roughness: 0.86 });
const plantMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });

function Instances({ items, geometry, material, shadows = true }: { items: Item[]; geometry: BufferGeometry; material: Material; shadows?: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    items.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z);
      o.rotation.set(0, p.yaw, p.roll ?? 0);
      o.scale.set(...p.scale);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      if (p.color) mesh.setColorAt(i, new Color(p.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadows} receiveShadow={shadows} />;
}

export function CityStreetDetails({ track }: { track: Track }) {
  const d = useMemo(() => placeDetails(track), [track]);
  return (
    <>
      <Instances items={d.cars} geometry={GEO.box} material={bodyMat} />
      <Instances items={d.cabins} geometry={GEO.box} material={cabinMat} />
      <Instances items={d.wheels} geometry={GEO.wheel} material={tireMat} />
      <Instances items={d.signPoles} geometry={GEO.pole} material={poleMat} />
      <Instances items={d.signs} geometry={GEO.box} material={signMat} />
      <Instances items={d.adPillars} geometry={GEO.ad} material={adMat} />
      <Instances items={d.adGlow} geometry={GEO.adGlow} material={adGlowMat} shadows={false} />
      <Instances items={d.plazas} geometry={GEO.box} material={plazaMat} />
      <Instances items={d.benches} geometry={GEO.box} material={benchMat} />
      <Instances items={d.benchBacks} geometry={GEO.box} material={benchMat} />
      <Instances items={d.planters} geometry={GEO.planter} material={planterMat} />
      <Instances items={d.plants} geometry={GEO.plant} material={plantMat} />
      <RigidBody type="fixed" colliders={false}>
        {d.cars.map((p, i) => (
          <CuboidCollider key={i} args={p.collider} position={[p.x, p.y + 0.08, p.z]} rotation={[0, p.yaw, 0]} friction={0.72} />
        ))}
      </RigidBody>
    </>
  );
}
