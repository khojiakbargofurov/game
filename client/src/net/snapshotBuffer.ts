import { Quaternion, Vector3 } from 'three';
import { NET, type PlayerState } from '@game/shared';

interface Snap {
  t: number;
  p: Vector3;
  q: Quaternion;
  v: Vector3;
}

/** Oxirgi snapshotdan keyin shuncha ms gacha tezlik bo'yicha ekstrapolyatsiya qilinadi */
const MAX_EXTRAPOLATION_MS = 200;
const qa = new Quaternion();

/**
 * Bitta uzoqdagi o'yinchi uchun snapshot buferi.
 * Render vaqti (server vaqti - INTERP_DELAY) ga ikki qo'shni snapshot orasida
 * pozitsiya lerp, aylanish slerp qilinadi.
 */
export class SnapshotBuffer {
  private snaps: Snap[] = [];

  push(t: number, s: PlayerState) {
    const last = this.snaps[this.snaps.length - 1];
    if (last && t <= last.t) return; // eskirgan/takroriy paket
    this.snaps.push({
      t,
      p: new Vector3(...s.position),
      q: new Quaternion(...s.rotation),
      v: new Vector3(...s.velocity),
    });
    if (this.snaps.length > NET.SNAPSHOT_BUFFER_SIZE) this.snaps.shift();
  }

  /** Mashina respawn/teleport qilganda silliqlamaslik uchun buferni tozalash */
  clear() {
    this.snaps.length = 0;
  }

  /** @returns false — hali ma'lumot yo'q */
  sample(renderT: number, outPos: Vector3, outQuat: Quaternion): boolean {
    const snaps = this.snaps;
    if (snaps.length === 0) return false;
    const first = snaps[0];
    const last = snaps[snaps.length - 1];

    if (renderT <= first.t) {
      outPos.copy(first.p);
      outQuat.copy(first.q);
      return true;
    }
    if (renderT >= last.t) {
      const dt = Math.min(renderT - last.t, MAX_EXTRAPOLATION_MS) / 1000;
      outPos.copy(last.p).addScaledVector(last.v, dt);
      outQuat.copy(last.q);
      return true;
    }
    // renderT atrofidagi ikki snapshot (bufer kichik — chiziqli qidiruv yetarli)
    let i = snaps.length - 2;
    while (i > 0 && snaps[i].t > renderT) i--;
    const a = snaps[i];
    const b = snaps[i + 1];
    const k = (renderT - a.t) / (b.t - a.t);
    // Katta sakrash (respawn) — interpolyatsiya qilmasdan keyingisiga o'tamiz
    if (a.p.distanceToSquared(b.p) > 20 * 20) {
      outPos.copy(b.p);
      outQuat.copy(b.q);
      return true;
    }
    outPos.lerpVectors(a.p, b.p, k);
    outQuat.copy(qa.copy(a.q).slerp(b.q, k));
    return true;
  }

  /** Oxirgi ma'lum tezlik (m/s) — g'ildiraklarni aylantirish uchun */
  speed(): number {
    const last = this.snaps[this.snaps.length - 1];
    return last ? Math.hypot(last.v.x, last.v.z) : 0;
  }
}

/** id → bufer. React'dan tashqarida: snapshotlar 20 Hz keladi, render 60 Hz o'qiydi */
export const remoteBuffers = new Map<string, SnapshotBuffer>();

export function bufferFor(id: string): SnapshotBuffer {
  let b = remoteBuffers.get(id);
  if (!b) {
    b = new SnapshotBuffer();
    remoteBuffers.set(id, b);
  }
  return b;
}
