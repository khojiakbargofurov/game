import { create } from 'zustand';
import { Quaternion, Vector3 } from 'three';
import {
  CARS,
  COSMETICS,
  ROOM,
  upgradesAt,
  type CarId,
  type CarLook,
  type CosmeticItem,
  type SpawnPoint,
  type Track,
  type UpgradeLevels,
} from '@game/shared';
import { BOT_SKILLS, newDriverState, type BotSkill, type Difficulty, type DriverState } from '../game/bots/botDriver';

/** Yakka rejimda o'yinchining standings'dagi id'si */
export const SELF_ID = 'self';

const NAMES = ['Aziz', 'Dilnoza', 'Sardor', 'Malika', 'Jasur', 'Nodira', 'Bobur', 'Zarina', 'Timur', 'Lola', 'Otabek', 'Shahlo'];

export interface BotInfo {
  id: string;
  name: string;
  color: string;
  car: CarId;
  look: CarLook;
  /** Start panjarasidagi joy (o'yinchi — 0) */
  slot: number;
  /** Yo'ldagi chizig'i: -1..1 */
  lane: number;
  skill: BotSkill;
  levels: UpgradeLevels;
}

/** Botning har kadrda o'zgaradigan holati (React state emas — `carTarget` kabi) */
export interface BotRuntime {
  position: Vector3;
  quaternion: Quaternion;
  /** Oldinga tezlik (m/s) — boshqa botlar undan qochishi uchun */
  speed: number;
  nextCheckpoint: number;
  respawnPoint: SpawnPoint;
  /** Poyga boshidan marragacha vaqt (ms); yetmagan bo'lsa null */
  finishMs: number | null;
  boostUntil: number;
  /** Countdown paytida start joyiga qo'yildimi */
  placed: boolean;
  driver: DriverState;
}

interface BotsState {
  /** Har yangi poygada oshadi — bot komponentlari (fizika body'lari) qaytadan yaratiladi */
  raceId: number;
  bots: BotInfo[];
  /** Joriy o'rinlar: SELF_ID va bot id'lari, 1-o'rindan */
  standings: string[];
  /** O'yinchi marraga yetgandagi o'rni va olgan bonus tangasi */
  finish: { place: number; bonus: number } | null;
}

export const useBots = create<BotsState>(() => ({ raceId: 0, bots: [], standings: [], finish: null }));
export const botRuntime = new Map<string, BotRuntime>();

/** O'rin uchun bonus tanga (faqat botlar bilan poygada) */
export const PLACE_BONUS = [15, 8, 4];

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const maybe = <T,>(p: number, list: readonly T[]) => (Math.random() < p ? pick(list) : null);

function randomLook(): CarLook {
  const id = (list: readonly CosmeticItem[]) => pick(list).id;
  return {
    paint: Math.random() < 0.7 ? id(COSMETICS.paint) : null,
    neon: maybe(0.25, COSMETICS.neon)?.id ?? null,
  };
}

function shuffled<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Yangi poyga uchun botlarni yaratish (start panjarasining 1..count joylarida) */
export function spawnBots(count: number, difficulty: Difficulty, track: Track) {
  botRuntime.clear();
  const base = BOT_SKILLS[difficulty];
  const names = shuffled(NAMES);
  const bots: BotInfo[] = [];
  for (let i = 0; i < count; i++) {
    const slot = i + 1;
    const id = `bot-${slot}`;
    // Har bot biroz boshqacha: tezlik ±4%, burilish ±5%
    const skill = {
      ...base,
      speed: base.speed * (0.96 + Math.random() * 0.08),
      corner: base.corner * (0.95 + Math.random() * 0.1),
    };
    bots.push({
      id,
      name: `🤖 ${names[i % names.length]}`,
      color: ROOM.PLAYER_COLORS[slot % ROOM.PLAYER_COLORS.length],
      car: pick(CARS).id,
      look: randomLook(),
      slot,
      lane: (Math.random() * 2 - 1) * 0.55,
      skill,
      levels: upgradesAt(skill.upgrades),
    });
    const spawn = track.gridSpawn(slot);
    botRuntime.set(id, {
      position: new Vector3(...spawn.position),
      quaternion: new Quaternion(),
      speed: 0,
      nextCheckpoint: 0,
      respawnPoint: spawn,
      finishMs: null,
      boostUntil: 0,
      placed: false,
      driver: newDriverState(Math.random() * 100),
    });
  }
  useBots.setState((s) => ({ raceId: s.raceId + 1, bots, standings: [], finish: null }));
}

export function clearBots() {
  botRuntime.clear();
  useBots.setState((s) => ({ raceId: s.raceId + 1, bots: [], standings: [], finish: null }));
}

/**
 * Poygadagi taxminiy yo'l (m): navbatdagi checkpointning marshrut bo'yicha masofasi minus unga qolgan
 * to'g'ri masofa. Aylanalarni ham hisobga oladi; o'rinlar va rubber-band uchun yetarli.
 */
export function raceProgress(track: Track, nextCheckpoint: number, x: number, z: number): number {
  const cp = track.CHECKPOINTS[nextCheckpoint];
  if (!cp) return 1e9;
  return cp.totalS - Math.hypot(cp.position[0] - x, cp.position[2] - z);
}
