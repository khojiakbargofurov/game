import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, Color, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import {
  ARCHES,
  COLORS,
  NARROW,
  ROUTE_LENGTH,
  ZONES,
  createRng,
  roadHalfWidth,
  terrainHeight,
  trackPoint,
} from '@game/shared';
import { mergeParts } from '../mergeParts';

interface Column {
  x: number;
  y: number;
  z: number;
  height: number;
  radius: number;
  broken: boolean;
  tilt: number;
}

/** Yo'l bo'yidagi ustunlar qatori (ba'zilari singan, ba'zilari yo'q) — deterministik */
function generateColumns(): Column[] {
  const rng = createRng(777);
  const out: Column[] = [];
  for (let s = ZONES.CANYON_END + 15; s < ROUTE_LENGTH - 20; s += 13) {
    // Arka va tor yo'lak atrofida qo'ymaymiz
    if (ARCHES.some((a) => Math.abs(a - s) < 8) || (s > NARROW.start - 8 && s < NARROW.end + 8)) continue;
    for (const side of [1, -1]) {
      if (rng() < 0.3) continue;
      const lateral = side * (roadHalfWidth(s) + 2.6 + rng() * 1.5);
      const [x, , z] = trackPoint(s, lateral).position;
      const broken = rng() < 0.45;
      out.push({
        x,
        z,
        y: terrainHeight(x, z),
        height: broken ? 1.5 + rng() * 2.5 : 5 + rng() * 2,
        radius: 0.55 + rng() * 0.15,
        broken,
        tilt: broken ? (rng() - 0.5) * 0.15 : 0,
      });
    }
  }
  return out;
}

/** Ustunlar — bitta InstancedMesh (tana) + qalpoqlar (butun ustunlarda) */
function Columns({ columns }: { columns: Column[] }) {
  const shafts = useRef<InstancedMesh>(null);
  const caps = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const o = new Object3D();
    const light = new Color(COLORS.ruins);
    const dark = new Color(COLORS.ruinsDark);
    let capCount = 0;
    columns.forEach((c, i) => {
      o.position.set(c.x, c.y + c.height / 2 - 0.2, c.z);
      o.rotation.set(c.tilt, i * 0.7, c.tilt * 0.5);
      o.scale.set(c.radius, c.height, c.radius);
      o.updateMatrix();
      shafts.current!.setMatrixAt(i, o.matrix);
      shafts.current!.setColorAt(i, i % 3 ? light : dark);
      if (!c.broken) {
        o.position.set(c.x, c.y + c.height - 0.1, c.z);
        o.rotation.set(0, i * 0.7, 0);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        caps.current!.setMatrixAt(capCount++, o.matrix);
      }
    });
    caps.current!.count = capCount;
    shafts.current!.instanceMatrix.needsUpdate = true;
    caps.current!.instanceMatrix.needsUpdate = true;
  }, [columns]);

  return (
    <>
      <instancedMesh ref={shafts} args={[undefined, undefined, columns.length]} castShadow receiveShadow>
        {/* Birlik silindr — o'lcham instance scale orqali */}
        <cylinderGeometry args={[1, 1.1, 1, 8]} />
        <meshStandardMaterial flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, columns.length]} castShadow>
        <boxGeometry args={[1.6, 0.4, 1.6]} />
        <meshStandardMaterial color={COLORS.ruins} flatShading />
      </instancedMesh>
    </>
  );
}

const ARCH_HEIGHT = 7;

interface Block {
  position: [number, number, number];
  yaw: number;
  size: [number, number, number];
  color: string;
  /** Collider ham kerakmi (dekor tishlar uchun — yo'q) */
  solid: boolean;
}

/**
 * Arkalar va tor yo'lak devorlari — tosh bloklar ro'yxati (dunyo koordinatalarida).
 * Vizual qism bitta birlashtirilgan mesh, colliderlar alohida.
 */
function generateBlocks(): Block[] {
  const blocks: Block[] = [];
  const at = (s: number, lateral: number, up: number) => trackPoint(s, lateral, up);

  for (const s of ARCHES) {
    const span = roadHalfWidth(s) + 1.6;
    for (const side of [1, -1]) {
      const p = at(s, side * span, ARCH_HEIGHT / 2);
      blocks.push({ position: p.position, yaw: p.yaw, size: [1.6, ARCH_HEIGHT, 1.6], color: COLORS.ruins, solid: true });
    }
    const top = at(s, 0, ARCH_HEIGHT + 0.6);
    blocks.push({ position: top.position, yaw: top.yaw, size: [span * 2 + 2.6, 1.2, 1.9], color: COLORS.ruinsDark, solid: false });
    const crown = at(s, 0, ARCH_HEIGHT + 1.5);
    blocks.push({ position: crown.position, yaw: crown.yaw, size: [span * 1.2, 0.6, 1.4], color: COLORS.ruins, solid: false });
  }

  let i = 0;
  for (let s = NARROW.start - 4; s < NARROW.end + 4; s += 4) {
    for (const side of [1, -1]) {
      const lateral = side * (roadHalfWidth(s + 2) + 0.9);
      const wall = at(s + 2, lateral, 1.6);
      blocks.push({
        position: wall.position,
        yaw: wall.yaw,
        size: [1.6, 3.6, 4.1],
        color: i % 4 < 2 ? COLORS.ruins : COLORS.ruinsDark,
        solid: true,
      });
      // Devor tishi
      if (i % 2 === 0) {
        const tooth = at(s + 2, lateral, 3.7);
        blocks.push({ position: tooth.position, yaw: tooth.yaw, size: [1.6, 0.8, 1.6], color: COLORS.ruins, solid: false });
      }
      i++;
    }
  }
  return blocks;
}

const stoneMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true });

/** Qadimiy xarobalar zonasi dekori: ustunlar (instanced), arkalar va tor yo'lak devorlari (birlashtirilgan) */
export function Ruins() {
  const columns = useMemo(generateColumns, []);
  const { blocks, stone } = useMemo(() => {
    const blocks = generateBlocks();
    const stone = mergeParts(
      blocks.map((b) => ({ geometry: new BoxGeometry(...b.size), position: b.position, rotation: [0, b.yaw, 0], color: b.color })),
    );
    return { blocks, stone };
  }, []);
  return (
    <>
      <Columns columns={columns} />
      <RigidBody type="fixed" colliders={false}>
        {columns.map((c, i) => (
          <CylinderCollider key={i} args={[c.height / 2, c.radius]} position={[c.x, c.y + c.height / 2, c.z]} />
        ))}
      </RigidBody>
      <mesh geometry={stone} material={stoneMaterial} castShadow receiveShadow />
      <RigidBody type="fixed" colliders={false}>
        {blocks
          .filter((b) => b.solid)
          .map((b, i) => (
            <CuboidCollider
              key={i}
              args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}
              position={b.position}
              rotation={[0, b.yaw, 0]}
            />
          ))}
      </RigidBody>
    </>
  );
}
