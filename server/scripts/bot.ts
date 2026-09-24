/**
 * Test-bot: xonaga qo'shiladi va poyga boshlanganda marshrut bo'ylab haydaydi (fizikasiz).
 * Ko'p o'yinchi rejimini bitta brauzer bilan sinash uchun.
 *
 *   npm run bot -w server -- ABC123            # mavjud xonaga qo'shilish
 *   npm run bot -w server -- --create          # xona yaratish (kod konsolga chiqadi)
 *   npm run bot -w server -- ABC123 --speed 25 --name Bot2
 *   npm run bot -w server -- ABC123 --car orange   (red | green | orange | white)
 *   npm run bot -w server -- ABC123 --cheat    # anti-cheat sinovi: vaqti-vaqti bilan oldinga "sakraydi"
 */
import { io, type Socket } from 'socket.io-client';
import {
  CHECKPOINTS,
  NET,
  gridSpawn,
  nearestOnRoute,
  routeAt,
  yawOf,
  ROUTE_LENGTH,
  type ClientToServerEvents,
  type NetState,
  type ServerToClientEvents,
} from '@game/shared';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const code = args.find((a) => /^[A-Z0-9]{6}$/i.test(a));
const url = option('url', `http://localhost:${NET.DEFAULT_PORT}`);
const name = option('name', `Bot-${Math.floor(Math.random() * 90 + 10)}`);
const speed = Number(option('speed', '18'));
const cheat = flag('cheat');
const car = option('car', 'red');

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url);

let s = 0;
let lateral = 0;
let racing = false;
let corrections = 0;
let nextCheckpoint = 0;
let spawnS = 0;

socket.on('connect', () => {
  const done = (res: { ok: boolean; data?: { code: string }; error?: string }) => {
    if (!res.ok) {
      console.error(`[${name}] xato: ${res.error}`);
      process.exit(1);
    }
    console.log(`[${name}] xona: ${res.data!.code}`);
  };
  if (code) socket.emit('room:join', { code, name, car } as never, done as never);
  else if (flag('create')) socket.emit('room:create', { name, car } as never, done as never);
  else {
    console.error('Xona kodi yoki --create kerak');
    process.exit(1);
  }
});

socket.on('room:update', (room) => {
  const me = room.players.find((p) => p.id === socket.id);
  // Start joyi faqat poygadan oldin olinadi (poyga paytidagi yangilanishlar pozitsiyani buzmasin)
  if (me && !racing) {
    const spawn = gridSpawn(me.slot);
    const n = nearestOnRoute(spawn.position[0], spawn.position[2]);
    s = spawnS = n.s;
    lateral = n.lateral;
  }
  console.log(`[${name}] xonada: ${room.players.map((p) => p.name + (p.isHost ? '*' : '')).join(', ')}`);
});

socket.on('race:countdown', () => {
  racing = false;
  s = spawnS;
  nextCheckpoint = 0;
  console.log(`[${name}] 3-2-1…`);
});

socket.on('race:go', () => {
  racing = true;
  console.log(`[${name}] poyga boshlandi`);
});

socket.on('race:checkpointAck', ({ index, accepted, timeMs }) => {
  if (!accepted) console.log(`[${name}] checkpoint ${index} rad etildi`);
  else if (timeMs) console.log(`[${name}] marra! ${(timeMs / 1000).toFixed(2)} s`);
});

socket.on('race:results', ({ results }) => {
  racing = false;
  console.log(`[${name}] natijalar: ${results.map((r) => `${r.place}. ${r.name}`).join(', ')}`);
});

socket.on('player:correction', (st) => {
  corrections++;
  const n = nearestOnRoute(st.position[0], st.position[2]);
  s = n.s;
  console.log(`[${name}] server tuzatdi (#${corrections}) → s=${s.toFixed(0)}`);
});

let tick = 0;
setInterval(() => {
  if (!racing) return;
  const dt = 1 / NET.TICK_RATE;
  s = Math.min(ROUTE_LENGTH, s + speed * dt);
  tick++;
  // --cheat: har 3 soniyada 60 m oldinga sakrash
  if (cheat && tick % (NET.TICK_RATE * 3) === 0) s += 60;
  // Marra — to'xtaymiz
  if (nextCheckpoint >= CHECKPOINTS.length) return;
  const f = routeAt(s);
  const yaw = yawOf(f.tx, f.tz);
  const state: NetState = {
    position: [f.x + f.tz * lateral, f.y + 0.7, f.z - f.tx * lateral],
    rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
    velocity: [f.tx * speed, 0, f.tz * speed],
  };
  socket.emit('player:state', state);
  const cp = CHECKPOINTS[nextCheckpoint];
  if (cp && s >= cp.s) {
    socket.emit('race:checkpoint', { index: nextCheckpoint });
    nextCheckpoint++;
  }
}, 1000 / NET.TICK_RATE);

socket.on('disconnect', () => {
  console.log(`[${name}] uzildi`);
  process.exit(0);
});
