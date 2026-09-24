import { ANTI_CHEAT, CAR, carStats, type NetState, type Track, type UpgradeLevels, type Vec3 } from '@game/shared';

/** Server qabul qiladigan maksimal gorizontal tezlik (m/s) — o'yinchining dvigatel darajasiga qarab */
export const maxAllowedSpeed = (levels: UpgradeLevels) =>
  carStats(levels).maxSpeed * CAR.BOOST_MULTIPLIER * ANTI_CHEAT.SPEED_TOLERANCE;

const horizontalDistance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/**
 * Oddiy harakat tekshiruvi (server "oxirgi qabul qilingan holat"ni saqlaydi):
 *  - oddiy paket: oxirgi qabul qilingan pozitsiyadan gorizontal siljish
 *    maxSpeed * (o'tgan vaqt + SLACK) dan oshmasligi kerak (vertikal — tushish/sakrash — hisobga olinmaydi);
 *  - e'lon qilingan tezlik vektori ham chegaradan oshmasligi kerak;
 *  - respawn paketi: faqat o'z start joyiga yoki oxirgi o'tilgan checkpointga teleport qilish mumkin.
 */
export function validateMove(
  prev: { state: NetState; at: number } | null,
  next: NetState,
  now: number,
  track: Track,
  slot: number,
  /** Oxirgi o'tilgan checkpoint indeksi (-1 = hali hech biri) */
  lastCheckpoint: number,
  levels: UpgradeLevels,
): { ok: true } | { ok: false; reason: string } {
  const maxSpeed = maxAllowedSpeed(levels);
  const declaredSpeed = Math.hypot(next.velocity[0], next.velocity[2]);
  if (declaredSpeed > maxSpeed) return { ok: false, reason: `tezlik ${declaredSpeed.toFixed(1)} m/s` };

  if (next.respawn) {
    const targets: Vec3[] = [track.gridSpawn(slot).position];
    if (lastCheckpoint >= 0) targets.push(track.CHECKPOINTS[lastCheckpoint].position);
    const near = targets.some((t) => horizontalDistance(t, next.position) < ANTI_CHEAT.RESPAWN_RADIUS);
    return near ? { ok: true } : { ok: false, reason: 'respawn nuqtasi noto`g`ri' };
  }

  if (!prev) return { ok: true };
  const dt = Math.max(0, (now - prev.at) / 1000);
  const allowed = maxSpeed * (dt + ANTI_CHEAT.TIME_SLACK);
  const moved = horizontalDistance(prev.state.position, next.position);
  return moved <= allowed ? { ok: true } : { ok: false, reason: `sakrash ${moved.toFixed(1)} m / ${dt.toFixed(2)} s` };
}

/** Oxirgi qabul qilingan pozitsiya nuqtaga `radius` + zaxira ichidami (checkpoint, tanga tekshiruvi) */
export function isNear(last: { state: NetState } | null, target: Vec3, radius: number): boolean {
  if (!last) return false;
  const p = last.state.position;
  const horizontal = horizontalDistance(p, target);
  return horizontal <= radius + ANTI_CHEAT.CHECKPOINT_RADIUS_TOLERANCE && Math.abs(p[1] - target[1]) < 10;
}
