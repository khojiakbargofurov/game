import type { Vec3 } from '../types';
import type { ControlPoint, NearestResult, Route, RouteFrame } from '../route';

export type ZoneName = 'forest' | 'canyon' | 'ruins';

export interface ZoneWeights {
  forest: number;
  canyon: number;
  ruins: number;
}

export interface SpawnPoint {
  position: Vec3;
  /** Y o'qi atrofida burilish (radian); 0 = +Z tomonga qaragan */
  yaw: number;
}

export interface Checkpoint extends SpawnPoint {
  index: number;
  s: number;
  /** Shu radius ichidan o'tsa checkpoint hisoblanadi (gorizontal, m) */
  radius: number;
  isFinish: boolean;
}

export interface Pickup {
  id: number;
  position: Vec3;
}

export interface Ramp {
  s: number;
  lateral: number;
  width: number;
  length: number;
  height: number;
}

/** Yo'lga ko'ndalang yotgan to'siq: `side` 1 = chapdan, -1 = o'ngdan kesib o'tadi */
export interface Lying {
  s: number;
  side: 1 | -1;
  length: number;
}

export interface BridgeDef {
  start: number;
  end: number;
  halfWidth: number;
  gorgeDepth: number;
}

export interface TunnelDef {
  start: number;
  end: number;
  height: number;
}

export interface NarrowDef {
  start: number;
  end: number;
  halfWidth: number;
}

/** Ko'l: markaz atrofida relyef `y` sathidan `depth` chuqurlikka botadi, ustida suv */
export interface LakeDef {
  x: number;
  z: number;
  radius: number;
  /** Suv sathi (m) */
  y: number;
  depth: number;
}

/**
 * Trassa ta'rifi — faqat ma'lumot. Barcha obyektlar marshrut bo'ylab masofa `s` (m) orqali beriladi.
 * createTrack() undan relyef, checkpointlar, tangalar va h.k. quradi (client ham, server ham).
 */
export interface TrackDef {
  id: string;
  /** Menyudagi nom va qisqa tavsif */
  name: string;
  description: string;
  /** Relyef shovqini uchun seed (WORLD.SEED ga qo'shiladi) */
  seed: number;
  control: readonly ControlPoint[];
  /** Zonalar ketma-ketligi; `end` — zona tugaydigan `s` (oxirgisi Infinity) */
  zones: readonly { type: ZoneName; end: number }[];
  /** Checkpointlar `s` qiymatlari (marra — avtomatik, oxiridan 10 m oldin) */
  checkpoints: readonly number[];
  boosts: readonly number[];
  ramps: readonly Ramp[];
  logs: readonly Lying[];
  fallenPillars: readonly Lying[];
  arches: readonly number[];
  boulderSpawners: readonly { s: number; side: 1 | -1 }[];
  bridge: BridgeDef | null;
  tunnel: TunnelDef | null;
  narrow: NarrowDef | null;
  lake: LakeDef | null;
}

export interface TerrainSample extends ZoneWeights {
  height: number;
  /** Eng yaqin marshrut nuqtasi (s, masofa, yo'l balandligi) */
  s: number;
  dist: number;
  roadY: number;
  halfWidth: number;
}

/** Qurilgan trassa: client (vizual, collider) va server (checkpoint/tanga tekshiruvi) bir xil ma'lumotni oladi */
export interface Track {
  id: string;
  def: TrackDef;
  ROUTE: Route;
  ROUTE_LENGTH: number;
  routeAt(s: number, out?: RouteFrame): RouteFrame;
  nearestOnRoute(x: number, z: number, out?: NearestResult): NearestResult;
  zoneWeights(s: number, out?: ZoneWeights): ZoneWeights;
  zoneAt(s: number): ZoneName;
  BRIDGE: BridgeDef | null;
  TUNNEL: TunnelDef | null;
  NARROW: NarrowDef | null;
  LAKE: LakeDef | null;
  roadHalfWidth(s: number): number;
  gorgeFactor(s: number): number;
  tunnelFactor(s: number): number;
  /** Marshrut nuqtasi + yon ofset (musbat = chap). Balandlik — yo'l balandligi + `up` */
  trackPoint(s: number, lateral?: number, up?: number): { position: Vec3; yaw: number };
  START: SpawnPoint;
  /** Boshlang'ich panjara: ko'p o'yinchi uchun 2 qator × 4 */
  gridSpawn(slot: number): SpawnPoint;
  CHECKPOINTS: Checkpoint[];
  COINS: Pickup[];
  BOOSTS: Pickup[];
  RAMPS: readonly Ramp[];
  LOGS: readonly Lying[];
  FALLEN_PILLARS: readonly Lying[];
  ARCHES: readonly number[];
  BOULDER_SPAWNERS: readonly { s: number; side: 1 | -1 }[];
  sampleTerrain(x: number, z: number, out?: TerrainSample): TerrainSample;
  terrainHeight(x: number, z: number): number;
}
