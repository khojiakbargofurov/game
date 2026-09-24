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
] as const;

export type UpgradeId = (typeof UPGRADES)[number]['id'];
export type UpgradeLevels = Record<UpgradeId, number>;

export const MAX_UPGRADE_LEVEL = 5;
/** Keyingi darajaga o'tish narxi: COSTS[joriy daraja] */
export const UPGRADE_COSTS = [20, 40, 70, 110, 160] as const;

export const NO_UPGRADES: UpgradeLevels = { engine: 0, grip: 0, boost: 0, steering: 0 };

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
  maxSteer: number;
  highSpeedSteerFactor: number;
}

/**
 * Upgrade darajalari va ob-havo tutishidan (`grip`, WEATHER_FX) fizik parametrlar.
 * 5-darajada: tezlik +30%, tutish +40%, boost +75%, tezlikdagi rul +60%.
 */
export function carStats(levels: UpgradeLevels, grip = 1): CarStats {
  const { engine, grip: tyres, boost, steering } = levels;
  return {
    maxSpeed: CAR.MAX_SPEED * (1 + 0.06 * engine),
    engineForce: CAR.ENGINE_FORCE * (1 + 0.08 * engine),
    frictionSlip: CAR.FRICTION_SLIP * (1 + 0.08 * tyres) * grip,
    sideFriction: CAR.SIDE_FRICTION * (1 + 0.06 * tyres) * grip,
    driftSideFriction: CAR.DRIFT_SIDE_FRICTION * grip,
    brakeForce: CAR.BRAKE_FORCE * grip,
    handbrakeForce: CAR.HANDBRAKE_FORCE * grip,
    boostDurationMs: CAR.BOOST_DURATION_MS * (1 + 0.15 * boost),
    maxSteer: CAR.MAX_STEER * (1 + 0.04 * steering),
    highSpeedSteerFactor: CAR.HIGH_SPEED_STEER_FACTOR * (1 + 0.12 * steering),
  };
}
