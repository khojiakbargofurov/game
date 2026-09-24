import { CAR, NO_UPGRADES, carStats, type CarStats } from '@game/shared';

/** Upgrade'siz, toza havodagi parametrlar (headless testlar va standart holat) */
export const BASE_STATS = carStats(NO_UPGRADES);

export interface DriveInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

export interface DriveCommand {
  /** Har bir g'ildirakka dvigatel kuchi (manfiy = orqaga) */
  engine: number;
  /** Har bir g'ildirakka tormoz */
  brake: number;
  /** Oldingi g'ildiraklar rul burchagi (radian, musbat = chapga) */
  steer: number;
  handbrake: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const moveTowards = (cur: number, target: number, maxDelta: number) =>
  Math.abs(target - cur) <= maxDelta ? target : cur + Math.sign(target - cur) * maxDelta;

/**
 * Tugmalar + joriy tezlik → dvigatel/tormoz/rul buyrug'i.
 * Sof funksiya (faqat `steer` holati saqlanadi) — fizikadan alohida sinash oson.
 *
 * @param speed mashinaning oldinga yo'nalishdagi tezligi (m/s, orqaga = manfiy)
 * @param stats upgrade'lar va ob-havoga qarab fizik parametrlar (carStats)
 */
export function computeDrive(
  prevSteer: number,
  input: DriveInput,
  speed: number,
  dt: number,
  speedMultiplier = 1,
  stats: CarStats = BASE_STATS,
): DriveCommand {
  // Rul: yuqori tezlikda maksimal burchak kichrayadi, burchak sekin (silliq) o'zgaradi
  const speedRatio = clamp(Math.abs(speed) / stats.maxSpeed, 0, 1);
  const maxSteer = stats.maxSteer * lerp(1, stats.highSpeedSteerFactor, speedRatio);
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const target = steerInput * maxSteer;
  const rate = steerInput === 0 ? CAR.STEER_RETURN_SPEED : CAR.STEER_SPEED;
  const steer = moveTowards(prevSteer, target, rate * dt);

  let engine = 0;
  let brake = input.forward || input.backward ? 0 : CAR.ROLLING_BRAKE;
  const maxSpeed = stats.maxSpeed * speedMultiplier;

  if (input.forward) {
    if (speed < -0.5) brake = stats.brakeForce; // orqaga ketayotgan bo'lsa avval tormoz
    else if (speed < maxSpeed) engine = stats.engineForce * speedMultiplier;
  } else if (input.backward) {
    if (speed > 0.5) brake = stats.brakeForce; // oldinga ketayotgan bo'lsa tormoz
    else if (speed > -CAR.MAX_REVERSE_SPEED) engine = -stats.engineForce * 0.6;
  }

  return { engine, brake, steer, handbrake: input.handbrake };
}
