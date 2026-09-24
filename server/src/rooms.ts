import {
  NO_UPGRADES,
  ROOM,
  getTrack,
  type CarId,
  type NetState,
  type PlayerInfo,
  type PlayerState,
  type RaceSettings,
  type RoomInfo,
  type RoomPhase,
  type Track,
  type UpgradeLevels,
} from '@game/shared';

export interface ServerPlayer {
  id: string;
  name: string;
  car: CarId;
  /** Klient e'lon qilgan upgrade darajalari (0..MAX gacha cheklangan) */
  upgrades: UpgradeLevels;
  slot: number;
  /** Oxirgi qabul qilingan holat va qabul qilingan vaqti (server ms) */
  last: { state: NetState; at: number } | null;
  /** Navbatdagi checkpoint indeksi (server tasdiqlagan) */
  nextCheckpoint: number;
  /** Marra vaqti (ms, startdan); yetmagan bo'lsa null */
  finishTimeMs: number | null;
  /** Server tasdiqlagan tangalar */
  coins: Set<number>;
}

export interface Room {
  code: string;
  hostId: string;
  phase: RoomPhase;
  /** Trassa, fasl, ob-havo, upgrade'lar — host lobby'da o'zgartiradi */
  settings: RaceSettings;
  players: Map<string, ServerPlayer>;
  /** Poyga boshlanish vaqti (countdown tugashi), server ms */
  startedAt: number | null;
  /** Birinchi o'yinchi marraga yetgan vaqt */
  firstFinishAt: number | null;
  /** Countdown / poyga tugash taymerlari — xona o'chirilganda tozalanadi */
  timers: NodeJS.Timeout[];
}

function randomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM.CODE_LENGTH; i++) {
    code += ROOM.CODE_ALPHABET[Math.floor(Math.random() * ROOM.CODE_ALPHABET.length)];
  }
  return code;
}

/** Bo'sh start slotini topish (o'yinchi chiqib ketsa, uning sloti bo'shaydi) */
function freeSlot(room: Room): number {
  const used = new Set([...room.players.values()].map((p) => p.slot));
  for (let i = 0; i < ROOM.MAX_PLAYERS; i++) if (!used.has(i)) return i;
  return -1;
}

export type JoinError = 'not_found' | 'full' | 'in_progress';

/**
 * Xonalar holati. Socket.io'dan mustaqil — faqat ma'lumot va qoidalar
 * (index.ts socket hodisalarini shu metodlarga bog'laydi).
 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  /** socket.id → xona kodi */
  private membership = new Map<string, string>();

  create(playerId: string, name: string, car: CarId, upgrades: UpgradeLevels, settings: RaceSettings): Room {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();
    const room: Room = {
      code,
      hostId: playerId,
      phase: 'lobby',
      settings,
      players: new Map(),
      startedAt: null,
      firstFinishAt: null,
      timers: [],
    };
    this.rooms.set(code, room);
    this.addPlayer(room, playerId, name, car, upgrades);
    return room;
  }

  join(code: string, playerId: string, name: string, car: CarId, upgrades: UpgradeLevels): Room | JoinError {
    const room = this.rooms.get(code);
    if (!room) return 'not_found';
    if (room.phase !== 'lobby') return 'in_progress';
    if (room.players.size >= ROOM.MAX_PLAYERS) return 'full';
    this.addPlayer(room, playerId, name, car, upgrades);
    return room;
  }

  private addPlayer(room: Room, id: string, name: string, car: CarId, upgrades: UpgradeLevels) {
    room.players.set(id, {
      id,
      name,
      car,
      upgrades,
      slot: freeSlot(room),
      last: null,
      nextCheckpoint: 0,
      finishTimeMs: null,
      coins: new Set(),
    });
    this.membership.set(id, room.code);
  }

  /**
   * O'yinchini xonadan o'chirish (chiqish yoki uzilish). Host chiqsa — keyingi o'yinchi host bo'ladi,
   * xona bo'shasa — o'chiriladi. Qaytaradi: o'zgargan xona (yoki xona o'chirilgan bo'lsa null).
   */
  leave(playerId: string): Room | null {
    const code = this.membership.get(playerId);
    if (!code) return null;
    this.membership.delete(playerId);
    const room = this.rooms.get(code);
    if (!room) return null;
    room.players.delete(playerId);
    if (room.players.size === 0) {
      clearTimers(room);
      this.rooms.delete(code);
      return null;
    }
    if (room.hostId === playerId) room.hostId = room.players.keys().next().value!;
    return room;
  }

  roomOf(playerId: string): Room | undefined {
    const code = this.membership.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  /**
   * Yangi poygaga tayyorlash (countdown boshida): barcha o'yinchilar start panjarasiga,
   * checkpoint/tanga/marra holatlari nolga.
   */
  prepareRace(room: Room, startsAt: number) {
    clearTimers(room);
    room.phase = 'countdown';
    room.startedAt = startsAt;
    room.firstFinishAt = null;
    for (const p of room.players.values()) {
      p.nextCheckpoint = 0;
      p.finishTimeMs = null;
      p.coins.clear();
      const spawn = trackOf(room).gridSpawn(p.slot);
      const half = spawn.yaw / 2;
      p.last = {
        state: { position: spawn.position, rotation: [0, Math.sin(half), 0, Math.cos(half)], velocity: [0, 0, 0] },
        at: startsAt,
      };
    }
  }

  /** Poyga tugagach xonani lobby holatiga qaytarish (yangi o'yinchilar yana qo'shila oladi) */
  toLobby(room: Room) {
    clearTimers(room);
    room.phase = 'lobby';
    room.startedAt = null;
    room.firstFinishAt = null;
  }

  allRooms(): IterableIterator<Room> {
    return this.rooms.values();
  }

  get size() {
    return this.rooms.size;
  }
}

export function clearTimers(room: Room) {
  room.timers.forEach(clearTimeout);
  room.timers = [];
}

/** Xonaning joriy trassasi */
export const trackOf = (room: Room): Track => getTrack(room.settings.trackId);

/** Poygada amal qiladigan darajalar: host upgrade'larni o'chirgan bo'lsa — hammasi 0 */
export const effectiveUpgrades = (room: Room, p: ServerPlayer): UpgradeLevels =>
  room.settings.upgradesEnabled ? p.upgrades : NO_UPGRADES;

export function roomInfo(room: Room): RoomInfo {
  const players: PlayerInfo[] = [...room.players.values()]
    .sort((a, b) => a.slot - b.slot)
    .map((p) => ({
      id: p.id,
      name: p.name,
      car: p.car,
      upgrades: effectiveUpgrades(room, p),
      slot: p.slot,
      color: ROOM.PLAYER_COLORS[p.slot % ROOM.PLAYER_COLORS.length],
      isHost: p.id === room.hostId,
    }));
  return { code: room.code, phase: room.phase, settings: room.settings, players };
}

export function snapshotOf(room: Room): PlayerState[] {
  const out: PlayerState[] = [];
  for (const p of room.players.values()) if (p.last) out.push({ id: p.id, ...p.last.state });
  return out;
}
