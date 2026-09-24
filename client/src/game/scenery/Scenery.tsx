import { useLayoutEffect, useMemo, useRef } from 'react';
import { BallCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  type BufferGeometry,
} from 'three';
import { COLORS } from '@game/shared';
import { usePreset } from '../../store/quality';
import { generatePlacements, type Placement } from './placement';

/** Bir turdagi obyekt qismi (masalan, qarag'ay tanasi) — bitta InstancedMesh */
interface Part {
  /** Umumiy geometriya — barcha bo'laklar bitta obyektdan foydalanadi */
  geometry: BufferGeometry;
  /** Obyekt markaziga nisbatan ofset (masshtabdan oldin) */
  offset: [number, number, number];
  /** Nisbiy masshtab (x, y, z) */
  stretch?: [number, number, number];
  colors: string[];
}

function InstancedPart({ items, part }: { items: Placement[]; part: Part }) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current!;
    const o = new Object3D();
    const palette = part.colors.map((c) => new Color(c));
    const [sx, sy, sz] = part.stretch ?? [1, 1, 1];
    items.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z);
      o.rotation.set(0, p.rotation, 0);
      o.scale.set(p.scale * sx, p.scale * sy, p.scale * sz);
      o.translateX(part.offset[0] * p.scale);
      o.translateY(part.offset[1] * p.scale);
      o.translateZ(part.offset[2] * p.scale);
      // Qoyalar biroz qiyshiq — tabiiyroq
      if (part.stretch) o.rotation.set(p.tint * 0.4, p.rotation, p.tint * 0.3);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, palette[Math.floor(p.tint * palette.length) % palette.length]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, part]);

  return (
    <instancedMesh ref={ref} args={[part.geometry, material, items.length]} castShadow receiveShadow />
  );
}

/** Barcha manzara uchun bitta material (rang — instanceColor orqali) */
const material = new MeshStandardMaterial({ flatShading: true, roughness: 1 });
const rockGeometry = new DodecahedronGeometry(1, 0);
const LEAVES = [COLORS.leaves, COLORS.leavesLight, '#3f6d33'];

// openEnded — ko'rinmaydigan qopqoqlarsiz (tana uchlari barg ichida/yerda, yuqori konus tagi pastki konus ichida):
// ~3600 obyektda ~25% kam uchburchak
const PARTS: Record<Placement['kind'], Part[]> = {
  pine: [
    { geometry: new CylinderGeometry(0.18, 0.28, 2, 5, 1, true), offset: [0, 1, 0], colors: [COLORS.trunk] },
    { geometry: new ConeGeometry(1.5, 2.6, 6), offset: [0, 2.8, 0], colors: LEAVES },
    { geometry: new ConeGeometry(1.05, 2, 6, 1, true), offset: [0, 4.1, 0], colors: LEAVES },
  ],
  broadleaf: [
    { geometry: new CylinderGeometry(0.2, 0.3, 2.4, 5, 1, true), offset: [0, 1.2, 0], colors: [COLORS.trunk] },
    { geometry: new IcosahedronGeometry(1.6, 0), offset: [0, 3.2, 0], colors: ['#7a9a3c', '#9aa447', '#c49a45', '#6f8f3a'] },
  ],
  rock: [{ geometry: rockGeometry, offset: [0, 0.2, 0], stretch: [1, 0.7, 1.1], colors: [COLORS.rock, '#8c7a6c', '#a8988a'] }],
  redRock: [{ geometry: rockGeometry, offset: [0, 0.2, 0], stretch: [1.1, 0.8, 1], colors: [COLORS.canyonA, COLORS.canyonB, COLORS.rock] }],
};

/** Manzara bo'laklari o'lchami (m) — har bir bo'lak alohida frustum culling qilinadi */
const CHUNK = 150;
type Kind = Placement['kind'];
const KINDS = Object.keys(PARTS) as Kind[];

/** Joylashuvlarni bo'laklarga va turlarga ajratish */
function chunkify(items: Placement[]): Map<string, Record<Kind, Placement[]>> {
  const chunks = new Map<string, Record<Kind, Placement[]>>();
  for (const p of items) {
    const key = `${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}`;
    let c = chunks.get(key);
    if (!c) {
      c = { pine: [], broadleaf: [], rock: [], redRock: [] };
      chunks.set(key, c);
    }
    c[p.kind].push(p);
  }
  return chunks;
}

/**
 * Zonaga mos manzara: o'rmonda qarag'ay va bargli daraxtlar, kanyonda qizil qoyalar,
 * xarobalarda siyrak daraxtlar. Har bir bo'lak × tur qismi — bitta InstancedMesh.
 * Yo'lga yaqin daraxt/qoyalarga fizik collider qo'shiladi va ular sifat darajasidan qat'i nazar doim ko'rinadi.
 */
export function Scenery() {
  const density = usePreset().sceneryDensity;
  const all = useMemo(generatePlacements, []);
  const chunks = useMemo(() => chunkify(all.filter((p) => p.solid || p.lod < density)), [all, density]);
  const solids = useMemo(() => all.filter((p) => p.solid), [all]);

  return (
    <>
      {[...chunks.entries()].map(([key, byKind]) =>
        KINDS.map((kind) =>
          byKind[kind].length
            ? PARTS[kind].map((part, i) => <InstancedPart key={`${key}-${kind}-${i}`} items={byKind[kind]} part={part} />)
            : null,
        ),
      )}
      <RigidBody type="fixed" colliders={false}>
        {solids.map((p, i) =>
          p.kind === 'rock' || p.kind === 'redRock' ? (
            <BallCollider key={i} args={[p.scale * 0.85]} position={[p.x, p.y + 0.2 * p.scale, p.z]} />
          ) : (
            <CylinderCollider key={i} args={[1.5 * p.scale, 0.3 * p.scale]} position={[p.x, p.y + 1.5 * p.scale, p.z]} />
          ),
        )}
      </RigidBody>
    </>
  );
}
