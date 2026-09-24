// Hajm — eng ko'p tangali/boostli trassaga yetarli (trassalar ~1400 m: ~120 tanga, 6 boost)
const MAX_COINS = 512;
const MAX_BOOSTS = 32;

/**
 * Tanga/boost holati — har kadrda o'qiladi, shuning uchun zustand emas, oddiy typed array.
 * O'zgarishlar sonini store'dagi `coins` hisoblagich orqali UI ko'radi.
 */
export const pickups = {
  /** 1 = tanga olingan */
  coins: new Uint8Array(MAX_COINS),
  /** Boost olingan vaqt (performance.now()); 0 = mavjud */
  boostTakenAt: new Float64Array(MAX_BOOSTS),
};

export function resetPickups() {
  pickups.coins.fill(0);
  pickups.boostTakenAt.fill(0);
}
