/**
 * Headless simulyatsiya uchun plitkali trassaning ko'tarilgan qismlari (rampa, ko'prik) collideri —
 * client (KitTrack) bilan bir xil: client/public/kit/ dagi GLB'lar, joylashuv — shared tileVertex.
 * GLB oddiy o'qiladi (Kenney modellari: tugunda faqat siljish, har primitivda POSITION + indekslar).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import RAPIER from '@dimforge/rapier3d-compat';
import { tileVertex, type Track } from '@game/shared';

const KIT = fileURLToPath(new URL('../public/kit/', import.meta.url));

interface Gltf {
  nodes: { mesh?: number; translation?: number[] }[];
  meshes: { primitives: { attributes: { POSITION: number }; indices: number }[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; componentType: number }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
}

/** Model uchburchaklari: tekis ro'yxat [x, y, z, x, y, z, ...] (har 9 son — bitta uchburchak) */
function modelTriangles(name: string): number[] {
  const buf = readFileSync(`${KIT}${name}.glb`);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen)) as Gltf;
  const bin = 20 + jsonLen + 8;
  const out: number[] = [];
  for (const node of gltf.nodes) {
    if (node.mesh === undefined) continue;
    const [tx, ty, tz] = node.translation ?? [0, 0, 0];
    for (const prim of gltf.meshes[node.mesh].primitives) {
      const pa = gltf.accessors[prim.attributes.POSITION];
      const pv = gltf.bufferViews[pa.bufferView];
      const pOff = bin + (pv.byteOffset ?? 0) + (pa.byteOffset ?? 0);
      const stride = pv.byteStride ?? 12;
      const ia = gltf.accessors[prim.indices];
      const iv = gltf.bufferViews[ia.bufferView];
      const iOff = bin + (iv.byteOffset ?? 0) + (ia.byteOffset ?? 0);
      const wide = ia.componentType === 5125;
      for (let k = 0; k < ia.count; k++) {
        const idx = wide ? buf.readUInt32LE(iOff + k * 4) : buf.readUInt16LE(iOff + k * 2);
        const o = pOff + idx * stride;
        out.push(buf.readFloatLE(o) + tx, buf.readFloatLE(o + 4) + ty, buf.readFloatLE(o + 8) + tz);
      }
    }
  }
  return out;
}

/** Ko'tarilgan plitkalar uchun trimesh collider qo'shadi; nechta uchburchak qo'shilganini qaytaradi */
export function addKitColliders(world: RAPIER.World, track: Track): number {
  if (!track.TILE_SIZE) return 0;
  const cache = new Map<string, number[]>();
  const verts: number[] = [];
  const v = [0, 0, 0];
  for (const piece of track.TILES) {
    if (!piece.elevated) continue;
    let tri = cache.get(piece.model);
    if (!tri) cache.set(piece.model, (tri = modelTriangles(piece.model)));
    for (let i = 0; i < tri.length; i += 3) {
      tileVertex(piece, track.TILE_SIZE, track.def.tiles!.y, tri[i], tri[i + 1], tri[i + 2], v);
      verts.push(v[0], v[1], v[2]);
    }
  }
  if (!verts.length) return 0;
  const indices = Uint32Array.from({ length: verts.length / 3 }, (_, i) => i);
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(verts), indices).setFriction(1));
  return indices.length / 3;
}
