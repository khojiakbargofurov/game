import { WORLD } from './config';
import { fbm2D } from './noise';
import { nearestOnRoute, type NearestResult } from './route';
import { gorgeFactor, roadHalfWidth, tunnelFactor, zoneWeights, BRIDGE, type ZoneWeights } from './track';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface TerrainSample extends ZoneWeights {
  height: number;
  /** Eng yaqin marshrut nuqtasi (s, masofa, yo'l balandligi) */
  s: number;
  dist: number;
  roadY: number;
  halfWidth: number;
}

const near: NearestResult = { s: 0, dist: 0, lateral: 0, roadY: 0 };

/**
 * Relyef: marshrut atrofida yo'l tekislanadi, uzoqlashgan sari zona xarakteri kuchayadi:
 *  - o'rmon: yumshoq tepaliklar
 *  - kanyon: yo'l ikki tomonida tik qoya devorlar (tunnel ustida yanada baland)
 *  - xarobalar: past do'ngliklar bilan plato
 * Ko'prik ostida jarlik (daryo vodiysi) o'yiladi.
 * Client (mesh, collider, manzara) va server bir xil natija oladi.
 */
export function sampleTerrain(
  x: number,
  z: number,
  out: TerrainSample = { height: 0, s: 0, dist: 0, roadY: 0, halfWidth: 0, forest: 0, canyon: 0, ruins: 0 },
): TerrainSample {
  const n = nearestOnRoute(x, z, near);
  const hw = roadHalfWidth(n.s);
  const w = zoneWeights(n.s, out);
  const d = n.dist;
  const road = n.roadY;

  const hills = fbm2D(x / 90, z / 90, WORLD.SEED, 4); // ~0..1
  const detail = fbm2D(x / 18, z / 18, WORLD.SEED + 99, 2);

  let h = road;
  if (w.forest > 0) {
    const far = smoothstep(hw + 3, hw + 45, d);
    h += w.forest * ((hills - 0.35) * WORLD.TERRAIN_HEIGHT + (detail - 0.5) * 1.5) * far;
  }
  if (w.canyon > 0) {
    const wall = smoothstep(hw + 2, hw + 14, d);
    const height = WORLD.CANYON_WALL + (hills - 0.5) * 10 + (detail - 0.5) * 4 + 12 * tunnelFactor(n.s);
    h += w.canyon * height * wall;
  }
  if (w.ruins > 0) {
    const far = smoothstep(hw + 4, hw + 40, d);
    h += w.ruins * ((hills - 0.5) * 6 + (detail - 0.5)) * far;
  }
  h -= BRIDGE.gorgeDepth * gorgeFactor(n.s);

  out.height = h;
  out.s = n.s;
  out.dist = d;
  out.roadY = road;
  out.halfWidth = hw;
  return out;
}

const tmp: TerrainSample = { height: 0, s: 0, dist: 0, roadY: 0, halfWidth: 0, forest: 0, canyon: 0, ruins: 0 };

export function terrainHeight(x: number, z: number): number {
  return sampleTerrain(x, z, tmp).height;
}
