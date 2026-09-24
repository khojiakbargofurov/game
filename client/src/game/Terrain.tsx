import { useMemo } from 'react';
import { RigidBody, TrimeshCollider } from '@react-three/rapier';
import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import { COLORS, WORLD, type Palette, type TerrainSample, type Track } from '@game/shared';
import { usePalette, useTrack } from '../store/raceSettings';

/** Har bir uchi uchun rang tanlashda kerak bo'ladigan ma'lumotlar */
interface VertexInfo {
  canyon: Float32Array;
  ruins: Float32Array;
  above: Float32Array; // yo'ldan balandlik
  offRoad: Float32Array; // yo'l chetidan masofa (dist - halfWidth)
}

function buildHeightGeometry({ sampleTerrain }: Track) {
  const { TERRAIN_SIZE: size, TERRAIN_SEGMENTS: segs } = WORLD;
  const geo = new PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as BufferAttribute;
  const info: VertexInfo = {
    canyon: new Float32Array(pos.count),
    ruins: new Float32Array(pos.count),
    above: new Float32Array(pos.count),
    offRoad: new Float32Array(pos.count),
  };
  const t: TerrainSample = { height: 0, s: 0, dist: 0, roadY: 0, halfWidth: 0, forest: 0, canyon: 0, ruins: 0 };
  for (let i = 0; i < pos.count; i++) {
    sampleTerrain(pos.getX(i), pos.getZ(i), t);
    pos.setY(i, t.height);
    info.canyon[i] = t.canyon;
    info.ruins[i] = t.ruins;
    info.above[i] = t.height - t.roadY;
    info.offRoad[i] = t.dist - t.halfWidth;
  }
  return { geo, info };
}

type Colors = Record<keyof typeof COLORS, Color>;
const colorCache = new WeakMap<Palette, Colors>();

/** Fasl palitrasi → three.js Color obyektlari (bir marta) */
function colorsOf(palette: Palette): Colors {
  let c = colorCache.get(palette);
  if (!c) {
    c = Object.fromEntries(Object.keys(COLORS).map((k) => [k, new Color(palette[k as keyof typeof COLORS])])) as Colors;
    colorCache.set(palette, c);
  }
  return c;
}

/** Uchburchak rangi: zona, balandlik, qiyalik va yo'lga yaqinlikka qarab (low-poly uslubi) */
function faceColor(C: Colors, canyon: number, ruins: number, above: number, offRoad: number, slope: number, out: Color) {
  if (above < -9) return out.copy(slope > 0.5 ? C.rock : C.riverbed); // jarlik tubi
  if (offRoad < 0.5 && Math.abs(above) < 0.5) {
    return out.copy(canyon > 0.5 ? C.roadCanyon : ruins > 0.5 ? C.roadRuins : C.roadForest);
  }
  if (canyon > 0.5) {
    if (slope < 0.25 && above > 8) return out.copy(C.canyonTop);
    // Qoya qatlamlari: balandlik bo'yicha 2.5 m li chiziqlar
    const band = Math.floor(above / 2.5) % 3;
    return out.copy(band === 0 ? C.canyonA : band === 1 ? C.canyonB : C.canyonC);
  }
  if (ruins > 0.5) {
    if (slope > 0.45) return out.copy(C.rock);
    return out.copy(above > 1.2 ? C.ruinsGrass : C.ruinsGround);
  }
  if (slope > 0.55) return out.copy(C.rock);
  if (slope > 0.35) return out.copy(C.dirt);
  return out.copy(above > 4 ? C.grassDark : C.grass);
}

/** Vizual relyef shuncha × shuncha bo'lakka bo'linadi — ko'rinmaydigan bo'laklar chizilmaydi (frustum culling) */
const CHUNKS = 5;

/**
 * Indekssiz (flat shading) vizual geometriya: har bir uchburchak bitta rangda.
 * Uchburchaklar markaziga qarab CHUNKS×CHUNKS bo'lakka taqsimlanadi.
 */
function buildVisualChunks(base: PlaneGeometry, info: VertexInfo, C: Colors): BufferGeometry[] {
  const src = base.attributes.position as BufferAttribute;
  const index = base.index!.array;
  const half = WORLD.TERRAIN_SIZE / 2;
  const cell = WORLD.TERRAIN_SIZE / CHUNKS;
  const chunkOf = (x: number, z: number) => {
    const cx = Math.min(CHUNKS - 1, Math.max(0, Math.floor((x + half) / cell)));
    const cz = Math.min(CHUNKS - 1, Math.max(0, Math.floor((z + half) / cell)));
    return cz * CHUNKS + cx;
  };
  const positions: number[][] = Array.from({ length: CHUNKS * CHUNKS }, () => []);
  const colors: number[][] = Array.from({ length: CHUNKS * CHUNKS }, () => []);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const col = new Color();

  for (let f = 0; f < index.length; f += 3) {
    const i0 = index[f];
    const i1 = index[f + 1];
    const i2 = index[f + 2];
    a.fromBufferAttribute(src, i0);
    b.fromBufferAttribute(src, i1);
    c.fromBufferAttribute(src, i2);
    // Normalning Y komponenti → qiyalik (0 = tekis, 1 = tik)
    const n = ab.subVectors(b, a).cross(ac.subVectors(c, a)).normalize();
    const slope = 1 - Math.abs(n.y);
    const avg = (arr: Float32Array) => (arr[i0] + arr[i1] + arr[i2]) / 3;
    faceColor(C, avg(info.canyon), avg(info.ruins), avg(info.above), avg(info.offRoad), slope, col);
    const jitter = 0.94 + ((f * 7919) % 13) / 100; // bir xil ko'rinmasligi uchun
    const k = chunkOf((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3);
    positions[k].push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let v = 0; v < 3; v++) colors[k].push(col.r * jitter, col.g * jitter, col.b * jitter);
  }

  return positions.map((pos, k) => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(colors[k]), 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  });
}

const terrainMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });

export function Terrain() {
  const track = useTrack();
  const palette = usePalette();
  const { chunks, vertices, indices } = useMemo(() => {
    const { geo, info } = buildHeightGeometry(track);
    return {
      chunks: buildVisualChunks(geo, info, colorsOf(palette)),
      vertices: geo.attributes.position.array as Float32Array,
      indices: geo.index!.array as Uint32Array,
    };
  }, [track, palette]);

  return (
    <RigidBody type="fixed" colliders={false}>
      <TrimeshCollider args={[vertices, indices]} friction={1} />
      {chunks.map((geometry, i) => (
        <mesh key={i} geometry={geometry} receiveShadow material={terrainMaterial} />
      ))}
      {track.LAKE && (
        // Ko'l yuzasi — faqat vizual (suv ostidagi relyef collider'i bor, yo'l suvga tushmaydi)
        <mesh position={[track.LAKE.x, track.LAKE.y, track.LAKE.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[track.LAKE.radius + 5, 40]} />
          <meshStandardMaterial color={palette.water} roughness={0.2} metalness={0.1} transparent opacity={0.88} />
        </mesh>
      )}
    </RigidBody>
  );
}
