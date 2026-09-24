import { ROOM, type AckResult, type LoadoutPayload, type RaceSettings, type RoomInfo, type SpawnPoint } from '@game/shared';
import { requestRespawn } from '../input/keyboard';
import { useGameStore } from '../store/gameStore';
import { useCarChoice } from '../store/carChoice';
import { useNetStore } from '../store/netStore';
import { activeTrack, useMenuChoice } from '../store/raceSettings';
import { ownCarStats, useGarage } from '../store/garage';
import { resetPickups } from '../store/pickups';
import { whenWorldReady } from '../store/loadState';
import { observeServerTime, resetServerClock, serverNow } from './serverClock';
import { bufferFor, remoteBuffers } from './snapshotBuffer';
import { socket } from './socket';

/**
 * O'yin sessiyasi: menyu → (yakka | xona → countdown → poyga → natijalar).
 * Socket hodisalari shu yerda store'larga bog'lanadi; UI faqat shu funksiyalarni chaqiradi.
 */

const NAME_KEY = 'racer:name';

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // brauzer xotirasi yopiq bo'lsa ham o'yin ishlayveradi
  }
}

/** Server vaqtini (ms) performance.now() shkalasiga o'tkazish */
const toLocalTime = (serverMs: number) => performance.now() + (serverMs - serverNow());

/** Mashinani berilgan nuqtaga qo'yib, poyga holatini yangidan boshlash */
function resetRace(spawn: SpawnPoint) {
  resetPickups();
  useGameStore.getState().reset();
  useGameStore.setState({ respawnPoint: spawn, nitroMs: ownCarStats().nitroCapacityMs });
  requestRespawn();
  pendingCheckpoint = null;
}

let cancelSoloStart: (() => void) | null = null;

/** Yakka rejim: start joyiga qo'yish va mahalliy 3-2-1 (dunyo yuklangandan keyin) */
export function startSolo() {
  resetRace(activeTrack().START);
  useNetStore.setState({ screen: 'race', mode: 'solo', error: null, results: null, standings: [] });
  cancelSoloStart?.();
  cancelSoloStart = whenWorldReady(() => {
    cancelSoloStart = null;
    if (useNetStore.getState().screen !== 'race') return; // kutish paytida menyuga qaytilgan
    requestRespawn(); // fizika endi tayyor — start joyiga aniq qo'yish
    useGameStore.getState().startCountdown(performance.now() + ROOM.COUNTDOWN_SECONDS * 1000);
  });
}

function onRoomJoined(res: AckResult<RoomInfo>, name: string) {
  useNetStore.setState({ busy: false });
  if (!res.ok) {
    useNetStore.setState({ error: res.error });
    return;
  }
  saveName(name);
  useNetStore.setState({ room: res.data, screen: 'room', mode: 'online', error: null, results: null });
}

/** Xonaga olib boriladigan mashina: tanlov, upgrade'lar, sozlash, ko'rinish (server tekshiradi) */
function loadout(): LoadoutPayload {
  const { levels, tune, look } = useGarage.getState();
  return { car: useCarChoice.getState().car, upgrades: levels, tune, look };
}

export function createRoom(name: string) {
  useNetStore.setState({ busy: true, error: null });
  socket.emit('room:create', { name, ...loadout(), settings: menuSettings() }, (res) => onRoomJoined(res, name));
}

/** Menyuda tanlangan sharoit — yangi xona shu bilan yaratiladi */
function menuSettings(): Partial<RaceSettings> {
  const { trackId, season, weather } = useMenuChoice.getState();
  return { trackId, season, weather, upgradesEnabled: true };
}

/** Faqat host, lobby'da: xona sozlamalarini o'zgartirish (server hammaga room:update yuboradi) */
export function updateRoomSettings(patch: Partial<RaceSettings>) {
  socket.emit('room:settings', patch, (res) => {
    if (!res.ok) useNetStore.setState({ error: res.error });
  });
}

export function joinRoom(code: string, name: string) {
  useNetStore.setState({ busy: true, error: null });
  socket.emit('room:join', { code, name, ...loadout() }, (res) => onRoomJoined(res, name));
}

export function startOnlineRace() {
  useNetStore.setState({ error: null });
  socket.emit('race:start', (res) => {
    if (!res.ok) useNetStore.setState({ error: res.error });
  });
}

/** Host: natijalardan keyin qayta o'ynash (`start`) yoki lobbyga qaytish */
export function resetRoom(start: boolean) {
  socket.emit('room:reset', { start }, (res) => {
    if (!res.ok) useNetStore.setState({ error: res.error });
  });
}

/** Menyuga qaytish (xonadan chiqish yoki yakka rejimni tugatish) */
export function backToMenu() {
  if (useNetStore.getState().room) socket.emit('room:leave');
  remoteBuffers.clear();
  resetRace(activeTrack().START);
  useNetStore.setState({ screen: 'menu', room: null, error: null, results: null, standings: [], finishDeadline: null });
}

// ───────────── Checkpoint/tanga (onlayn: server tasdiqlaydi) ─────────────

/** Javob kutilayotgan checkpoint — har kadrda qayta yubormaslik uchun */
let pendingCheckpoint: { index: number; sentAt: number } | null = null;
const RESEND_MS = 1000;

export function reportCheckpoint(index: number) {
  const now = performance.now();
  if (pendingCheckpoint && pendingCheckpoint.index === index && now - pendingCheckpoint.sentAt < RESEND_MS) return;
  pendingCheckpoint = { index, sentAt: now };
  socket.emit('race:checkpoint', { index });
}

export function reportCoin(id: number) {
  socket.emit('race:coin', { id });
}

// ───────────── Socket hodisalari ─────────────

socket.on('connect', () => useNetStore.setState({ connected: true, selfId: socket.id ?? null }));

socket.on('disconnect', () => {
  const { screen, mode } = useNetStore.getState();
  useNetStore.setState({ connected: false });
  // Onlayn o'yin paytida aloqa uzilsa — menyuga, xabar bilan
  if (mode === 'online' && screen !== 'menu') {
    backToMenu();
    useNetStore.setState({ error: 'Server bilan aloqa uzildi' });
  }
});

socket.on('room:update', (room) => {
  const { screen, mode } = useNetStore.getState();
  useNetStore.setState({ room });
  // Chiqib ketgan o'yinchilarning buferlarini tozalash
  const ids = new Set(room.players.map((p) => p.id));
  for (const id of remoteBuffers.keys()) if (!ids.has(id)) remoteBuffers.delete(id);
  // Host xonani lobbyga qaytardi — natijalardan xona ekraniga
  if (mode === 'online' && screen === 'race' && room.phase === 'lobby') {
    resetRace(activeTrack().START);
    useNetStore.setState({ screen: 'room', results: null, standings: [] });
  }
});

socket.on('race:countdown', ({ startsAt, serverTime }) => {
  const { room, selfId } = useNetStore.getState();
  const me = room?.players.find((p) => p.id === selfId);
  if (!me) return;
  resetServerClock();
  observeServerTime(serverTime);
  remoteBuffers.clear();
  resetRace(activeTrack().gridSpawn(me.slot));
  useGameStore.getState().startCountdown(toLocalTime(startsAt));
  useNetStore.setState({ screen: 'race', results: null, standings: [], error: null, finishDeadline: null });
});

// Asosiy start — mahalliy countdown taymeri (RaceLogic); bu esa zaxira (masalan, tab fonda bo'lsa)
socket.on('race:go', ({ startedAt, serverTime }) => {
  observeServerTime(serverTime);
  const game = useGameStore.getState();
  if (game.phase === 'countdown') game.startRace(toLocalTime(startedAt));
});

socket.on('race:checkpointAck', ({ index, accepted, timeMs }) => {
  if (pendingCheckpoint?.index === index) pendingCheckpoint = null;
  const game = useGameStore.getState();
  if (!accepted || index !== game.nextCheckpoint) return;
  const cp = activeTrack().CHECKPOINTS[index];
  game.passCheckpoint(index, { position: [cp.position[0], cp.position[1] + 1.2, cp.position[2]], yaw: cp.yaw });
  if (cp.isFinish && timeMs !== undefined && game.startedAt !== null) game.finish(game.startedAt + timeMs);
});

socket.on('race:standings', ({ order }) => useNetStore.setState({ standings: order }));

socket.on('race:finishing', ({ endsAt }) => useNetStore.setState({ finishDeadline: toLocalTime(endsAt) }));

socket.on('race:results', ({ results }) => {
  useNetStore.setState({ results, standings: results.map((r) => r.playerId), finishDeadline: null });
  // Server tasdiqlagan tangalar hamyonga (marraga yetmagan bo'lsa ham — yig'ilgani o'ziniki)
  const mine = results.find((r) => r.playerId === useNetStore.getState().selfId);
  if (mine) useGarage.getState().deposit(mine.coins);
});

socket.on('room:snapshot', ({ t, players }) => {
  observeServerTime(t);
  const self = useNetStore.getState().selfId;
  for (const p of players) if (p.id !== self) bufferFor(p.id).push(t, p);
});
