export type Vec3 = [number, number, number];
/** Kvaternion [x, y, z, w] */
export type Quat = [number, number, number, number];

/** O'yinchi o'zi yuboradigan holat (20 Hz) */
export interface NetState {
  position: Vec3;
  rotation: Quat;
  /** Tezlik vektori (m/s) */
  velocity: Vec3;
  /** Shu paketda mashina respawn qilindi (teleport) — server tezlik tekshiruvini boshqacha qiladi */
  respawn?: boolean;
}

/** Snapshot ichidagi bitta o'yinchi holati */
export interface PlayerState extends NetState {
  id: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  /** Start panjarasidagi joy (0..MAX_PLAYERS-1) */
  slot: number;
}

export type RoomPhase = 'lobby' | 'countdown' | 'racing' | 'finished';

export interface RoomInfo {
  code: string;
  phase: RoomPhase;
  players: PlayerInfo[];
}

export interface RaceResult {
  playerId: string;
  name: string;
  color: string;
  place: number;
  /** Poyga vaqti (ms); marraga yetmagan bo'lsa null */
  timeMs: number | null;
  /** Server tasdiqlagan tangalar */
  coins: number;
  /** O'tilgan checkpointlar soni (marra ham kiradi) */
  checkpoints: number;
}
