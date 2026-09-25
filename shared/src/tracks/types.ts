import type { Vec3 } from '../types';
import type { ControlPoint, NearestResult, Route, RouteFrame } from '../route';
import type { TileLayoutDef, TilePiece } from './tiles';

/**
 * circuit — F1 halqasi: keng asfalt, tekis atrof, kerblar;
 * alpine — tog' yonbag'riga o'yilgan yo'l: tepa tomonda qoya devori, past tomonda jarlik (to'siq bilan);
 * city — tungi shahar: tekis ko'chalar, trotuar, binolar
 */
export type ZoneName = 'forest' | 'canyon' | 'ruins' | 'circuit' | 'alpine' | 'city';

export interface ZoneWeights {
  forest: number;
  canyon: number;
  ruins: number;
  circuit: number;
  alpine: number;
  city: number;
}

/** Trassa zonasi: `end` — tugaydigan `s` */
export interface ZoneDef {
  type: ZoneName;
  end: number;
}

/** Trassa muhiti: tun (qorong'i osmon, fara, yonib turgan derazalar) va uzoq fon siluetlari */
export interface TrackEnv {
  night?: boolean;
  skyline?: 'peaks' | 'city';
}

export interface SpawnPoint {
  position: Vec3;
  /** Y o'qi atrofida burilish (radian); 0 = +Z tomonga qaragan */
  yaw: number;
}

export interface Checkpoint extends SpawnPoint {
  index: number;
  /** Marshrut bo'ylab masofa (halqada — aylana ichidagi) */
  s: number;
  /** Poyga boshidan umumiy masofa (aylanali poygada lap * aylana uzunligi + s) */
  totalS: number;
  /** Nechanchi aylana (0 dan); oddiy trassada doim 0 */
  lap: number;
  /** Aylana chizig'i (start/marra) — halqada har aylana oxirida */
  isLapLine: boolean;
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
  zones: readonly ZoneDef[];
  /** Checkpointlar `s` qiymatlari (marra — avtomatik, oxiridan 10 m oldin) */
  checkpoints: readonly number[];
  boosts: readonly number[];
  ramps: readonly Ramp[];
  logs: readonly Lying[];
  fallenPillars: readonly Lying[];
  arches: readonly number[];
  boulderSpawners: readonly { s: number; side: 1 | -1 }[];
  /** Aylanali poyga: yopiq halqa va aylanalar soni (berilmasa — startdan marragacha bitta yo'l) */
  laps?: number;
  /** Halqada start/marra chizig'i joyi (`s`, m). Start panjarasi undan orqada */
  startLine?: number;
  bridge: BridgeDef | null;
  tunnel: TunnelDef | null;
  narrow: NarrowDef | null;
  lake: LakeDef | null;
  /** Plitkali trassa (Kenney Racing Kit): marshrut shu plitkalardan quriladi, yo'l — kit modellari */
  tiles?: TileLayoutDef;
  /** Kit jihozlari (tribunalar, pit binolari, chodirlar, daraxtlar...) — marshrutga nisbatan joylashadi */
  props?: readonly PropDef[];
  env?: TrackEnv;
  landform?: LandformDef;
}

/**
 * Alpine zonasi uchun tog' yuzasi. Yuza marshrut balandliklari va `anchors` nuqtalaridan keskin (d⁻⁴) og'irlikli
 * o'rtacha bilan quriladi: har serpantin bo'lagi o'z pog'onasida, bo'laklar orasida — tik qoya; `anchors` (masalan,
 * pastdagi vodiy) yo'l chetida jarlik hosil qiladi. `bumps` — alohida cho'qqilar (tunnel ustidagi tog').
 * Yo'l yuzani kesib o'tadi: yuzadan pastda — qoya devori, balandda — jarlik.
 */
export interface LandformDef {
  anchors: readonly (readonly [x: number, z: number, height: number])[];
  /**
   * Yo'l yonidagi qirralar: [from, to] uchastkada `side` tomonda (1 = chap, -1 = o'ng) yo'ldan `offset` m narida
   * yuza yo'ldan `dy` m farq qiladi (musbat — qoya devori, manfiy — jarlik). Devor/jarlik yo'lga yaqin bo'lishi uchun
   */
  edges?: readonly { from: number; to: number; side: 1 | -1; offset: number; dy: number }[];
  bumps?: readonly { x: number; z: number; radius: number; height: number }[];
}

/**
 * Kit jihozi: `s` nuqtada yo'l markazidan `lateral` m (musbat = chap) yonda. Modelning old tomoni (+z)
 * `face: 'road'` bo'lsa yo'lga qaraydi, 'along' — yo'l yo'nalishiga; `yaw` — qo'shimcha burilish.
 */
export interface PropDef {
  model: string;
  s: number;
  lateral: number;
  face?: 'road' | 'along';
  yaw?: number;
  /** Masshtab ko'paytuvchisi (standart — 1) */
  scale?: number;
  /** Ichidan o'tib bo'lmaydi (quti collider) */
  solid?: boolean;
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
  /** Marshrut (halqada — bir aylana) uzunligi */
  ROUTE_LENGTH: number;
  /** Aylanalar soni (oddiy trassada 1) */
  LAPS: number;
  /** Start/marra chizig'i `s` (halqada) */
  LINE_S: number;
  /** Aylana ichidagi `s` ni `ref` umumiy masofasiga eng yaqin umumiy masofaga aylantirish (halqa uchun) */
  totalS(localS: number, ref: number): number;
  routeAt(s: number, out?: RouteFrame): RouteFrame;
  /** `y` — balandlik ham hisobga olinadi (8-shaklda ko'prik va tagidagi yo'l ajraladi) */
  nearestOnRoute(x: number, z: number, out?: NearestResult, y?: number): NearestResult;
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
  /** Plitkali trassa: kit plitkalari joylashuvi (oddiy trassada — bo'sh) */
  TILES: readonly TilePiece[];
  /** Plitka o'lchami (m); plitkali bo'lmasa 0 */
  TILE_SIZE: number;
  sampleTerrain(x: number, z: number, out?: TerrainSample): TerrainSample;
  terrainHeight(x: number, z: number): number;
}
