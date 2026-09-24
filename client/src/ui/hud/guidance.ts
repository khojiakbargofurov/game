import type { NearestResult, RouteFrame } from '@game/shared';
import { Vector3 } from 'three';
import { carTarget } from '../../game/carTarget';
import { activeTrack } from '../../store/raceSettings';

export interface Guidance {
  /** Strelka burchagi (radian): 0 = to'g'ri oldinga, musbat = o'ngga */
  angle: number;
  /** Keyingi checkpointgacha masofa (m, yo'l bo'ylab) */
  distance: number;
  /** Checkpointni o'tkazib yuborgan — orqaga qaytish kerak */
  missed: boolean;
  /** Mashina yo'lga teskari yo'nalishda ketmoqda */
  wrongWay: boolean;
}

const near: NearestResult = { s: 0, dist: 0, lateral: 0, roadY: 0 };
const frame: RouteFrame = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 1 };
const fwd = new Vector3();
const LOOK_AHEAD = 35;

/**
 * Keyingi checkpointga yo'nalish. To'g'ri chiziq bo'yicha emas, marshrut bo'ylab oldindagi nuqtaga
 * qaratiladi — aks holda strelka tog' yoki kanyon devori orqali ko'rsatardi.
 */
export function computeGuidance(nextCheckpoint: number): Guidance | null {
  const { CHECKPOINTS, nearestOnRoute, routeAt, totalS } = activeTrack();
  const cp = CHECKPOINTS[nextCheckpoint];
  if (!cp) return null;
  const { x, y, z } = carTarget.position;
  nearestOnRoute(x, z, near, y);
  // Aylanali poygada — umumiy masofa (checkpointga nisbatan eng yaqin aylana)
  const nearS = totalS(near.s, cp.totalS);

  const missed = nearS > cp.totalS + 25;
  const targetS = missed ? cp.totalS : Math.min(nearS + LOOK_AHEAD, cp.totalS);
  routeAt(targetS, frame);
  const dx = frame.x - x;
  const dz = frame.z - z;

  fwd.set(0, 0, 1).applyQuaternion(carTarget.quaternion);
  const fx = fwd.x;
  const fz = fwd.z;
  // O'ng vektor = oldinga × tepaga = (-fz, 0, fx)
  const rightness = -dx * fz + dz * fx;
  const forwardness = dx * fx + dz * fz;

  routeAt(near.s, frame);
  const alongRoute = fx * frame.tx + fz * frame.tz;

  return {
    angle: Math.atan2(rightness, forwardness),
    distance: missed ? Math.hypot(cp.position[0] - x, cp.position[2] - z) : cp.totalS - nearS,
    missed,
    wrongWay: !missed && alongRoute < -0.4 && Math.abs(carTarget.speed) > 4 && near.dist < 20,
  };
}
