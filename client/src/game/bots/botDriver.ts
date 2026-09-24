import { yawOf, type NearestResult, type RouteFrame, type Track } from '@game/shared';
import type { DriveInput } from '../car/driveLogic';

/**
 * Bot haydovchisi — sof funksiya (React/fizikadan mustaqil, headless simulyatsiyada ham ishlaydi).
 *  - rul: marshrut bo'ylab oldindagi nuqtaga (o'z "chizig'i" — yo'l markazidan yon ofset bilan);
 *  - tezlik: oldindagi burilishlar egriligidan ruxsat etilgan tezlik (burilishdan oldin tormoz);
 *  - qotib qolsa: orqaga yurib chiqish, baribir chiqolmasa — respawn so'raydi.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Oson' },
  { id: 'medium', label: "O'rta" },
  { id: 'hard', label: 'Qiyin' },
];

export interface BotSkill {
  /** Maksimal tezlikning ulushi to'g'ri yo'lda */
  speed: number;
  /** Burilishda ruxsat etilgan yon tezlanish ulushi (1 = chegarada) */
  corner: number;
  /** Rul "titrashi" (xatolar) */
  noise: number;
  /** Botlarga beriladigan upgrade darajasi (barcha qismlar) */
  upgrades: number;
}

export const BOT_SKILLS: Record<Difficulty, BotSkill> = {
  easy: { speed: 0.72, corner: 0.7, noise: 0.18, upgrades: 0 },
  medium: { speed: 0.86, corner: 0.85, noise: 0.1, upgrades: 2 },
  hard: { speed: 0.98, corner: 1, noise: 0.04, upgrades: 4 },
};

/** Yon tezlanish chegarasi (m/s²) toza havoda, to'liq tutishda — sim-bots bilan sozlangan */
const LATERAL_ACCEL = 15;
/** Burilishdan oldin tormozlash uchun hisoblangan sekinlanish (m/s²) */
const BRAKE_DECEL = 11;
const STUCK_SPEED = 1.5;
const STUCK_TIME = 1.5;
const REVERSE_TIME = 1.1;

export interface DriverState {
  /** Ichki soat (s) */
  t: number;
  stuck: number;
  reverseUntil: number;
  /** Ketma-ket orqaga chiqishlar — ko'p bo'lsa respawn */
  reverses: number;
  offRoad: number;
  /** Har bot uchun alohida shovqin fazasi */
  seed: number;
}

export const newDriverState = (seed: number): DriverState => ({ t: 0, stuck: 0, reverseUntil: 0, reverses: 0, offRoad: 0, seed });

export interface DriveContext {
  track: Track;
  x: number;
  /** Balandlik — 8-shakl trassada ko'prik va uning tagidagi yo'lni ajratish uchun */
  y: number;
  z: number;
  yaw: number;
  /** Oldinga tezlik (m/s) */
  speed: number;
  dt: number;
  skill: BotSkill;
  /** Chiziq: -1..1 (yo'l yarim kengligining ulushi, musbat = chap) */
  lane: number;
  /** Mashinaning maksimal tezligi (upgrade'lar bilan), m/s */
  maxSpeed: number;
  /** Ob-havo tutishi (WEATHER_FX.grip) */
  grip: number;
  /** Rubber-band koeffitsiyenti (1 = yo'q) */
  pace: number;
  /** Boshqa mashinalar (o'yinchi, boshqa botlar) — oldidagisini aylanib o'tish uchun */
  others?: readonly { x: number; z: number; speed: number }[];
}

/** Oldindagi mashinani ko'rish masofasi va "yo'lakda" hisoblanadigan yon masofa (m) */
const AVOID_AHEAD = 16;
const AVOID_SIDE = 2.6;

const frame: RouteFrame = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 1 };
const nearRes: NearestResult = { s: 0, dist: 0, lateral: 0, roadY: 0 };
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Marshrutning `s` nuqtadagi egriligi (rad/m) — ikki tomondagi tangenslar farqidan */
function curvature(track: Track, s: number) {
  const a = track.routeAt(s - 6, frame);
  const ya = yawOf(a.tx, a.tz);
  const b = track.routeAt(s + 6, frame);
  return Math.abs(wrap(yawOf(b.tx, b.tz) - ya)) / 12;
}

/** Oldindagi burilishlarni hisobga olib, hozir ruxsat etilgan tezlik */
export function targetSpeed(track: Track, s: number, speed: number, cruise: number, latAccel: number) {
  let target = cruise;
  const horizon = 15 + (speed * speed) / (2 * BRAKE_DECEL);
  for (let d = 0; d <= horizon; d += 6) {
    const k = curvature(track, s + d);
    if (k < 1e-3) continue;
    const vc = Math.sqrt(latAccel / k);
    // Shu burilishgacha tormozlab yetib olish mumkin bo'lgan tezlik
    target = Math.min(target, Math.sqrt(vc * vc + 2 * BRAKE_DECEL * d));
  }
  return target;
}

export interface DriveOutput {
  input: DriveInput;
  /** Qotib qoldi — respawn qilish kerak */
  respawn: boolean;
  /** Marshrutdagi joriy nuqta (m) */
  s: number;
}

export function botDrive(st: DriverState, c: DriveContext): DriveOutput {
  const { track, x, y, z, yaw, speed, dt, skill } = c;
  st.t += dt;
  const n = track.nearestOnRoute(x, z, nearRes, y);
  const s = n.s;
  const halfWidth = track.roadHalfWidth(s);

  // Rul: oldindagi nuqta (tezlikka qarab uzoqroq), o'z chizig'ida
  const ahead = 6 + Math.abs(speed) * 0.45;
  const p = track.routeAt(s + ahead, frame);
  const lane = c.lane * Math.max(0, track.roadHalfWidth(p.s) - 1.6);
  const tx = p.x + p.tz * lane;
  const tz = p.z - p.tx * lane;
  const diff = wrap(Math.atan2(tx - x, tz - z) - yaw);
  const wobble = skill.noise * (Math.sin(st.t * 0.9 + st.seed) + Math.sin(st.t * 2.3 + st.seed * 2) * 0.5);

  // Tezlik: to'g'rida cruise, burilishdan oldin sekinlashish
  const cruise = c.maxSpeed * skill.speed * c.pace;
  const latAccel = LATERAL_ACCEL * skill.corner * c.grip;
  const target = targetSpeed(track, s, Math.max(speed, 0), cruise, latAccel);

  // Yo'ldan juda uzoqlashib ketdi (masalan, jarlikka tushib chiqolmayapti)
  st.offRoad = n.dist > halfWidth + 25 ? st.offRoad + dt : 0;

  // To'qnashuvdan qochish: oldindagi eng yaqin mashina yo'lakda bo'lsa — yon tomonga o'tish va sekinlashish
  let dodge = 0;
  let follow = Infinity;
  if (c.others) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    let nearest = AVOID_AHEAD;
    for (const o of c.others) {
      const rx = o.x - x;
      const rz = o.z - z;
      const along = rx * fx + rz * fz;
      if (along <= 0 || along >= nearest) continue;
      const side = rx * fz - rz * fx; // musbat = chap tomonda
      if (Math.abs(side) > AVOID_SIDE) continue;
      nearest = along;
      // Mashina chapda bo'lsa — o'ngga, aks holda chapga (yo'l chetiga qarab emas: chiziq tomonga)
      const away = side > 0.3 ? -1 : side < -0.3 ? 1 : c.lane >= 0 ? 1 : -1;
      dodge = away * (1 - along / AVOID_AHEAD);
      // Juda yaqin va to'g'ri oldida — undan tezroq yurmaslik
      if (along < 7 && Math.abs(side) < 1.9) follow = Math.max(0, o.speed - 1);
    }
  }

  // Qotib qolish: tezlik juda past — orqaga yurib chiqish
  if (st.t < st.reverseUntil) {
    return {
      input: { forward: false, backward: true, left: false, right: false, handbrake: false, steerAxis: -Math.sign(diff) },
      respawn: false,
      s,
    };
  }
  st.stuck = Math.abs(speed) < STUCK_SPEED ? st.stuck + dt : Math.max(0, st.stuck - dt * 2);
  if (st.stuck > STUCK_TIME) {
    st.stuck = 0;
    st.reverses++;
    st.reverseUntil = st.t + REVERSE_TIME;
  }
  if (Math.abs(speed) > 8) st.reverses = 0;
  const respawn = st.reverses >= 3 || st.offRoad > 3;
  if (respawn) {
    st.reverses = 0;
    st.offRoad = 0;
  }

  return {
    input: {
      forward: speed < Math.min(target, follow),
      backward: speed > Math.min(target, follow) + 2.5,
      left: false,
      right: false,
      handbrake: false,
      steerAxis: clamp(diff * 2.4 + wobble + dodge * 0.9, -1, 1),
    },
    respawn,
    s,
  };
}
