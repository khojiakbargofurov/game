import { Euler, Quaternion } from 'three';
import type { RouteFrame } from '@game/shared';
import { activeTrack } from '../../store/raceSettings';

/** Trassa obyektlari uchun umumiy yordamchilar */

const f: RouteFrame = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 1 };

/** `s` nuqtadagi yo'l qiyaligi (pitch, radian; musbat = tepaga) */
export function roadPitch(s: number, span = 2): number {
  const { routeAt } = activeTrack();
  const y0 = routeAt(s - span, f).y;
  const y1 = routeAt(s + span, f).y;
  return Math.atan2(y1 - y0, span * 2);
}

/**
 * Yo'l bo'ylab yo'naltirilgan kvaternion: avval yaw (Y), keyin pitch (lokal X).
 * Three.js da +X atrofida musbat burilish "oldi"ni (+Z) pastga egadi, shuning uchun pitch manfiy olinadi.
 */
export function roadQuaternion(yaw: number, pitch = 0): [number, number, number, number] {
  const q = new Quaternion().setFromEuler(new Euler(-pitch, yaw, 0, 'YXZ'));
  return [q.x, q.y, q.z, q.w];
}
