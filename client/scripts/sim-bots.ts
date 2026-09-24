/**
 * Bot haydovchisi (botDriver) har qiyinlikda butun marshrutni (1 aylana) bosib o'tadi:
 * vaqt, o'rtacha tezlik, respawnlar. Qiyin < o'rta < oson vaqt tartibi va 0 respawn kutiladi.
 * Ko'prik (alohida collider) bu testda yo'q — sim-route kabi jarlik ustidan teleport qilinadi.
 * Ishga tushirish: npm run sim:bots -w client [-- trackId [weather]]
 */
import { WEATHER_FX, carStats, upgradesAt, yawOf } from '@game/shared';
import { computeDrive } from '../src/game/car/driveLogic';
import { applyDriveCommand } from '../src/game/car/vehicleSetup';
import { BOT_SKILLS, DIFFICULTIES, botDrive, newDriverState } from '../src/game/bots/botDriver';
import { DT, body, forwardSpeed, teleport, track, vehicle, weather, world, yawOfBody } from './simWorld';

const { BRIDGE, CHECKPOINTS, ROUTE_LENGTH, START, routeAt } = track;
const grip = WEATHER_FX[weather].grip;
const times: number[] = [];

for (const { id, label } of DIFFICULTIES) {
  const skill = BOT_SKILLS[id];
  const stats = carStats(upgradesAt(skill.upgrades), grip);
  const st = newDriverState(1.7);
  teleport(START.position[0], START.position[1], START.position[2], START.yaw);
  let steer = 0;
  let t = 0;
  let respawns = 0;
  let prevS = track.nearestOnRoute(START.position[0], START.position[2]).s;
  let travelled = 0;
  let maxKmh = 0;

  while (t < 300 && travelled < ROUTE_LENGTH - 15) {
    const p = body.translation();
    if (BRIDGE && prevS > BRIDGE.start - 4 && prevS < BRIDGE.end) {
      const f = routeAt(BRIDGE.end + 6);
      teleport(f.x, f.y + 1.2, f.z, yawOf(f.tx, f.tz));
      travelled += BRIDGE.end + 6 - prevS;
      prevS = BRIDGE.end + 6;
      continue;
    }
    const speed = forwardSpeed();
    maxKmh = Math.max(maxKmh, speed * 3.6);
    const out = botDrive(st, { track, x: p.x, z: p.z, yaw: yawOfBody(), speed, dt: DT, skill, lane: 0.2, maxSpeed: stats.maxSpeed, grip, pace: 1 });
    // Halqada s o'raladi — bosib o'tilgan masofa farqlar yig'indisi
    let ds = out.s - prevS;
    if (ds < -ROUTE_LENGTH / 2) ds += ROUTE_LENGTH;
    if (ds > ROUTE_LENGTH / 2) ds -= ROUTE_LENGTH;
    if (Math.abs(ds) < 30) travelled += ds;
    prevS = out.s;

    if (out.respawn) {
      respawns++;
      const cp = CHECKPOINTS.find((c) => c.s > out.s + 5) ?? CHECKPOINTS[CHECKPOINTS.length - 1];
      console.log(`  ⚠️  ${label}: respawn s=${out.s.toFixed(0)}`);
      teleport(cp.position[0], cp.position[1] + 1.2, cp.position[2], cp.yaw);
    }
    const cmd = computeDrive(steer, out.input, speed, DT, 1, stats);
    steer = cmd.steer;
    applyDriveCommand(vehicle, cmd, stats);
    vehicle.updateVehicle(DT);
    world.step();
    t += DT;
  }
  const done = travelled >= ROUTE_LENGTH - 15;
  times.push(done ? t : Infinity);
  console.log(
    `${label.padEnd(6)} ${done ? '✅' : '❌'} ${t.toFixed(1).padStart(6)} s  o'rtacha ${((travelled / t) * 3.6).toFixed(0)} km/h, ` +
      `maks ${maxKmh.toFixed(0)} km/h, respawn: ${respawns}`,
  );
}
const ordered = times[0] > times[1] && times[1] > times[2];
console.log(ordered ? "\nTartib to'g'ri: qiyin < o'rta < oson" : "\n⚠️ Vaqtlar tartibi kutilganidek emas");
