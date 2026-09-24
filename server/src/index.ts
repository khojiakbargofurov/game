import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  DEFAULT_SEASON,
  DEFAULT_TRACK,
  DEFAULT_WEATHER,
  NET,
  RACE,
  ROOM,
  type ClientToServerEvents,
  type RaceSettings,
  type ServerToClientEvents,
} from '@game/shared';
import { RoomManager, effectiveTune, effectiveUpgrades, roomInfo, snapshotOf, trackOf, type Room } from './rooms';
import { normalizeCode, parseLoadout, parseNetState, parseSettings, sanitizeName } from './validation';
import { validateMove } from './antiCheat';
import { collectCoin, passCheckpoint, results, shouldEnd, standings } from './race';

const PORT = Number(process.env.PORT) || NET.DEFAULT_PORT;
/** Vergul bilan ajratilgan ruxsat etilgan originlar; bo'sh bo'lsa hammasiga ruxsat (dev) */
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',') ?? '*';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const DEFAULT_SETTINGS: RaceSettings = {
  trackId: DEFAULT_TRACK,
  season: DEFAULT_SEASON,
  weather: DEFAULT_WEATHER,
  upgradesEnabled: true,
};

const rooms = new RoomManager();

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: io.engine.clientsCount, rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

const JOIN_ERRORS = {
  not_found: 'Bunday xona topilmadi',
  full: `Xona to'la (maksimal ${ROOM.MAX_PLAYERS} o'yinchi)`,
  in_progress: 'Bu xonada poyga allaqachon boshlangan',
} as const;

function broadcastRoom(room: Room) {
  io.to(room.code).emit('room:update', roomInfo(room));
}

/** Xonadan chiqish/uzilish — qolganlarga yangilangan ro'yxat yuboriladi */
function leaveRoom(socket: GameSocket) {
  const room = rooms.roomOf(socket.id);
  if (!room) return;
  socket.leave(room.code);
  const updated = rooms.leave(socket.id);
  if (!updated) return;
  broadcastRoom(updated);
  // Qolganlarning hammasi marraga yetgan bo'lishi mumkin
  endRaceIfDone(updated);
}

/** Countdown → poyga. Poyga `startsAt` da boshlanadi, klientlar 3-2-1 ni server soati bo'yicha ko'rsatadi */
function startCountdown(room: Room) {
  const now = Date.now();
  const startsAt = now + ROOM.COUNTDOWN_SECONDS * 1000;
  rooms.prepareRace(room, startsAt);
  console.log(`[race] ${room.code}: countdown (${room.players.size} o'yinchi)`);
  broadcastRoom(room);
  io.to(room.code).emit('race:countdown', { startsAt, serverTime: now });
  room.timers.push(
    setTimeout(() => {
      if (room.phase !== 'countdown') return;
      room.phase = 'racing';
      broadcastRoom(room);
      io.to(room.code).emit('race:go', { startedAt: startsAt, serverTime: Date.now() });
      console.log(`[race] ${room.code}: start!`);
    }, startsAt - now),
  );
}

function endRaceIfDone(room: Room) {
  if (!shouldEnd(room, Date.now())) return;
  room.phase = 'finished';
  const list = results(room);
  console.log(`[race] ${room.code}: tugadi — ${list.map((r) => `${r.place}. ${r.name}`).join(', ')}`);
  broadcastRoom(room);
  io.to(room.code).emit('race:results', { results: list });
}

io.on('connection', (socket: GameSocket) => {
  console.log(`[io] ulandi: ${socket.id}`);

  // Har bir handler try/catch bilan: noto'g'ri payload serverni yiqitmasligi kerak
  const safe =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[io] xato (${socket.id}):`, err);
      }
    };

  socket.on(
    'room:create',
    safe((payload, ack) => {
      if (typeof ack !== 'function') return;
      const name = sanitizeName(payload?.name);
      if (!name) return ack({ ok: false, error: 'Ism kiriting' });
      leaveRoom(socket);
      const settings = parseSettings(payload?.settings, DEFAULT_SETTINGS);
      const room = rooms.create(socket.id, name, parseLoadout(payload), settings);
      socket.join(room.code);
      console.log(`[room] ${room.code} yaratildi (${name})`);
      ack({ ok: true, data: roomInfo(room) });
    }),
  );

  socket.on(
    'room:join',
    safe((payload, ack) => {
      if (typeof ack !== 'function') return;
      const name = sanitizeName(payload?.name);
      const code = normalizeCode(payload?.code);
      if (!name) return ack({ ok: false, error: 'Ism kiriting' });
      if (!code) return ack({ ok: false, error: `Kod ${ROOM.CODE_LENGTH} belgidan iborat bo'lishi kerak` });
      leaveRoom(socket);
      const result = rooms.join(code, socket.id, name, parseLoadout(payload));
      if (typeof result === 'string') return ack({ ok: false, error: JOIN_ERRORS[result] });
      socket.join(code);
      console.log(`[room] ${code}: ${name} qo'shildi (${result.players.size} o'yinchi)`);
      ack({ ok: true, data: roomInfo(result) });
      broadcastRoom(result);
    }),
  );

  socket.on('room:leave', safe(() => leaveRoom(socket)));

  socket.on(
    'room:settings',
    safe((payload, ack) => {
      if (typeof ack !== 'function') return;
      const room = rooms.roomOf(socket.id);
      if (!room) return ack({ ok: false, error: 'Siz xonada emassiz' });
      if (room.hostId !== socket.id) return ack({ ok: false, error: "Faqat xona egasi o'zgartira oladi" });
      if (room.phase !== 'lobby') return ack({ ok: false, error: 'Poyga paytida o`zgartirib bo`lmaydi' });
      room.settings = parseSettings(payload, room.settings);
      ack({ ok: true, data: null });
      broadcastRoom(room);
    }),
  );

  socket.on(
    'race:start',
    safe((ack) => {
      if (typeof ack !== 'function') return;
      const room = rooms.roomOf(socket.id);
      if (!room) return ack({ ok: false, error: 'Siz xonada emassiz' });
      if (room.hostId !== socket.id) return ack({ ok: false, error: 'Faqat xona egasi boshlay oladi' });
      if (room.phase !== 'lobby') return ack({ ok: false, error: 'Poyga allaqachon boshlangan' });
      if (room.players.size < ROOM.MIN_PLAYERS) {
        return ack({ ok: false, error: `Kamida ${ROOM.MIN_PLAYERS} o'yinchi kerak` });
      }
      ack({ ok: true, data: null });
      startCountdown(room);
    }),
  );

  socket.on(
    'room:reset',
    safe((payload, ack) => {
      if (typeof ack !== 'function') return;
      const room = rooms.roomOf(socket.id);
      if (!room) return ack({ ok: false, error: 'Siz xonada emassiz' });
      if (room.hostId !== socket.id) return ack({ ok: false, error: 'Faqat xona egasi' });
      if (room.phase !== 'finished') return ack({ ok: false, error: 'Poyga hali tugamagan' });
      if (payload?.start && room.players.size < ROOM.MIN_PLAYERS) {
        return ack({ ok: false, error: `Kamida ${ROOM.MIN_PLAYERS} o'yinchi kerak` });
      }
      ack({ ok: true, data: null });
      if (payload?.start) startCountdown(room);
      else {
        rooms.toLobby(room);
        broadcastRoom(room);
      }
    }),
  );

  socket.on(
    'race:checkpoint',
    safe((payload) => {
      const room = rooms.roomOf(socket.id);
      const player = room?.players.get(socket.id);
      if (!room || !player || typeof payload?.index !== 'number') return;
      const res = passCheckpoint(room, player, payload.index, Date.now());
      socket.emit('race:checkpointAck', { index: payload.index, accepted: res.accepted, timeMs: res.timeMs });
      if (!res.accepted) console.warn(`[race] ${room.code}/${player.name}: checkpoint ${payload.index} rad etildi`);
      if (res.finished) {
        console.log(`[race] ${room.code}/${player.name}: marra ${(res.timeMs! / 1000).toFixed(2)} s`);
        // Birinchi marra — qolganlarga poyga qachon tugashini aytamiz (ekranda teskari sanoq)
        if (res.first) io.to(room.code).emit('race:finishing', { endsAt: room.firstFinishAt! + RACE.FINISH_GRACE_MS });
        // Hamma yetgan bo'lsa — darhol tugaydi; aks holda grace muddatini 5 Hz tekshiruv kuzatadi
        endRaceIfDone(room);
      }
    }),
  );

  socket.on(
    'race:coin',
    safe((payload) => {
      const room = rooms.roomOf(socket.id);
      const player = room?.players.get(socket.id);
      if (!room || !player) return;
      collectCoin(room, player, payload?.id);
    }),
  );

  socket.on(
    'player:state',
    safe((raw) => {
      const room = rooms.roomOf(socket.id);
      if (!room || room.phase !== 'racing') return;
      const player = room.players.get(socket.id);
      const state = parseNetState(raw);
      if (!player || !state) return;
      const now = Date.now();
      const check = validateMove(
        player.last,
        state,
        now,
        trackOf(room),
        player.slot,
        player.nextCheckpoint - 1,
        effectiveUpgrades(room, player),
        effectiveTune(room, player),
      );
      if (!check.ok) {
        // Rad etildi — o'yinchi oxirgi to'g'ri holatga qaytariladi
        console.warn(`[anti-cheat] ${room.code}/${player.name}: ${check.reason}`);
        if (player.last) socket.emit('player:correction', { ...player.last.state, velocity: [0, 0, 0] });
        return;
      }
      player.last = { state: { ...state, respawn: undefined }, at: now };
    }),
  );

  socket.on('disconnect', (reason) => {
    console.log(`[io] uzildi: ${socket.id} (${reason})`);
    leaveRoom(socket);
  });
});

// 20 Hz: har bir poyga ketayotgan xonaga barcha o'yinchilar holati
setInterval(() => {
  const t = Date.now();
  for (const room of rooms.allRooms()) {
    if (room.phase !== 'racing') continue;
    io.to(room.code).emit('room:snapshot', { t, players: snapshotOf(room) });
  }
}, 1000 / NET.TICK_RATE);

// 5 Hz: joriy o'rinlar + poyga tugash tekshiruvi (grace / maksimal vaqt)
setInterval(() => {
  for (const room of rooms.allRooms()) {
    if (room.phase !== 'racing') continue;
    io.to(room.code).emit('race:standings', { order: standings(room).map((p) => p.id) });
    endRaceIfDone(room);
  }
}, 1000 / RACE.STANDINGS_HZ);

httpServer.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT} da ishlayapti`);
});
