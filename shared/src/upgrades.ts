import { CAR } from './config';

/**
 * Mashina upgrade'lari: tangalar evaziga sotib olinadi (hamyon — client'da, localStorage).
 * Fizik parametrlar carStats() orqali hisoblanadi — client (haydash) va server (anti-cheat) bir xil formulani ishlatadi.
 */

export const UPGRADES = [
  { id: 'engine', label: 'Dvigatel', hint: 'Maksimal tezlik va tezlanish' },
  { id: 'grip', label: 'Shinalar', hint: "Yo'lni tutish (burilish va sirpanchiq yo'l)" },
  { id: 'boost', label: 'Boost', hint: 'Boost davomiyligi' },
  { id: 'steering', label: 'Rul', hint: 'Tezlikda burilish' },
  { id: 'brakes', label: 'Tormoz', hint: "Qisqaroq to'xtash masofasi" },
  { id: 'weight', label: 'Yengil kuzov', hint: 'Tezroq tezlanish (maksimal tezlik o\'zgarmaydi)' },
  { id: 'nitro', label: 'Nitro', hint: 'Shift — qo\'lda yoqiladigan boost; daraja = bak hajmi' },
] as const;

export type UpgradeId = (typeof UPGRADES)[number]['id'];
export type UpgradeLevels = Record<UpgradeId, number>;

export const MAX_UPGRADE_LEVEL = 5;
/** Keyingi darajaga o'tish narxi: COSTS[joriy daraja] */
export const UPGRADE_COSTS = [20, 40, 70, 110, 160] as const;

export const NO_UPGRADES: UpgradeLevels = { engine: 0, grip: 0, boost: 0, steering: 0, brakes: 0, weight: 0, nitro: 0 };

/** Barcha qismlar bir xil darajada (testlar, botlar) */
export const upgradesAt = (level: number): UpgradeLevels =>
  sanitizeUpgrades(Object.fromEntries(UPGRADES.map((u) => [u.id, level])));

/** Noma'lum/yolg'on qiymatlar — butun son, 0..MAX oralig'ida (server ham, localStorage ham shu orqali) */
export function sanitizeUpgrades(raw: unknown): UpgradeLevels {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...NO_UPGRADES };
  for (const { id } of UPGRADES) {
    const v = src[id];
    out[id] = typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_UPGRADE_LEVEL, Math.max(0, Math.floor(v))) : 0;
  }
  return out;
}

/**
 * Sozlash (bepul, garajdagi slayderlar): har biri -1..1, 0 = zavod sozlamasi.
 *  - balance: -1 boshqaruv (tutish, rul) ↔ +1 tezlik (maxSpeed +5%)
 *  - suspension: -1 yumshoq ↔ +1 qattiq
 *  - drift: -1 qo'l tormozida ham tutadi ↔ +1 oson sirpanadi
 */
export const TUNES = [
  { id: 'balance', label: 'Balans', min: 'Boshqaruv', max: 'Tezlik' },
  { id: 'suspension', label: 'Suspensiya', min: 'Yumshoq', max: 'Qattiq' },
  { id: 'drift', label: 'Drift', min: 'Tutuvchan', max: 'Sirpanchiq' },
] as const;

export type TuneId = (typeof TUNES)[number]['id'];
export type TuneSetup = Record<TuneId, number>;
export const NO_TUNE: TuneSetup = { balance: 0, suspension: 0, drift: 0 };

/** Noma'lum/yolg'on qiymatlar — -1..1 oralig'ida, 0.1 qadam bilan */
export function sanitizeTune(raw: unknown): TuneSetup {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...NO_TUNE };
  for (const { id } of TUNES) {
    const v = src[id];
    out[id] = typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(-1, v)) * 10) / 10 : 0;
  }
  return out;
}

export interface CarStats {
  maxSpeed: number;
  engineForce: number;
  frictionSlip: number;
  sideFriction: number;
  driftSideFriction: number;
  /** Tormoz va qo'l tormozi — sirpanchiq yo'lda kuchsizroq (uzunroq to'xtash masofasi) */
  brakeForce: number;
  handbrakeForce: number;
  boostDurationMs: number;
  /** Nitro bakining sig'imi (ms); 0 = nitro yo'q */
  nitroCapacityMs: number;
  maxSteer: number;
  highSpeedSteerFactor: number;
  suspensionStiffness: number;
  suspensionCompression: number;
  suspensionRelaxation: number;
}

/**
 * Upgrade darajalari, ob-havo tutishi (`grip`, WEATHER_FX) va sozlashdan (`tune`) fizik parametrlar.
 * 5-darajada: tezlik +30%, tutish +40%, boost +75%, tezlikdagi rul +60%, tormoz +50%, tezlanish +30% (yengil kuzov),
 * nitro bak 6 s.
 */
export function carStats(levels: UpgradeLevels, grip = 1, tune: TuneSetup = NO_TUNE): CarStats {
  const { engine, grip: tyres, boost, steering, brakes, weight, nitro } = levels;
  const { balance, suspension, drift } = tune;
  const handling = 1 - 0.08 * balance;
  const susp = 1 + 0.3 * suspension;
  return {
    maxSpeed: CAR.MAX_SPEED * (1 + 0.06 * engine) * (1 + 0.05 * balance),
    engineForce: CAR.ENGINE_FORCE * (1 + 0.08 * engine) * (1 + 0.06 * weight),
    frictionSlip: CAR.FRICTION_SLIP * (1 + 0.08 * tyres) * handling * grip,
    sideFriction: CAR.SIDE_FRICTION * (1 + 0.06 * tyres) * handling * grip,
    driftSideFriction: CAR.DRIFT_SIDE_FRICTION * (1 - 0.4 * drift) * grip,
    brakeForce: CAR.BRAKE_FORCE * (1 + 0.1 * brakes) * grip,
    handbrakeForce: CAR.HANDBRAKE_FORCE * (1 + 0.1 * brakes) * grip,
    boostDurationMs: CAR.BOOST_DURATION_MS * (1 + 0.15 * boost),
    nitroCapacityMs: CAR.NITRO_MS_PER_LEVEL * nitro,
    maxSteer: CAR.MAX_STEER * (1 + 0.04 * steering),
    highSpeedSteerFactor: CAR.HIGH_SPEED_STEER_FACTOR * (1 + 0.12 * steering) * (1 - 0.15 * balance),
    suspensionStiffness: CAR.SUSPENSION_STIFFNESS * susp,
    suspensionCompression: CAR.SUSPENSION_COMPRESSION * susp,
    suspensionRelaxation: CAR.SUSPENSION_RELAXATION * susp,
  };
}
