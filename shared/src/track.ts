import type { Vec3 } from './types';
import { ROUTE_LENGTH, routeAt, yawOf, type RouteFrame } from './route';

/**
 * Trassa ma'lumotlari — hammasi marshrut bo'ylab masofa `s` (m) orqali berilgan.
 * Client (vizual, collider) va server (checkpoint/tanga tekshiruvi) bir xil ma'lumotni ishlatadi.
 */

export interface SpawnPoint {
  position: Vec3;
  /** Y o'qi atrofida burilish (radian); 0 = +Z tomonga qaragan */
  yaw: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ───────────────────────── Zonalar ─────────────────────────

export const ZONES = {
  /** O'rmon: 0 … FOREST_END, kanyon: … CANYON_END, xarobalar: … marra */
  FOREST_END: 480,
  CANYON_END: 880,
  BLEND: 30,
} as const;

export type ZoneName = 'forest' | 'canyon' | 'ruins';

export interface ZoneWeights {
  forest: number;
  canyon: number;
  ruins: number;
}

/** Zonalar orasida silliq o'tish uchun og'irliklar (yig'indisi = 1) */
export function zoneWeights(s: number, out: ZoneWeights = { forest: 0, canyon: 0, ruins: 0 }): ZoneWeights {
  const b = ZONES.BLEND / 2;
  const toCanyon = smoothstep(ZONES.FOREST_END - b, ZONES.FOREST_END + b, s);
  const toRuins = smoothstep(ZONES.CANYON_END - b, ZONES.CANYON_END + b, s);
  out.forest = 1 - toCanyon;
  out.ruins = toRuins;
  out.canyon = toCanyon - toRuins;
  return out;
}

export function zoneAt(s: number): ZoneName {
  if (s < ZONES.FOREST_END) return 'forest';
  if (s < ZONES.CANYON_END) return 'canyon';
  return 'ruins';
}

// ───────────────────── Maxsus uchastkalar ─────────────────────

/** Jarlik ustidagi ko'prik (o'rmon → kanyon chegarasida, daryo ustidan) */
export const BRIDGE = { start: 450, end: 505, halfWidth: 4, gorgeDepth: 16 } as const;
/** Kanyondagi g'or/tunnel */
export const TUNNEL = { start: 685, end: 750, height: 6.5 } as const;
/** Xarobalardagi tor yo'lak (ikki devor orasidan) */
export const NARROW = { start: 1118, end: 1142, halfWidth: 3.5 } as const;

const HALF_WIDTH = { forest: 7, canyon: 5, ruins: 6 } as const;
const tmpW: ZoneWeights = { forest: 0, canyon: 0, ruins: 0 };

/** Yo'lning yarim kengligi `s` nuqtada */
export function roadHalfWidth(s: number): number {
  const w = zoneWeights(s, tmpW);
  let hw = w.forest * HALF_WIDTH.forest + w.canyon * HALF_WIDTH.canyon + w.ruins * HALF_WIDTH.ruins;
  // Ko'prik va tor yo'lakda yo'l torayadi (10 m davomida silliq)
  const bridge = smoothstep(BRIDGE.start - 12, BRIDGE.start - 2, s) * (1 - smoothstep(BRIDGE.end + 2, BRIDGE.end + 12, s));
  hw += (BRIDGE.halfWidth - hw) * bridge;
  const narrow = smoothstep(NARROW.start - 10, NARROW.start, s) * (1 - smoothstep(NARROW.end, NARROW.end + 10, s));
  hw += (NARROW.halfWidth - hw) * narrow;
  return hw;
}

/** Jarlik chuqurligi koeffitsiyenti (0..1): ko'prik ostida 1 */
export function gorgeFactor(s: number): number {
  return smoothstep(BRIDGE.start, BRIDGE.start + 8, s) * (1 - smoothstep(BRIDGE.end - 8, BRIDGE.end, s));
}

/** Tunnel ustidagi tog' balandligi koeffitsiyenti (0..1) */
export function tunnelFactor(s: number): number {
  return smoothstep(TUNNEL.start - 25, TUNNEL.start, s) * (1 - smoothstep(TUNNEL.end, TUNNEL.end + 25, s));
}

// ───────────────────── Yordamchi: yo'l ustidagi nuqta ─────────────────────

const frame: RouteFrame = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 1 };

/** Marshrut nuqtasi + yon ofset (musbat = chap). Balandlik — yo'l balandligi + `up` */
export function trackPoint(s: number, lateral = 0, up = 0): { position: Vec3; yaw: number } {
  const f = routeAt(s, frame);
  return {
    position: [f.x + f.tz * lateral, f.y + up, f.z - f.tx * lateral],
    yaw: yawOf(f.tx, f.tz),
  };
}

// ───────────────────── Start va checkpointlar ─────────────────────

export const START: SpawnPoint = trackPoint(8, 0, 1.2);

/** Boshlang'ich panjara: ko'p o'yinchi uchun 2 qator × 4 */
export function gridSpawn(slot: number): SpawnPoint {
  const row = Math.floor(slot / 2);
  const lateral = slot % 2 === 0 ? 2.2 : -2.2;
  return trackPoint(26 - row * 6, lateral, 1.2);
}

export interface Checkpoint extends SpawnPoint {
  index: number;
  s: number;
  /** Shu radius ichidan o'tsa checkpoint hisoblanadi (gorizontal, m) */
  radius: number;
  isFinish: boolean;
}

const CHECKPOINT_S = [150, 300, 440, 560, 670, 800, 940, 1060, 1180, ROUTE_LENGTH - 10];

export const CHECKPOINTS: Checkpoint[] = CHECKPOINT_S.map((s, index) => {
  const p = trackPoint(s, 0, 0);
  return {
    index,
    s,
    position: p.position,
    yaw: p.yaw,
    radius: roadHalfWidth(s) + 3,
    isFinish: index === CHECKPOINT_S.length - 1,
  };
});

// ───────────────────── Tangalar va boostlar ─────────────────────

export interface Pickup {
  id: number;
  position: Vec3;
}

/** Tangalar: har 45 m da 4 talik guruh, turli naqshlarda (markaz / chap / o'ng / zigzag) */
export const COINS: Pickup[] = (() => {
  const out: Pickup[] = [];
  let group = 0;
  for (let g = 35; g < ROUTE_LENGTH - 25; g += 45, group++) {
    const hw = roadHalfWidth(g);
    const pattern = group % 4;
    for (let k = 0; k < 4; k++) {
      const lateral =
        pattern === 0 ? 0 : pattern === 1 ? hw * 0.45 : pattern === 2 ? -hw * 0.45 : (k % 2 ? 1 : -1) * hw * 0.35;
      out.push({ id: out.length, position: trackPoint(g + k * 5, lateral, 1.1).position });
    }
  }
  return out;
})();

export const COIN_RADIUS = 2.2;

/** Boost-kristallar (olingandan keyin BOOST_RESPAWN_MS dan so'ng qayta paydo bo'ladi) */
export const BOOSTS: Pickup[] = [200, 380, 598, 850, 983, 1105].map((s, id) => ({
  id,
  position: trackPoint(s, 0, 1.3).position,
}));

export const BOOST_RADIUS = 2.6;
export const BOOST_RESPAWN_MS = 6000;

// ───────────────────── Rampalar va to'siqlar ─────────────────────

export interface Ramp {
  s: number;
  lateral: number;
  width: number;
  length: number;
  height: number;
}

export const RAMPS: Ramp[] = [
  { s: 110, lateral: 0, width: 6, length: 8, height: 1.6 },
  { s: 612, lateral: 0, width: 6, length: 9, height: 2.2 },
  { s: 995, lateral: 0, width: 6, length: 8, height: 1.8 },
];

/** Yiqilgan daraxtlar: yo'lning bir tomonidan kesib o'tadi (`side`: 1 = chapdan, -1 = o'ngdan) */
export const LOGS = [
  { s: 185, side: 1, length: 9 },
  { s: 255, side: -1, length: 9 },
  { s: 330, side: 1, length: 8 },
  { s: 400, side: -1, length: 9 },
] as const;

/** Kanyonda dumalab tushuvchi toshlar manbalari */
export const BOULDER_SPAWNERS = [
  { s: 570, side: 1 },
  { s: 780, side: -1 },
  { s: 835, side: 1 },
] as const;

/** Xarobalar: yo'l ustidagi arkalar va yiqilgan ustunlar */
export const ARCHES = [925, 1075, 1200] as const;
export const FALLEN_PILLARS = [
  { s: 1040, side: 1, length: 7 },
  { s: 1165, side: -1, length: 7 },
] as const;
