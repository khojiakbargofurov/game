import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MeshStandardMaterial,
  Object3D,
  type InstancedMesh,
} from 'three';
import { COLORS, ROUTE_STEP, yawOf, type Track } from '@game/shared';
import { useTrack } from '../../store/raceSettings';
import { withCarEnv } from '../car/carEnv';

/** Jarlik deb hisoblanadi: yo'l chetidan shuncha narida relyef yo'ldan DROP m pastda */
const PROBE = 10;
const DROP = 4;
/** Rels yo'l chetidan tashqarida (m), balandligi (pastki/yuqori qirra) */
const RAIL_OUT = 0.7;
const RAIL_LOW = 0.45;
const RAIL_HIGH = 0.85;
/** Ustunlar har 2 namunada (4 m), collider — har 4 namunada (8 m) */
const POST_EVERY = 2;
const COLLIDER_EVERY = 4;
const LIFT = 0.05;

interface Rail {
  /** Namuna indekslari (ketma-ket) va tomon (1 = chap) */
  from: number;
  to: number;
  side: 1 | -1;
}

/** Alpine zonasida jarlik tomonidagi uzluksiz uchastkalar (qisqa uzilishlar to'ldiriladi, qisqa bo'laklar tashlanadi) */
function findRails(track: Track): Rail[] {
  const { ROUTE, roadHalfWidth, terrainHeight, zoneWeights, tunnelFactor } = track;
  const rails: Rail[] = [];
  for (const side of [1, -1] as const) {
    const flag = new Uint8Array(ROUTE.count);
    for (let i = 0; i < ROUTE.count; i++) {
      const s = i * ROUTE_STEP;
      if (zoneWeights(s).alpine < 0.5 || tunnelFactor(s) > 0.05) continue;
      const off = side * (roadHalfWidth(s) + PROBE);
      const x = ROUTE.xs[i] + ROUTE.tzs[i] * off;
      const z = ROUTE.zs[i] - ROUTE.txs[i] * off;
      if (terrainHeight(x, z) < ROUTE.ys[i] - DROP) flag[i] = 1;
    }
    // Kengaytirish: jarlikdan 3 namuna oldin/keyin ham rels bo'lsin (uzilishlar yopiladi)
    const grown = new Uint8Array(ROUTE.count);
    for (let i = 0; i < ROUTE.count; i++) {
      if (!flag[i]) continue;
      for (let j = Math.max(0, i - 3); j <= Math.min(ROUTE.count - 1, i + 3); j++) grown[j] = 1;
    }
    let start = -1;
    for (let i = 0; i <= ROUTE.count; i++) {
      const on = i < ROUTE.count && grown[i] && !(tunnelFactor(i * ROUTE_STEP) > 0.05);
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
        if (i - 1 - start >= 5) rails.push({ from: start, to: i - 1, side });
        start = -1;
      }
    }
  }
  return rails;
}

const postGeometry = new BoxGeometry(0.14, RAIL_HIGH + 0.1, 0.14);
const metal = withCarEnv(
  new MeshStandardMaterial({ color: COLORS.guardrail, metalness: 0.6, roughness: 0.35, side: DoubleSide }),
  0.8,
);

/**
 * Jarlik bo'yidagi metall to'siq (Alp trassasi): ikki qatorli rels lentasi, har 4 m da ustun,
 * har 8 m da ingichka collider — mashina jarlikka tushib ketmaydi.
 */
export function Guardrail() {
  const track = useTrack();
  const hasAlpine = track.def.zones.some((z) => z.type === 'alpine');
  if (!hasAlpine) return null;
  return <GuardrailMesh track={track} />;
}

function GuardrailMesh({ track }: { track: Track }) {
  const { rails, ribbon, posts, colliders } = useMemo(() => {
    const { ROUTE, roadHalfWidth } = track;
    const rails = findRails(track);
    const pos: number[] = [];
    const posts: { x: number; y: number; z: number }[] = [];
    const colliders: { position: [number, number, number]; yaw: number; half: number }[] = [];
    const at = (i: number, side: number, up: number) => {
      const off = side * (roadHalfWidth(i * ROUTE_STEP) + RAIL_OUT);
      return [ROUTE.xs[i] + ROUTE.tzs[i] * off, ROUTE.ys[i] + LIFT + up, ROUTE.zs[i] - ROUTE.txs[i] * off];
    };
    for (const r of rails) {
      for (let i = r.from; i < r.to; i++) {
        const a0 = at(i, r.side, RAIL_LOW);
        const a1 = at(i, r.side, RAIL_HIGH);
        const b0 = at(i + 1, r.side, RAIL_LOW);
        const b1 = at(i + 1, r.side, RAIL_HIGH);
        pos.push(...a0, ...b0, ...a1, ...b0, ...b1, ...a1);
      }
      for (let i = r.from; i <= r.to; i += POST_EVERY) {
        const [x, y, z] = at(i, r.side, 0);
        posts.push({ x, y, z });
      }
      for (let i = r.from; i < r.to; i += COLLIDER_EVERY) {
        const j = Math.min(r.to, i + COLLIDER_EVERY);
        const [x0, y0, z0] = at(i, r.side, 0);
        const [x1, y1, z1] = at(j, r.side, 0);
        const len = Math.hypot(x1 - x0, z1 - z0);
        colliders.push({
          position: [(x0 + x1) / 2, (y0 + y1) / 2 + 0.6, (z0 + z1) / 2],
          yaw: yawOf(x1 - x0, z1 - z0),
          half: len / 2 + 0.3,
        });
      }
    }
    const ribbon = new BufferGeometry();
    ribbon.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    ribbon.computeVertexNormals();
    return { rails, ribbon, posts, colliders };
  }, [track]);

  const postsRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = postsRef.current;
    if (!mesh) return;
    const o = new Object3D();
    posts.forEach((p, i) => {
      o.position.set(p.x, p.y + (RAIL_HIGH + 0.1) / 2, p.z);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [posts]);

  if (!rails.length) return null;
  return (
    <>
      <mesh geometry={ribbon} material={metal} castShadow receiveShadow />
      <instancedMesh ref={postsRef} args={[postGeometry, metal, posts.length]} castShadow />
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((c, i) => (
          <CuboidCollider key={i} args={[0.15, 0.7, c.half]} position={c.position} rotation={[0, c.yaw, 0]} />
        ))}
      </RigidBody>
    </>
  );
}
