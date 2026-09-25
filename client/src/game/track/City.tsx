import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  type InstancedMesh,
} from 'three';
import { ROUTE_STEP, createRng, type Track } from '@game/shared';
import { usePalette, useTrack } from '../../store/raceSettings';
import { BAY, FLOOR, WINDOW_CELLS, facadeTexture, glowTexture, neonRect, neonTexture, windowsTexture } from './cityTextures';

/** Yo'l cheti (Road.tsx yelkasi) dan keyin trotuar: boshlanishi va kengligi (yo'l chetidan, m), balandligi */
const WALK_FROM = 0.9;
const WALK_TO = 5;
const CURB = 0.15;
const LIFT = 0.05;
/** Binolar trotuardan shuncha narida boshlanadi */
const SETBACK = WALK_TO + 1;
/** Fonar ustunlari oralig'i (m) va yo'l chetidan joyi */
const LAMP_EVERY = 32;
const LAMP_OUT = 1.8;
const LAMP_H = 7.5;
const LAMP_ARM = 1.8;

const FACADES = ['#5d6580', '#4c5268', '#6a5e76', '#52606f', '#707585', '#464c5e'];
const NEONS = ['#ff2fa8', '#28e7ff', '#ffd23f', '#7cff5b', '#b44bff', '#ff5a1f', '#ff3b3b'];

interface Building {
  x: number;
  z: number;
  y: number;
  yaw: number;
  /** Yo'l bo'ylab eni, chuqurligi, balandligi */
  w: number;
  d: number;
  h: number;
  /** Fasad rangi va deraza naqshining siljishi (binolar bir xil ko'rinmasin) */
  color: string;
  u: number;
  v: number;
}

/** Tekis to'rtburchaklar yig'uvchi: pozitsiya, uv, rang */
class Quads {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  /** a-b-c-d soat strelkasiga teskari (old tomondan qaraganda) */
  quad(a: number[], b: number[], c: number[], d: number[], uv: [number, number, number, number], color: Color) {
    const [u0, v0, u1, v1] = uv;
    const uvs = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const p = [a, b, c, d][k];
      this.pos.push(p[0], p[1], p[2]);
      this.uv.push(uvs[k][0], uvs[k][1]);
      this.col.push(color.r, color.g, color.b);
    }
  }
  build() {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Ko'cha bo'ylab ikki tomonda binolar: bino oldi trotuardan keyin, hech bir burchagi boshqa ko'chaga tushmaydi */
function placeBuildings(track: Track): Building[] {
  const { ROUTE_LENGTH, roadHalfWidth, routeAt, nearestOnRoute } = track;
  const rng = createRng(track.def.seed);
  const out: Building[] = [];
  const clear = (x: number, z: number) => {
    const n = nearestOnRoute(x, z);
    return n.dist >= roadHalfWidth(n.s) + SETBACK - 0.5 && Math.abs(x) < 490 && Math.abs(z) < 490;
  };
  for (const side of [1, -1]) {
    let s = 0;
    while (s < ROUTE_LENGTH) {
      const w = 12 + rng() * 16;
      const d = 14 + rng() * 16;
      const r = rng();
      const h = r < 0.65 ? 14 + rng() * 30 : r < 0.93 ? 44 + rng() * 46 : 90 + rng() * 50;
      const f = routeAt(s + w / 2);
      // Chap vektor (tz, −tx); bino markazi yo'ldan `side` tomonda
      const lx = f.tz * side;
      const lz = -f.tx * side;
      const off = roadHalfWidth(f.s) + SETBACK + rng() * 2 + d / 2;
      const x = f.x + lx * off;
      const z = f.z + lz * off;
      // Burchaklar va qirra o'rtalari ko'chaga tushmasin (burilishning ichki tomoni, boshqa ko'chalar)
      const ok = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ].every(([a, b]) => clear(x + f.tx * (a * w) / 2 + lx * (b * d) / 2, z + f.tz * (a * w) / 2 + lz * (b * d) / 2));
      const rad = Math.hypot(w, d) / 2;
      const free = ok && out.every((o) => Math.hypot(o.x - x, o.z - z) > (rad + Math.hypot(o.w, o.d) / 2) * 0.72);
      if (free) {
        out.push({
          x,
          z,
          y: f.y + LIFT,
          yaw: Math.atan2(f.tx, f.tz) + (side > 0 ? 0 : Math.PI),
          w,
          d,
          h,
          color: FACADES[Math.floor(rng() * FACADES.length)],
          u: Math.floor(rng() * WINDOW_CELLS) / WINDOW_CELLS,
          v: Math.floor(rng() * WINDOW_CELLS) / WINDOW_CELLS,
        });
        s += w + 1 + rng() * 4;
      } else {
        s += 6;
      }
    }
  }
  return out;
}

/** Bino lokal nuqtasi (a — yo'l bo'ylab, b — yo'ldan uzoqlashish, y — balandlik) → dunyo */
function local(b: Building, a: number, dist: number, y: number): number[] {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  // yaw: lokal +z (a) → (sin, cos); lokal +x (dist) → (cos, −sin)
  return [b.x + s * a + c * dist, b.y + y, b.z + c * a - s * dist];
}

function buildBuildings(buildings: Building[]) {
  const q = new Quads();
  const col = new Color();
  for (const b of buildings) {
    col.set(b.color);
    const hw = b.w / 2;
    const hd = b.d / 2;
    const corners = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
    // 4 devor: har biri tashqariga qaragan; uv — oraliq/qavat kataklari (takrorlanadi)
    for (let k = 0; k < 4; k++) {
      const [a0, d0] = corners[k];
      const [a1, d1] = corners[(k + 1) % 4];
      const len = Math.hypot(a1 - a0, d1 - d0);
      const uv: [number, number, number, number] = [
        b.u,
        b.v,
        b.u + len / BAY / WINDOW_CELLS,
        b.v + b.h / FLOOR / WINDOW_CELLS,
      ];
      q.quad(local(b, a0, d0, 0), local(b, a1, d1, 0), local(b, a1, d1, b.h), local(b, a0, d0, b.h), uv, col);
    }
    // Tom — teksturaning devor qismi (katakning chap-yuqori burchagi)
    const roof: [number, number, number, number] = [0.001, 0.999, 0.002, 0.998];
    q.quad(
      local(b, -hw, -hd, b.h),
      local(b, hw, -hd, b.h),
      local(b, hw, hd, b.h),
      local(b, -hw, hd, b.h),
      roof,
      col.clone().multiplyScalar(0.7),
    );
  }
  return q.build();
}

/** Bino oldidagi neon lavhalar (tik — chekkada, yotiq — pastki qavatlar ustida yoki tomda reklama) */
function buildSigns(buildings: Building[], seed: number) {
  const rng = createRng(seed + 7);
  const q = new Quads();
  const col = new Color();
  for (const b of buildings) {
    const hw = b.w / 2;
    const front = -b.d / 2 - 0.2; // yo'lga qaragan devor oldida
    const signs = rng() < 0.75 ? 1 + Math.floor(rng() * 2) : 0;
    for (let k = 0; k < signs; k++) {
      col.set(NEONS[Math.floor(rng() * NEONS.length)]);
      const vertical = rng() < 0.55;
      const rect = neonRect(vertical, Math.floor(rng() * 4));
      if (vertical) {
        const w = 2.2 + rng() * 1;
        const h = Math.min(b.h - 3, 7 + rng() * 9);
        const a = (rng() < 0.5 ? -1 : 1) * (hw - w / 2 - 0.6);
        const y = 4 + rng() * Math.max(0, b.h - h - 6);
        q.quad(local(b, a - w / 2, front, y), local(b, a + w / 2, front, y), local(b, a + w / 2, front, y + h), local(b, a - w / 2, front, y + h), rect, col);
      } else {
        const w = Math.min(b.w - 2, 7 + rng() * 8);
        const h = w / 4;
        const onRoof = rng() < 0.35 && b.h < 60;
        const y = onRoof ? b.h + 0.4 : 4 + rng() * 5;
        const a = (rng() - 0.5) * (b.w - w - 1);
        q.quad(local(b, a - w / 2, front, y), local(b, a + w / 2, front, y), local(b, a + w / 2, front, y + h), local(b, a - w / 2, front, y + h), rect, col);
      }
    }
  }
  return q.build();
}

/** Trotuar: ikki tomonda ko'tarilgan beton lenta + bordyur yuzasi */
function buildSidewalks({ ROUTE, roadHalfWidth }: Track, sidewalk: string) {
  const q = new Quads();
  const top = new Color(sidewalk);
  const curb = top.clone().multiplyScalar(1.15);
  const at = (i: number, off: number, y: number) => [
    ROUTE.xs[i] + ROUTE.tzs[i] * off,
    ROUTE.ys[i] + LIFT + y,
    ROUTE.zs[i] - ROUTE.txs[i] * off,
  ];
  const none: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < ROUTE.count - 1; i++) {
    const h0 = roadHalfWidth(i * ROUTE_STEP);
    const h1 = roadHalfWidth((i + 1) * ROUTE_STEP);
    for (const side of [1, -1]) {
      const inner0 = side * (h0 + WALK_FROM);
      const inner1 = side * (h1 + WALK_FROM);
      const outer0 = side * (h0 + WALK_TO);
      const outer1 = side * (h1 + WALK_TO);
      // Tepa (normal yuqoriga): chap tomonda tashqi → ichki, o'ngda aksincha
      if (side > 0) {
        q.quad(at(i, outer0, CURB), at(i, inner0, CURB), at(i + 1, inner1, CURB), at(i + 1, outer1, CURB), none, top);
        q.quad(at(i, inner0, CURB), at(i, inner0, -0.05), at(i + 1, inner1, -0.05), at(i + 1, inner1, CURB), none, curb);
      } else {
        q.quad(at(i, inner0, CURB), at(i, outer0, CURB), at(i + 1, outer1, CURB), at(i + 1, inner1, CURB), none, top);
        q.quad(at(i, inner0, -0.05), at(i, inner0, CURB), at(i + 1, inner1, CURB), at(i + 1, inner1, -0.05), none, curb);
      }
    }
  }
  return q.build();
}

interface Lamp {
  x: number;
  y: number;
  z: number;
  /** Qo'l yo'lga qaragan yo'nalish (yaw) */
  yaw: number;
}

function placeLamps({ ROUTE_LENGTH, roadHalfWidth, routeAt }: Track): Lamp[] {
  const out: Lamp[] = [];
  for (const side of [1, -1]) {
    for (let s = side > 0 ? 0 : LAMP_EVERY / 2; s < ROUTE_LENGTH; s += LAMP_EVERY) {
      const f = routeAt(s);
      const off = side * (roadHalfWidth(s) + LAMP_OUT);
      // Yo'lga qaragan yo'nalish: −side × chap vektor
      out.push({ x: f.x + f.tz * off, y: f.y + LIFT + CURB, z: f.z - f.tx * off, yaw: Math.atan2(-side * f.tz, side * f.tx) });
    }
  }
  return out;
}

const facadeMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
const signMaterial = new MeshBasicMaterial({ vertexColors: true, transparent: true, side: DoubleSide, toneMapped: false });
const sidewalkMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  side: DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});
const poleMaterial = new MeshStandardMaterial({ color: '#2b2e35', roughness: 0.6, metalness: 0.4 });
const headMaterial = new MeshBasicMaterial({ color: '#ffe2b0', toneMapped: false });
const poolMaterial = new MeshBasicMaterial({
  color: '#ffb46a',
  transparent: true,
  opacity: 0.75,
  blending: AdditiveBlending,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -6,
});
const GEO = {
  pole: new CylinderGeometry(0.1, 0.14, LAMP_H, 6),
  arm: new BoxGeometry(0.12, 0.12, LAMP_ARM),
  head: new BoxGeometry(0.45, 0.14, 0.9),
  pool: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};

/** Tungi shahar: trotuarlar, binolar (yonib turgan derazalar), neon lavhalar, fonarlar va yo'ldagi yorug'lik dog'lari */
export function City() {
  const track = useTrack();
  if (!track.def.zones.some((z) => z.type === 'city')) return null;
  return <CityImpl track={track} />;
}

function CityImpl({ track }: { track: Track }) {
  const palette = usePalette();
  const buildings = useMemo(() => placeBuildings(track), [track]);
  const geo = useMemo(
    () => ({
      buildings: buildBuildings(buildings),
      signs: buildSigns(buildings, track.def.seed),
      sidewalks: buildSidewalks(track, palette.sidewalk),
    }),
    [buildings, track, palette.sidewalk],
  );
  const lamps = useMemo(() => placeLamps(track), [track]);

  // Teksturalar bir marta — materiallarga beriladi
  useMemo(() => {
    facadeMaterial.map = facadeTexture();
    facadeMaterial.emissiveMap = windowsTexture();
    facadeMaterial.emissive = new Color('#ffffff');
    facadeMaterial.emissiveIntensity = 1.1;
    facadeMaterial.needsUpdate = true;
    signMaterial.map = neonTexture();
    signMaterial.needsUpdate = true;
    poolMaterial.map = glowTexture();
    poolMaterial.needsUpdate = true;
  }, []);

  return (
    <>
      <mesh geometry={geo.sidewalks} material={sidewalkMaterial} receiveShadow />
      <mesh geometry={geo.buildings} material={facadeMaterial} castShadow receiveShadow />
      <mesh geometry={geo.signs} material={signMaterial} />
      <Lamps lamps={lamps} />
      <RigidBody type="fixed" colliders={false}>
        {buildings.map((b, i) => (
          <CuboidCollider key={i} args={[b.d / 2, b.h / 2, b.w / 2]} position={[b.x, b.y + b.h / 2, b.z]} rotation={[0, b.yaw, 0]} />
        ))}
      </RigidBody>
    </>
  );
}

/** Fonarlar: ustun, yo'lga cho'zilgan qo'l, yonib turgan chiroq va uning ostidagi yorug'lik dog'i (instanced) */
function Lamps({ lamps }: { lamps: Lamp[] }) {
  const refs = {
    pole: useRef<InstancedMesh>(null),
    arm: useRef<InstancedMesh>(null),
    head: useRef<InstancedMesh>(null),
    pool: useRef<InstancedMesh>(null),
  };
  useLayoutEffect(() => {
    const o = new Object3D();
    const set = (mesh: InstancedMesh | null, place: (l: Lamp) => void) => {
      if (!mesh) return;
      lamps.forEach((l, i) => {
        o.position.set(l.x, l.y, l.z);
        o.rotation.set(0, l.yaw, 0);
        o.scale.set(1, 1, 1);
        place(l);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    set(refs.pole.current, () => o.translateY(LAMP_H / 2));
    set(refs.arm.current, () => o.translateY(LAMP_H - 0.2).translateZ(LAMP_ARM / 2));
    set(refs.head.current, () => o.translateY(LAMP_H - 0.3).translateZ(LAMP_ARM - 0.2));
    set(refs.pool.current, (l) => {
      o.translateZ(LAMP_ARM + 1.2);
      o.position.y = l.y - CURB + 0.06;
      o.scale.set(13, 1, 13);
    });
  }, [lamps]);
  return (
    <>
      <instancedMesh ref={refs.pole} args={[GEO.pole, poleMaterial, lamps.length]} castShadow />
      <instancedMesh ref={refs.arm} args={[GEO.arm, poleMaterial, lamps.length]} />
      <instancedMesh ref={refs.head} args={[GEO.head, headMaterial, lamps.length]} />
      <instancedMesh ref={refs.pool} args={[GEO.pool, poolMaterial, lamps.length]} renderOrder={2} />
    </>
  );
}
