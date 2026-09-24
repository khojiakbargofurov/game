/**
 * Server smoke-testi: ishlab turgan serverga bir nechta klient ulab, asosiy qoidalarni tekshiradi.
 *   npm run dev -w server   (boshqa terminalda)
 *   npm run smoke -w server
 */
import { io, type Socket } from 'socket.io-client';
import {
  DEFAULT_TRACK,
  NET,
  RACE,
  ROOM,
  getTrack,
  type AckResult,
  type RaceResult,
  type ClientToServerEvents,
  type RoomInfo,
  type ServerToClientEvents,
} from '@game/shared';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
// Sozlamasiz yaratilgan xona — standart trassada
const { CHECKPOINTS, ROUTE_LENGTH, gridSpawn, nearestOnRoute } = getTrack(DEFAULT_TRACK);
const URL = process.env.SERVER_URL ?? `http://localhost:${NET.DEFAULT_PORT}`;
const clients: Client[] = [];
let failures = 0;

function check(cond: boolean, label: string) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) failures++;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function connect(): Promise<Client> {
  const c: Client = io(URL, { forceNew: true });
  clients.push(c);
  await new Promise<void>((r) => c.once('connect', () => r()));
  return c;
}

const create = (c: Client, name: string) =>
  new Promise<AckResult<RoomInfo>>((r) => c.emit('room:create', { name }, r));
const join = (c: Client, code: string, name: string) =>
  new Promise<AckResult<RoomInfo>>((r) => c.emit('room:join', { code, name }, r));
const start = (c: Client) => new Promise<AckResult<null>>((r) => c.emit('race:start', r));
const reset = (c: Client, startNow: boolean) =>
  new Promise<AckResult<null>>((r) => c.emit('room:reset', { start: startNow }, r));

/** Marshrut bo'ylab haydash (20 Hz paketlar) va checkpointlarni xabar qilish */
async function drive(c: Client, fromS: number, toS: number, speed: number, lateral = 0, track = getTrack(DEFAULT_TRACK)) {
  const { CHECKPOINTS, routeAt } = track;
  let next = CHECKPOINTS.findIndex((cp) => cp.totalS > fromS);
  const step = speed / NET.TICK_RATE;
  for (let s = fromS; s <= toS; s += step) {
    const f = routeAt(s);
    const yaw = Math.atan2(f.tx, f.tz);
    c.emit('player:state', {
      position: [f.x + f.tz * lateral, f.y + 0.7, f.z - f.tx * lateral],
      rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
      velocity: [f.tx * speed, 0, f.tz * speed],
    });
    await sleep(1000 / NET.TICK_RATE);
    while (next >= 0 && next < CHECKPOINTS.length && CHECKPOINTS[next].totalS <= s) {
      c.emit('race:checkpoint', { index: next });
      next++;
    }
  }
}

async function main() {
  const host = await connect();
  const guest = await connect();

  const bad = await create(host, '   ');
  check(!bad.ok, "bo'sh ism rad etiladi");

  const created = await create(host, 'Host');
  check(created.ok && created.data.code.length === ROOM.CODE_LENGTH, 'xona yaratildi, 6 belgili kod');
  if (!created.ok) return;
  const code = created.data.code;

  check(!(await join(guest, 'ZZZZZZ', 'Mehmon')).ok, "noto'g'ri kod rad etiladi");

  const soloStart = await start(host);
  check(!soloStart.ok, "1 o'yinchi bilan start rad etiladi");

  const hostUpdate = new Promise<RoomInfo>((r) => host.once('room:update', r));
  const joined = await join(guest, code.toLowerCase(), 'Mehmon');
  check(joined.ok, 'kod bilan qo`shildi (kichik harf ham qabul qilinadi)');
  check((await hostUpdate).players.length === 2, 'host yangilangan ro`yxatni oldi');

  check(!(await start(guest)).ok, 'mehmon start bosa olmaydi');

  // Snapshotlarni sanash
  let snapshots = 0;
  let lastPlayers = 0;
  guest.on('room:snapshot', (s) => {
    snapshots++;
    lastPlayers = s.players.length;
  });
  const countdown = new Promise<{ startsAt: number; serverTime: number }>((r) => guest.once('race:countdown', r));
  const go = new Promise((r) => guest.once('race:go', r));
  check((await start(host)).ok, 'host poygani boshladi');
  const cd = await countdown;
  const cdMs = cd.startsAt - cd.serverTime;
  check(Math.abs(cdMs - ROOM.COUNTDOWN_SECONDS * 1000) < 50, `countdown ${cdMs} ms`);
  check(snapshots === 0, 'countdown paytida snapshot yo`q (hamma start joyida)');
  const t0 = Date.now();
  await go;
  check(Math.abs(Date.now() - t0 - cdMs) < 300, 'race:go countdown tugagach keldi');

  // Host haqiqiy harakat yuboradi (start panjarasidan 0.5 m/tick)
  const spawn = gridSpawn(0);
  const corrections: unknown[] = [];
  host.on('player:correction', (c) => corrections.push(c));
  for (let i = 1; i <= 10; i++) {
    host.emit('player:state', {
      position: [spawn.position[0], spawn.position[1], spawn.position[2] + i * 0.5],
      rotation: [0, 0, 0, 1],
      velocity: [0, 0, 10],
    });
    await sleep(50);
  }
  check(corrections.length === 0, 'oddiy harakat qabul qilindi');
  // Aniq 1 soniyalik oynada snapshot chastotasi
  const before = snapshots;
  await sleep(1000);
  const rate = snapshots - before;
  check(rate >= 17 && rate <= 23, `~20 Hz snapshot (1 s ichida ${rate} ta)`);
  check(lastPlayers === 2, 'snapshotda 2 o`yinchi');

  // Anti-cheat: 200 m sakrash
  host.emit('player:state', { position: [spawn.position[0], spawn.position[1], spawn.position[2] + 200], rotation: [0, 0, 0, 1], velocity: [0, 0, 10] });
  await sleep(150);
  check(corrections.length === 1, 'teleport-sakrash rad etildi (correction)');
  host.emit('player:state', { position: [spawn.position[0], spawn.position[1], spawn.position[2] + 5], rotation: [0, 0, 0, 1], velocity: [0, 0, 150] });
  await sleep(150);
  check(corrections.length === 2, 'haddan tashqari tezlik rad etildi');
  // Respawn: hali o'tilmagan checkpointga — rad etiladi
  const cp5 = CHECKPOINTS[5].position;
  host.emit('player:state', { position: [cp5[0], cp5[1] + 1, cp5[2]], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], respawn: true });
  await sleep(150);
  check(corrections.length === 3, "o'tilmagan checkpointga respawn rad etildi");
  host.emit('player:state', { position: ['x', null], rotation: 5 } as never);
  await sleep(100);
  check(host.connected, 'noto`g`ri payload serverni yiqitmadi');

  // Checkpointlar: tartibsiz va uzoqdan — rad etiladi
  const acks: { index: number; accepted: boolean; timeMs?: number }[] = [];
  host.on('race:checkpointAck', (a) => acks.push(a));
  host.emit('race:checkpoint', { index: 3 });
  host.emit('race:checkpoint', { index: 0 });
  await sleep(150);
  check(acks.length === 2 && !acks[0].accepted, 'tartibsiz checkpoint (3) rad etildi');
  check(!acks[1].accepted, 'uzoqdan checkpoint (0) rad etildi');
  acks.length = 0;

  // Reyting va natijalar
  let order: string[] = [];
  guest.on('race:standings', (s) => (order = s.order));
  const resultsP = new Promise<RaceResult[]>((r) => guest.once('race:results', (p) => r(p.results)));

  // Ikkalasi marshrutni bosib o'tadi: host tezroq (55 m/s), mehmon sekinroq (45 m/s)
  console.log("   … ikki o'yinchi marshrutni bosib o'tmoqda (~30 s)");
  const hostStart = nearestOnRoute(spawn.position[0], spawn.position[2] + 5).s;
  const guestSpawn = gridSpawn(1);
  const guestStart = nearestOnRoute(guestSpawn.position[0], guestSpawn.position[2]).s;
  const guestAcks: typeof acks = [];
  let finishing: { endsAt: number; receivedAt: number } | null = null;
  guest.once('race:finishing', ({ endsAt }) => (finishing = { endsAt, receivedAt: Date.now() }));
  guest.on('race:checkpointAck', (a) => guestAcks.push(a));
  const midRace = sleep(8000).then(() => [...order]);
  await Promise.all([drive(host, hostStart, ROUTE_LENGTH, 55), drive(guest, guestStart, ROUTE_LENGTH, 45, -2.2)]);
  const orderMid = await midRace;
  check(orderMid[0] === host.id, 'poyga davomida reyting: tezroq o`yinchi 1-o`rinda');
  check(acks.filter((a) => a.accepted).length === CHECKPOINTS.length, `host: barcha ${CHECKPOINTS.length} checkpoint qabul qilindi`);
  const fin = acks.find((a) => a.index === CHECKPOINTS.length - 1);
  check(!!fin?.timeMs && fin.timeMs > 20_000, `marra vaqti serverda hisoblandi (${((fin?.timeMs ?? 0) / 1000).toFixed(1)} s)`);
  check(guestAcks.filter((a) => a.accepted).length === CHECKPOINTS.length, 'mehmon ham marraga yetdi');
  const f = finishing as { endsAt: number; receivedAt: number } | null;
  const graceLeft = f ? f.endsAt - f.receivedAt : 0;
  check(!!f && Math.abs(graceLeft - RACE.FINISH_GRACE_MS) < 1000, `birinchi marradan keyin qolganlarga tugash vaqti yuborildi (${(graceLeft / 1000).toFixed(1)} s)`);

  const res = await resultsP;
  check(res.length === 2 && res[0].playerId === host.id && res[0].place === 1, 'natijalar: host 1-o`rin');
  check(res[1].timeMs !== null && res[1].timeMs > res[0].timeMs!, '2-o`rin vaqti kattaroq');

  // Mehmon reset qila olmaydi; host lobbyga qaytaradi
  check(!(await reset(guest, false)).ok, 'mehmon xonani qayta tiklay olmaydi');
  const lobbyUpdate = new Promise<RoomInfo>((r) => guest.once('room:update', r));
  check((await reset(host, false)).ok, 'host xonani lobbyga qaytardi');
  check((await lobbyUpdate).phase === 'lobby', 'xona lobby holatida');
  const again = new Promise((r) => guest.once('race:countdown', r));
  check((await start(host)).ok, 'yangi poyga boshlandi');
  await again;
  check(true, 'yangi countdown keldi');

  // Poyga paytida qo'shilib bo'lmaydi
  const late = await connect();
  const lateJoin = await join(late, code, 'Kechikkan');
  check(!lateJoin.ok, 'poyga paytida qo`shilish rad etiladi');

  // Host uzilsa — mehmon host bo'ladi, ro'yxatdan o'chiriladi
  const afterLeave = new Promise<RoomInfo>((r) => guest.once('room:update', r));
  host.disconnect();
  const room = await afterLeave;
  check(room.players.length === 1 && room.players[0].isHost, 'uzilgan o`yinchi o`chirildi, host o`tdi');

  // To'la xona: 8 o'yinchi
  const owner = await connect();
  const full = await create(owner, 'Egasi');
  if (full.ok) {
    for (let i = 1; i < ROOM.MAX_PLAYERS; i++) await join(await connect(), full.data.code, `P${i}`);
    const extra = await join(await connect(), full.data.code, 'Ortiqcha');
    check(!extra.ok, `${ROOM.MAX_PLAYERS + 1}-o'yinchi rad etiladi`);
  }

  // Xona sozlamalari va upgrade'lar
  const h = await connect();
  const g = await connect();
  const configured = await new Promise<AckResult<RoomInfo>>((r) =>
    h.emit(
      'room:create',
      { name: 'Sozlovchi', upgrades: { engine: 99, grip: -3, boost: 2.7, steering: 1 } as never, settings: { trackId: 'lake', weather: 'snow' } },
      r,
    ),
  );
  if (configured.ok) {
    const info = configured.data;
    check(info.settings.trackId === 'lake' && info.settings.weather === 'snow', 'xona menyudagi sharoit bilan yaratildi');
    const u = info.players[0].upgrades;
    check(u.engine === 5 && u.grip === 0 && u.boost === 2 && u.steering === 1, 'upgrade darajalari 0..5 ga cheklandi');
    check(u.brakes === 0 && u.weight === 0 && u.nitro === 0, "eski klient (yangi qismlarsiz) — yangi qismlar 0");
    await join(g, info.code, 'Mehmon2');
    const settings = (c: Client, patch: object) =>
      new Promise<AckResult<null>>((r) => c.emit('room:settings', patch as never, r));
    check(!(await settings(g, { trackId: 'mountain' })).ok, 'host bo`lmagan o`yinchi sozlamani o`zgartira olmaydi');
    const upd = new Promise<RoomInfo>((r) => g.once('room:update', r));
    check((await settings(h, { trackId: 'mountain', season: 'winter', upgradesEnabled: false })).ok, 'host sozlamani o`zgartirdi');
    const after = await upd;
    check(
      after.settings.trackId === 'mountain' && after.settings.season === 'winter' && after.settings.weather === 'snow',
      'yangi sozlamalar hammaga yuborildi',
    );
    check(after.players.every((p) => Object.values(p.upgrades).every((v) => v === 0)), 'upgrade o`chirilganda hamma 0-darajada');
    check((await settings(h, { trackId: 'yoq-trassa' })).ok, "noma'lum trassa e'tiborsiz qoldiriladi");

    // Aylanali poyga (Gran Pri, 3 aylana): server har aylana checkpointlarini ketma-ket qabul qiladi
    const gp = getTrack('circuit');
    await settings(h, { trackId: 'circuit', upgradesEnabled: false });
    const acksH: { index: number; accepted: boolean; timeMs?: number }[] = [];
    h.on('race:checkpointAck', (a) => acksH.push(a));
    const resultsP = new Promise<RaceResult[]>((r) => h.once('race:results', ({ results }) => r(results)));
    const go = new Promise((r) => h.once('race:go', r));
    check((await start(h)).ok, 'Gran Pri poygasi boshlandi');
    await go;
    const startOf = (slot: number) => {
      const sp = gp.gridSpawn(slot);
      return gp.totalS(gp.nearestOnRoute(sp.position[0], sp.position[2]).s, gp.LINE_S);
    };
    const finishS = gp.CHECKPOINTS[gp.CHECKPOINTS.length - 1].totalS + 5;
    await Promise.all([drive(h, startOf(0), finishS, 58, 2.2, gp), drive(g, startOf(1), finishS, 57, -2.2, gp)]);
    const res = await resultsP;
    check(
      acksH.filter((a) => a.accepted).length === gp.CHECKPOINTS.length,
      `Gran Pri: ${gp.LAPS} aylana, barcha ${gp.CHECKPOINTS.length} checkpoint qabul qilindi`,
    );
    check(res.length === 2 && res.every((r) => r.timeMs !== null), 'ikkala o`yinchi 3 aylanani tugatdi');
  }
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(() => {
    clients.forEach((c) => c.disconnect());
    console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : '\nBarcha tekshiruvlar o`tdi');
    process.exit(failures ? 1 : 0);
  });
