import { BufferAttribute, Color, Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Statik detallarni bitta geometriyaga birlashtirish (vertex rang bilan) — ko'p kichik mesh o'rniga
 * bitta draw call. Ko'prik, xarobalar, mashina korpusi uchun ishlatiladi.
 */

export type V3 = [number, number, number];
export type Q4 = [number, number, number, number];

export interface Part {
  geometry: BufferGeometry;
  position: V3;
  /** Euler burchaklar (XYZ) yoki kvaternion */
  rotation?: V3 | Q4;
  scale?: V3;
  color?: string;
}

/** Geometriyani joyiga qo'yish va vertex rang berish (birlashtirish uchun atributlar bir xil bo'lishi kerak) */
export function placePart({ geometry, position, rotation = [0, 0, 0], scale = [1, 1, 1], color = '#ffffff' }: Part) {
  const q =
    rotation.length === 4 ? new Quaternion(...rotation) : new Quaternion().setFromEuler(new Euler(...rotation));
  geometry.applyMatrix4(new Matrix4().compose(new Vector3(...position), q, new Vector3(...scale)));
  if (geometry.index) geometry = geometry.toNonIndexed(); // hammasi bir xil (indekssiz) bo'lsin
  geometry.deleteAttribute('uv');
  const c = new Color(color);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

export function mergeParts(parts: Part[]): BufferGeometry {
  const merged = mergeGeometries(parts.map(placePart));
  merged.computeBoundingSphere();
  return merged;
}
