import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, MeshStandardMaterial } from 'three';
import { createRng, type Palette, type Track } from '@game/shared';
import { usePalette, useTrack } from '../../store/raceSettings';
import { mergeParts, type Part } from '../mergeParts';

/** Blok uzunligi (yo'l bo'ylab, m) — tribuna shunday bo'laklardan yig'iladi (egri joyda ham yo'lga ergashadi) */
const BLOCK = 8;
/** Yo'l chetidan tribunagacha (m): kerb + xavfsizlik zonasi */
const GAP = 12;
const ROWS = 4;
const ROW_DEPTH = 1.6;
const ROW_HEIGHT = 0.9;
const ROOF_HEIGHT = ROWS * ROW_HEIGHT + 3;
const CROWD = ['#e63946', '#f1c453', '#2a9d8f', '#457b9d', '#f4a261', '#ffffff', '#9b5de5', '#06d6a0'];

interface Block {
  position: [number, number, number];
  yaw: number;
  /** Collider markazi va yarim o'lchamlari (lokal: x — yo'lga ko'ndalang) */
  collider: { position: [number, number, number]; half: [number, number, number] };
}

/**
 * F1 tribunalari: pog'onali o'rindiqlar, rang-barang tomoshabinlar, tom, oldida panjara.
 * Hammasi bitta birlashtirilgan geometriya (1 draw call); har blokka collider (ichidan o'tib bo'lmaydi).
 */
function build({ GRANDSTANDS, roadHalfWidth, trackPoint }: Track, C: Palette) {
  const rng = createRng(1950);
  const parts: Part[] = [];
  const blocks: Block[] = [];
  const box = (size: [number, number, number], s: number, lateral: number, up: number, color: string) => {
    const p = trackPoint(s, lateral, up);
    parts.push({ geometry: new BoxGeometry(...size), position: p.position, rotation: [0, p.yaw, 0], color });
  };

  for (const g of GRANDSTANDS) {
    for (let s = g.s + BLOCK / 2; s < g.s + g.length; s += BLOCK) {
      const base = roadHalfWidth(s) + GAP;
      const out = (d: number) => g.side * (base + d); // yo'ldan tashqariga qarab ofset
      // Pog'onalar va tomoshabinlar
      for (let r = 0; r < ROWS; r++) {
        const h = (r + 1) * ROW_HEIGHT;
        box([ROW_DEPTH, h, BLOCK - 0.1], s, out(r * ROW_DEPTH + ROW_DEPTH / 2), h / 2, C.grandstand);
        for (let k = 0; k < BLOCK - 1; k += 1.1) {
          if (rng() < 0.15) continue; // bo'sh o'rinlar
          const color = CROWD[Math.floor(rng() * CROWD.length)];
          box([0.45, 0.75, 0.5], s - BLOCK / 2 + 0.6 + k, out(r * ROW_DEPTH + ROW_DEPTH * 0.6), h + 0.37, color);
        }
      }
      // Orqa devor, tom va ustunlar
      const depth = ROWS * ROW_DEPTH;
      box([0.3, ROOF_HEIGHT, BLOCK], s, out(depth + 0.15), ROOF_HEIGHT / 2, C.grandstandRoof);
      box([depth + 1.2, 0.3, BLOCK + 0.2], s, out(depth / 2), ROOF_HEIGHT, C.grandstandRoof);
      box([0.25, ROOF_HEIGHT, 0.25], s - BLOCK / 2 + 0.2, out(-0.3), ROOF_HEIGHT / 2, C.grandstandRoof);
      // Oldidagi panjara (yo'l tomonda)
      box([0.12, 1.1, BLOCK], s, out(-1.2), 0.55, C.kerbWhite);

      const p = trackPoint(s, out(depth / 2 - 0.6), 0);
      blocks.push({
        position: p.position,
        yaw: p.yaw,
        collider: { position: [0, ROOF_HEIGHT / 2, 0], half: [(depth + 1.4) / 2, ROOF_HEIGHT / 2, BLOCK / 2] },
      });
    }
  }
  return { geometry: parts.length ? mergeParts(parts) : null, blocks };
}

const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true });

/** Trassada tribuna bo'lmasa — hech narsa chizilmaydi */
export function Grandstands() {
  const track = useTrack();
  const palette = usePalette();
  const { geometry, blocks } = useMemo(() => build(track, palette), [track, palette]);
  if (!geometry) return null;
  return (
    <>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <RigidBody type="fixed" colliders={false}>
        {blocks.map((b, i) => (
          <group key={i} position={b.position} rotation={[0, b.yaw, 0]}>
            <CuboidCollider args={b.collider.half} position={b.collider.position} />
          </group>
        ))}
      </RigidBody>
    </>
  );
}
