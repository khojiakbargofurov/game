import { Quaternion, Vector3 } from 'three';
import { DEFAULT_TRACK, getTrack, type NetState } from '@game/shared';

const START = getTrack(DEFAULT_TRACK).START;

/**
 * O'yinchi mashinasining joriy holati — kamera, yorug'lik, trassa logikasi va tarmoq
 * har kadrda o'qiydi. React state emas, oddiy mutable obyekt: re-render bo'lmasligi uchun.
 * Car komponenti yangilaydi.
 */
export const carTarget = {
  position: new Vector3(...START.position),
  quaternion: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), START.yaw),
  velocity: new Vector3(),
  /** Oldinga yo'nalishdagi tezlik (m/s) */
  speed: 0,
  /** Hozir boost (kristall yoki nitro) ishlayaptimi — kamera FOV'i uchun */
  boosting: false,
  /** Har respawn'da oshadi — tarmoqqa "teleport bo'ldi" deb xabar berish uchun */
  respawns: 0,
  /** Server anti-cheat tuzatishi: keyingi fizika qadamida mashina shu holatga qo'yiladi */
  pendingCorrection: null as NetState | null,
};
