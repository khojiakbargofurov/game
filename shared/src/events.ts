import type { CarId } from './config';
import type { NetState, PlayerState, RaceResult, RaceSettings, RoomInfo } from './types';
import type { TuneSetup, UpgradeLevels } from './upgrades';

/** O'yinchi xonaga olib keladigan mashina va uning sozlamalari (server hammasini tekshiradi) */
export interface LoadoutPayload {
  car?: CarId;
  upgrades?: UpgradeLevels;
  tune?: TuneSetup;
}

/**
 * Socket.io event nomlari va payload tiplari.
 * `socket.io` va `socket.io-client` generiklari bilan ishlatiladi:
 *   new Server<ClientToServerEvents, ServerToClientEvents>()
 *   io() as Socket<ServerToClientEvents, ClientToServerEvents>
 * Barcha vaqtlar (startsAt, startedAt, serverTime, t) — server soati bo'yicha ms (Date.now()).
 */

export type AckResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type Ack<T> = (res: AckResult<T>) => void;

export interface ClientToServerEvents {
  'room:create': (
    payload: LoadoutPayload & { name: string; settings?: Partial<RaceSettings> },
    ack: Ack<RoomInfo>,
  ) => void;
  'room:join': (payload: LoadoutPayload & { code: string; name: string }, ack: Ack<RoomInfo>) => void;
  'room:leave': () => void;
  /** Faqat xona egasi, faqat lobby'da: trassa, fasl, ob-havo, upgrade'lar yoqilganmi */
  'room:settings': (payload: Partial<RaceSettings>, ack: Ack<null>) => void;
  /** Faqat xona egasi: poyga tugagach xonani lobby holatiga qaytarish (`start` — darhol yangi poyga) */
  'room:reset': (payload: { start: boolean }, ack: Ack<null>) => void;
  /** Faqat xona egasi — countdown boshlanadi */
  'race:start': (ack: Ack<null>) => void;
  /** O'yinchi o'z holatini TICK_RATE chastotada yuboradi */
  'player:state': (state: NetState) => void;
  /** Checkpointdan o'tdim (server tartib va pozitsiyani tekshiradi) */
  'race:checkpoint': (payload: { index: number }) => void;
  /** Tanga oldim (server pozitsiyani tekshiradi) */
  'race:coin': (payload: { id: number }) => void;
}

export interface ServerToClientEvents {
  'room:update': (room: RoomInfo) => void;
  /** 3-2-1: poyga `startsAt` da boshlanadi */
  'race:countdown': (payload: { startsAt: number; serverTime: number }) => void;
  /** Poyga boshlandi */
  'race:go': (payload: { startedAt: number; serverTime: number }) => void;
  /** Barcha o'yinchilar holati — TICK_RATE chastotada. `t` — server vaqti (ms) */
  'room:snapshot': (payload: { t: number; players: PlayerState[] }) => void;
  /** Checkpoint javobi; marra uchun `timeMs` — server hisoblagan poyga vaqti */
  'race:checkpointAck': (payload: { index: number; accepted: boolean; timeMs?: number }) => void;
  /** Anti-cheat rad etganda o'yinchini oxirgi to'g'ri holatga qaytarish */
  'player:correction': (state: NetState) => void;
  /** Joriy o'rinlar: o'yinchi id'lari 1-o'rindan boshlab */
  'race:standings': (payload: { order: string[] }) => void;
  /** Birinchi o'yinchi marraga yetdi — poyga `endsAt` da (server vaqti) majburan tugaydi */
  'race:finishing': (payload: { endsAt: number }) => void;
  'race:results': (payload: { results: RaceResult[] }) => void;
}
