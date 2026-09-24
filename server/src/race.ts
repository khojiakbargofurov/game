import { COIN_RADIUS, RACE, ROOM, type RaceResult } from '@game/shared';
import { isNear } from './antiCheat';
import { trackOf, type Room, type ServerPlayer } from './rooms';

/**
 * Poyga qoidalari (server — yagona haqiqat manbai):
 * checkpoint tartibi va pozitsiyasi, tangalar, reyting, poyga tugashi va natijalar.
 * Socket'dan mustaqil: natijani qaytaradi, yuborishni index.ts qiladi.
 */

/** Checkpoint so'rovini tekshirish. Qabul qilinsa — o'yinchi holati yangilanadi */
export function passCheckpoint(
  room: Room,
  player: ServerPlayer,
  index: number,
  now: number,
): { accepted: boolean; finished?: boolean; first?: boolean; timeMs?: number } {
  if (room.phase !== 'racing' || !room.startedAt || player.finishTimeMs !== null) return { accepted: false };
  if (index !== player.nextCheckpoint) return { accepted: false }; // tartib buzildi
  const cp = trackOf(room).CHECKPOINTS[index];
  if (!cp || !isNear(player.last, cp.position, cp.radius)) return { accepted: false };

  player.nextCheckpoint++;
  if (!cp.isFinish) return { accepted: true };

  player.finishTimeMs = now - room.startedAt;
  const first = room.firstFinishAt === null;
  room.firstFinishAt ??= now;
  return { accepted: true, finished: true, first, timeMs: player.finishTimeMs };
}

/** Tanga: har bir o'yinchi uchun alohida, bir marta, faqat yaqinida bo'lsa */
export function collectCoin(room: Room, player: ServerPlayer, id: number): boolean {
  if (room.phase !== 'racing' || !Number.isInteger(id) || player.coins.has(id)) return false;
  const coin = trackOf(room).COINS[id];
  if (!coin || !isNear(player.last, coin.position, COIN_RADIUS)) return false;
  player.coins.add(id);
  return true;
}

/**
 * Marshrut bo'ylab progress (m). Eng yaqin nuqta qidiruvi marshrutning boshqa qismiga
 * "sakrab" ketmasligi uchun oxirgi va navbatdagi checkpoint orasiga cheklanadi.
 */
function progress(room: Room, p: ServerPlayer): number {
  if (p.finishTimeMs !== null) return Infinity;
  const { CHECKPOINTS, nearestOnRoute, totalS } = trackOf(room);
  // Umumiy masofa (aylanali poygada har aylana qo'shiladi)
  const prevS = p.nextCheckpoint > 0 ? CHECKPOINTS[p.nextCheckpoint - 1].totalS : 0;
  const nextS = CHECKPOINTS[p.nextCheckpoint]?.totalS ?? prevS;
  if (!p.last) return prevS;
  const [x, y, z] = p.last.state.position;
  return Math.min(Math.max(totalS(nearestOnRoute(x, z, undefined, y).s, prevS), prevS), nextS);
}

/** Joriy o'rinlar: marraga yetganlar vaqt bo'yicha, qolganlar checkpoint + progress bo'yicha */
export function standings(room: Room): ServerPlayer[] {
  const rows = [...room.players.values()].map((p) => ({ p, prog: progress(room, p) }));
  rows.sort((a, b) => {
    const fa = a.p.finishTimeMs;
    const fb = b.p.finishTimeMs;
    if (fa !== null && fb !== null) return fa - fb;
    if (fa !== null) return -1;
    if (fb !== null) return 1;
    return b.p.nextCheckpoint - a.p.nextCheckpoint || b.prog - a.prog;
  });
  return rows.map((r) => r.p);
}

/** Poyga tugadimi: hamma marraga yetdi yoki birinchidan keyin grace vaqti o'tdi yoki maksimal vaqt */
export function shouldEnd(room: Room, now: number): boolean {
  if (room.phase !== 'racing' || !room.startedAt) return false;
  const players = [...room.players.values()];
  if (players.length > 0 && players.every((p) => p.finishTimeMs !== null)) return true;
  if (room.firstFinishAt !== null && now - room.firstFinishAt >= RACE.FINISH_GRACE_MS) return true;
  return now - room.startedAt >= RACE.MAX_DURATION_MS;
}

export function results(room: Room): RaceResult[] {
  return standings(room).map((p, i) => ({
    playerId: p.id,
    name: p.name,
    color: ROOM.PLAYER_COLORS[p.slot % ROOM.PLAYER_COLORS.length],
    place: i + 1,
    timeMs: p.finishTimeMs,
    coins: p.coins.size,
    checkpoints: p.nextCheckpoint,
  }));
}
