import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, Color, CylinderGeometry, InstancedMesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { COLORS, yawOf, type BridgeDef } from '@game/shared';
import { activeTrack, usePalette, useTrack } from '../../store/raceSettings';
import { roadPitch, roadQuaternion } from './trackGeometry';
import { mergeParts, type Part } from '../mergeParts';

const PLANK = 1.2; // taxta uzunligi (yo'l bo'ylab)
const SEGMENT = 5; // collider segmenti uzunligi
const RAIL_HEIGHT = 1.1;

interface Seg {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

function segmentAt(s: number, up = 0, lateral = 0): Seg {
  const f = activeTrack().routeAt(s);
  return {
    position: [f.x + f.tz * lateral, f.y + up, f.z - f.tx * lateral],
    quaternion: roadQuaternion(yawOf(f.tx, f.tz), roadPitch(s)),
  };
}

/** Taxtalar — bitta InstancedMesh (rangi navbatma-navbat) */
/** Ko'prik o'lchamlari: taxta sathi ko'prikdan 2 m uzunroq (ikki uchida yerga tegadi) */
const deckOf = (b: BridgeDef) => ({ HW: b.halfWidth, DECK_START: b.start - 2, DECK_END: b.end + 2 });

function Planks({ bridge }: { bridge: BridgeDef }) {
  const ref = useRef<InstancedMesh>(null);
  const { HW, DECK_START, DECK_END } = deckOf(bridge);
  const count = Math.ceil((DECK_END - DECK_START) / PLANK);

  useLayoutEffect(() => {
    const mesh = ref.current!;
    const o = new Object3D();
    const light = new Color(COLORS.wood);
    const dark = new Color(COLORS.woodDark).lerp(light, 0.5);
    for (let i = 0; i < count; i++) {
      const seg = segmentAt(DECK_START + (i + 0.5) * PLANK, -0.12);
      o.position.set(...seg.position);
      o.quaternion.set(...seg.quaternion);
      // Taxtalar biroz tartibsiz — qo'lda yasalgan ko'prik hissi
      o.rotateY(((i * 37) % 7) * 0.006 - 0.018);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, i % 3 === 0 ? dark : light);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, DECK_START]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[HW * 2 + 0.6, 0.22, PLANK * 0.92]} />
      <meshStandardMaterial flatShading roughness={1} />
    </instancedMesh>
  );
}

const woodMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true });

/**
 * Jarlik ustidagi yog'och ko'prik: taxtalar, panjara, tayanch ustunlar va daryo.
 * Fizika: har 5 m da qiya cuboid (taxta sathi) + ikki yonida panjara colliderlari.
 */
/** Trassada ko'prik bo'lmasa — hech narsa chizilmaydi */
export function Bridge() {
  const { BRIDGE } = useTrack();
  return BRIDGE ? <BridgeImpl bridge={BRIDGE} /> : null;
}

function BridgeImpl({ bridge: BRIDGE }: { bridge: BridgeDef }) {
  const { HW, DECK_START, DECK_END } = deckOf(BRIDGE);
  const waterColor = usePalette().water;
  const { segments, structure, water } = useMemo(() => {
    const segments: Seg[] = [];
    for (let s = DECK_START; s < DECK_END; s += SEGMENT) segments.push(segmentAt(s + SEGMENT / 2, -0.25));
    const posts: Seg[] = [];
    for (let s = DECK_START; s <= DECK_END; s += 3) {
      posts.push(segmentAt(s, RAIL_HEIGHT / 2, HW + 0.2));
      posts.push(segmentAt(s, RAIL_HEIGHT / 2, -HW - 0.2));
    }
    // Tayanchlar jarlik tubigacha: har ~14 m da juft ustun
    const supports: (Seg & { height: number })[] = [];
    for (let s = BRIDGE.start + 10; s < BRIDGE.end - 5; s += 14) {
      const h = BRIDGE.gorgeDepth + 3;
      for (const side of [1, -1]) supports.push({ ...segmentAt(s, -h / 2, side * (HW - 0.4)), height: h });
    }
    // Panjara to'sinlari, ustunchalar va tayanchlar — bitta birlashtirilgan geometriya (1 draw call)
    const parts: Part[] = [];
    for (const seg of segments) {
      const q = new Quaternion(...seg.quaternion);
      for (const side of [1, -1]) {
        const p = new Vector3(side * (HW + 0.2), RAIL_HEIGHT, 0).applyQuaternion(q).add(new Vector3(...seg.position));
        parts.push({ geometry: new BoxGeometry(0.14, 0.14, SEGMENT + 0.05), position: p.toArray(), rotation: seg.quaternion, color: COLORS.woodDark });
      }
    }
    for (const p of posts) {
      parts.push({ geometry: new BoxGeometry(0.18, RAIL_HEIGHT + 0.2, 0.18), position: p.position, rotation: p.quaternion, color: COLORS.woodDark });
    }
    for (const p of supports) {
      parts.push({ geometry: new CylinderGeometry(0.35, 0.45, p.height, 6), position: p.position, color: COLORS.woodDark });
    }
    const structure = mergeParts(parts);

    const mid = activeTrack().routeAt((BRIDGE.start + BRIDGE.end) / 2);
    const water = {
      position: [mid.x, mid.y - BRIDGE.gorgeDepth + 2.2, mid.z] as [number, number, number],
      yaw: yawOf(mid.tx, mid.tz),
    };
    return { segments, structure, water };
  }, [BRIDGE, HW, DECK_START, DECK_END]);

  return (
    <group>
      <Planks bridge={BRIDGE} />

      <mesh geometry={structure} material={woodMaterial} castShadow receiveShadow />

      <RigidBody type="fixed" colliders={false}>
        {segments.map((seg, i) => (
          <group key={i} position={seg.position} quaternion={seg.quaternion}>
            {/* Taxta sathi + ikki yondagi panjara */}
            <CuboidCollider args={[HW + 0.3, 0.25, SEGMENT / 2 + 0.05]} friction={1} />
            {[1, -1].map((side) => (
              <CuboidCollider
                key={side}
                args={[0.1, RAIL_HEIGHT / 2, SEGMENT / 2]}
                position={[side * (HW + 0.2), RAIL_HEIGHT / 2 + 0.25, 0]}
              />
            ))}
          </group>
        ))}
      </RigidBody>

      {/* Daryo: jarlik tubida, yo'lga ko'ndalang cho'zilgan */}
      <mesh position={water.position} rotation={[-Math.PI / 2, 0, water.yaw]} receiveShadow>
        {/* Lokal X (260) — yo'lga ko'ndalang, lokal Y — yo'l bo'ylab */}
        <planeGeometry args={[260, BRIDGE.end - BRIDGE.start + 10]} />
        <meshStandardMaterial color={waterColor} roughness={0.25} metalness={0.1} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
