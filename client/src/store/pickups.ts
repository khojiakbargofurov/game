import { BOOSTS, COINS } from '@game/shared';

/**
 * Tanga/boost holati — har kadrda o'qiladi, shuning uchun zustand emas, oddiy typed array.
 * O'zgarishlar sonini store'dagi `coins` hisoblagich orqali UI ko'radi.
 */
export const pickups = {
  /** 1 = tanga olingan */
  coins: new Uint8Array(COINS.length),
  /** Boost olingan vaqt (performance.now()); 0 = mavjud */
  boostTakenAt: new Float64Array(BOOSTS.length),
};

export function resetPickups() {
  pickups.coins.fill(0);
  pickups.boostTakenAt.fill(0);
}
