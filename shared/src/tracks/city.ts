import type { ControlPoint } from '../route';
import type { TrackDef } from './types';

/** Ko'cha yo'l balandligi (shahar tekis) */
const Y = 2;
/** To'g'ri ko'chalardagi va yoydagi nuqtalar orasi (m) */
const STEP = 20;
const ARC_STEP = 6;

/**
 * Ko'chalar chorrahalaridan (burchaklardan) marshrut nazorat nuqtalari: har burchak radius `r` li haqiqiy aylana yoyi
 * bilan yumaloqlanadi, to'g'ri ko'chalar ham zich nuqtalangan — Catmull-Rom siyrak nuqtalarda burilishni ikki keskin
 * bukilishga bo'lib yuborardi.
 */
function streets(corners: readonly (readonly [x: number, z: number, r: number])[]): ControlPoint[] {
  const out: ControlPoint[] = [];
  const n = corners.length;
  const dir = (a: readonly number[], b: readonly number[]) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, l];
  };
  /** Burchakning yoyga tegish masofasi (burchak cho'qqisidan) */
  const tangentLen = (i: number) => {
    const c = corners[i];
    const [ix, iz] = dir(corners[(i - 1 + n) % n], c);
    const [ox, oz] = dir(c, corners[(i + 1) % n]);
    const turn = Math.acos(Math.min(1, Math.max(-1, ix * ox + iz * oz)));
    return c[2] * Math.tan(turn / 2);
  };
  for (let i = 0; i < n; i++) {
    const c = corners[i];
    const [ix, iz] = dir(corners[(i - 1 + n) % n], c);
    const [ox, oz, outLen] = dir(c, corners[(i + 1) % n]);
    const t = tangentLen(i);
    // Yoy: kirish tegish nuqtasidan chiqishgacha, markaz — burilish tomonida
    const cross = ix * oz - iz * ox;
    const side = cross > 0 ? 1 : -1; // markaz: kirish yo'nalishining chap (+) yoki o'ng tomoni
    const [nx, nz] = [-iz * side, ix * side];
    const t1 = [c[0] - ix * t, c[1] - iz * t];
    const center = [t1[0] + nx * c[2], t1[1] + nz * c[2]];
    const a0 = Math.atan2(t1[1] - center[1], t1[0] - center[0]);
    const turn = Math.acos(Math.min(1, Math.max(-1, ix * ox + iz * oz)));
    const steps = Math.max(2, Math.ceil((turn * c[2]) / ARC_STEP));
    for (let k = 0; k <= steps; k++) {
      const a = a0 + side * (turn * k) / steps;
      out.push([center[0] + Math.cos(a) * c[2], Y, center[1] + Math.sin(a) * c[2]]);
    }
    // To'g'ri ko'cha keyingi burchak yoyigacha
    const straight = outLen - t - tangentLen((i + 1) % n);
    const k = Math.floor(straight / STEP);
    for (let j = 1; j < k; j++) {
      const d = t + (straight * j) / k;
      out.push([c[0] + ox * d, Y, c[1] + oz * d]);
    }
  }
  return out;
}

/**
 * Tokio tuni (Asphalt uslubi): neon binolar orasidagi ko'chalar bo'ylab tungi poyga — uzun prospekt,
 * 90° chorrahalar, S-burilish. Yopiq halqa, 3 aylana. Binolar, trotuar, fonarlar — client'da (City.tsx).
 */
export const CITY: TrackDef = {
  id: 'city',
  name: 'Tokio tuni',
  description: 'Neon ko\'chalar · prospekt · 3 aylana',
  seed: 1203,
  laps: 3,
  startLine: 200,
  control: streets([
    // Janubiy prospekt (start), sharqqa
    [-380, -300, 42],
    [350, -300, 42],
    // Sharqiy ko'cha, shimolga
    [350, 0, 36],
    // G'arbga qisqa ko'cha, so'ng shimolga (S-burilishli)
    [110, 0, 34],
    [110, 110, 32],
    [60, 160, 32],
    [60, 300, 36],
    // Shimoliy ko'cha, g'arbga
    [-240, 300, 36],
    // Pastga, so'ng g'arbga
    [-240, 60, 34],
    [-380, 60, 36],
  ]),
  zones: [{ type: 'city', end: Infinity }],
  env: { night: true, skyline: 'city' },
  checkpoints: [300, 600, 900, 1200, 1500, 1800, 2100],
  boosts: [200, 520, 980, 1400, 1750, 2150],
  ramps: [],
  logs: [],
  fallenPillars: [],
  arches: [],
  boulderSpawners: [],
  bridge: null,
  tunnel: null,
  narrow: null,
  lake: null,
};
