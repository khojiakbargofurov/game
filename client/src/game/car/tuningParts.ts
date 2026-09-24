import { useMemo } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { findCosmetic, type CosmeticCategory } from '@game/shared';
import type { CarModel } from './carGeometry';

/**
 * Vizual tuning qismlari uchun materiallar va geometriyalar.
 * Materiallar rang bo'yicha keshlanadi — bir xil bo'yoqli mashinalar bitta materialni bo'lishadi.
 */

const standardCache = new Map<string, MeshStandardMaterial>();

/** Tanlangan buyumning materiali (bo'yoq, disk, spoyler); tanlanmagan bo'lsa — undefined */
export function cosmeticMaterial(cat: CosmeticCategory, id: string | null): MeshStandardMaterial | undefined {
  const item = findCosmetic(cat, id);
  if (!item) return undefined;
  const key = `${item.color}:${item.metallic ? 1 : 0}`;
  let m = standardCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color: item.color,
      flatShading: true,
      metalness: item.metallic ? 0.75 : 0.05,
      roughness: item.metallic ? 0.28 : 0.6,
    });
    standardCache.set(key, m);
  }
  return m;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
  new BoxGeometry(w, h, d).translate(x, y, z);

const spoilerCache = new WeakMap<CarModel, Record<string, BufferGeometry>>();

/** Spoyler geometriyasi: ikki ustun + qanot (korpusning orqa tepasida) */
export function useSpoilerGeometry(model: CarModel, kind: string | null): BufferGeometry | null {
  return useMemo(() => {
    if (!kind) return null;
    let byKind = spoilerCache.get(model);
    if (!byKind) spoilerCache.set(model, (byKind = {}));
    if (!byKind[kind]) {
      const { min, max } = model.bounds;
      const width = (max.x - min.x) * (kind === 'high' ? 0.95 : 0.8);
      const lift = kind === 'high' ? 0.42 : 0.16;
      const z = min.z + 0.28;
      const top = max.y - 0.08 + lift;
      const strutX = width * 0.3;
      byKind[kind] = mergeGeometries([
        box(0.06, lift + 0.1, 0.12, strutX, top - lift / 2, z),
        box(0.06, lift + 0.1, 0.12, -strutX, top - lift / 2, z),
        box(width, 0.05, kind === 'high' ? 0.42 : 0.3, 0, top + 0.02, z - 0.04),
        box(0.04, 0.16, 0.36, width / 2, top + 0.06, z - 0.04),
        box(0.04, 0.16, 0.36, -width / 2, top + 0.06, z - 0.04),
      ])!;
    }
    return byKind[kind];
  }, [model, kind]);
}

/** Neon yorug'ligi uchun yumshoq chetli to'rtburchak (oq — rangni material beradi) */
let glowTexture: CanvasTexture | null = null;
function glow() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return (glowTexture = new CanvasTexture(c));
}

const neonCache = new Map<string, MeshBasicMaterial>();

/** Mashina ostidagi neon: additive, chuqurlik yozmaydi (yo'lga "nur tushgandek") */
export function neonMaterial(id: string | null): MeshBasicMaterial | undefined {
  const item = findCosmetic('neon', id);
  if (!item) return undefined;
  let m = neonCache.get(item.color);
  if (!m) {
    m = new MeshBasicMaterial({
      color: item.color,
      map: glow(),
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    neonCache.set(item.color, m);
  }
  return m;
}
