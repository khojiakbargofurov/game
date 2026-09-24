/**
 * "To'da" simulyatsiyasi: start panjarasidan 8 ta bot bitta dunyoda (bir-biriga urilishi mumkin) poyga qiladi —
 * to'qnashuvdan qochish, tiqilib qolish va respawnlarni tekshiradi. Birinchi "bot" (0-joy) o'yinchi o'rnida.
 * Ko'prik (alohida collider) yo'q — sim-route kabi jarlik ustidan teleport qilinadi.
 * Ishga tushirish: npm run sim:pack -w client [-- trackId [weather [difficulty]]]
 */
import { WEATHER_FX, carStats, upgradesAt, yawOf } from '@game/shared';
import { computeDrive } from '../src/game/car/driveLogic';
import { applyDriveCommand } from '../src/game/car/vehicleSetup';
import { BOT_SKILLS, DIFFICULTIES, botDrive, newDriverState, type Difficulty } from '../src/game/bots/botDriver';
import { raceProgress } from '../src/store/bots';
import { DT, createCar, forwardSpeed, teleport, track, upright, weather, world, yawOfBody } from './simWorld';

const COUNT = 8;
const diffArg = process.argv[4];
const difficulty: Difficulty = DIFFICULTIES.some((d) => d.id === diffArg) ? (diffArg as Difficulty) : 'medium';
const skill = BOT_SKILLS[difficulty];
const grip = WEATHER_FX[weather].grip;
const stats = carStats(upgradesAt(skill.upgrades), grip);
const { BRIDGE, CHECKPOINTS, routeAt } = track;
console.log(`Qiyinlik: ${difficulty}, ${COUNT} mashina`);

const cars = Array.from({ length: COUNT }, (_, slot) => {
  const g = track.gridSpawn(slot);
  const car = createCar(g.position[0], g.position[1], g.position[2], stats);
  teleport(g.position[0], g.position[1], g.position[2], g.yaw, car.body);
  return {
    ...car,
    slot,
    lane: ((slot * 0.37) % 1) * 1.1 - 0.55,
    driver: newDriverState(slot * 13.7),
    steer: 0,
    next: 0,
    respawn: g,
    finish: null as number | null,
    respawns: 0,
    flips: 0,
    hits: 0,
    prevV: { x: 0, y: 0, z: 0 },
  };
});
const others = cars.map(() => [] as { x: number; z: number; speed: number }[]);

let t = 0;
while (t < 420 && cars.some((c) => c.finish === null)) {
  for (const [i, c] of cars.entries()) {
    const p = c.body.translation();
    const speed = forwardSpeed(c.body);
    if (c.finish !== null) {
      applyDriveCommand(c.vehicle, computeDrive(c.steer, { forward: false, backward: false, left: false, right: false, handbrake: false }, speed, DT, 1, stats), stats);
      c.vehicle.updateVehicle(DT);
      continue;
    }
    const near = track.nearestOnRoute(p.x, p.z);
    if (BRIDGE && near.s > BRIDGE.start - 4 && near.s < BRIDGE.end) {
      const f = routeAt(BRIDGE.end + 6 + c.slot * 3);
      teleport(f.x, f.y + 1.2, f.z, yawOf(f.tx, f.tz), c.body);
      // Ko'prik ustidagi checkpointlar ham o'tilgan hisoblanadi
      while (CHECKPOINTS[c.next] && CHECKPOINTS[c.next].s < BRIDGE.end + 6) c.next++;
      continue;
    }
    // Checkpoint
    const cp = CHECKPOINTS[c.next];
    if (cp && (cp.position[0] - p.x) ** 2 + (cp.position[2] - p.z) ** 2 < cp.radius ** 2 && Math.abs(cp.position[1] - p.y) < 8) {
      c.next++;
      c.respawn = { position: [cp.position[0], cp.position[1] + 1.2, cp.position[2]], yaw: cp.yaw };
      if (cp.isFinish) c.finish = t;
    }
    // Urilishlar: bir qadamda keskin Δv
    const v = c.body.linvel();
    if (Math.hypot(v.x - c.prevV.x, v.y - c.prevV.y, v.z - c.prevV.z) > 4) c.hits++;
    c.prevV = { x: v.x, y: v.y, z: v.z };

    const list = others[i];
    list.length = 0;
    for (const o of cars) {
      if (o === c) continue;
      const q = o.body.translation();
      list.push({ x: q.x, z: q.z, speed: forwardSpeed(o.body) });
    }
    const out = botDrive(c.driver, { track, x: p.x, y: p.y, z: p.z, yaw: yawOfBody(c.body), speed, dt: DT, skill, lane: c.lane, maxSpeed: stats.maxSpeed, grip, pace: 1, others: list });
    const flipped = upright(c.body) < 0.3 && Math.abs(speed) < 3;
    if (flipped) c.flips++;
    if (out.respawn || c.flips > 90) {
      c.respawns++;
      c.flips = 0;
      const r = c.respawn;
      teleport(r.position[0], r.position[1], r.position[2], r.yaw, c.body);
      continue;
    }
    const cmd = computeDrive(c.steer, out.input, speed, DT, 1, stats);
    c.steer = cmd.steer;
    applyDriveCommand(c.vehicle, cmd, stats);
    c.vehicle.updateVehicle(DT);
  }
  world.step();
  t += DT;
  if (Math.abs(t - Math.round(t / 15) * 15) < DT / 2) {
    const prog = cars.map((c) => {
      const p = c.body.translation();
      return c.finish !== null ? 'MARRA' : raceProgress(track, c.next, p.x, p.z).toFixed(0);
    });
    console.log(`t=${t.toFixed(0).padStart(3)}s  ${prog.join(' ')}`);
  }
}

console.log('');
for (const c of cars) {
  console.log(
    `#${c.slot} ${c.finish !== null ? `✅ ${c.finish.toFixed(1)} s` : `❌ ${c.next}/${CHECKPOINTS.length} cp`}  respawn: ${c.respawns}, urilish: ${c.hits}`,
  );
}
const finished = cars.filter((c) => c.finish !== null).length;
const respawns = cars.reduce((a, c) => a + c.respawns, 0);
console.log(`\nMarraga yetdi: ${finished}/${COUNT}, jami respawn: ${respawns}`);
