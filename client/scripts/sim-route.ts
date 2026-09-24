/**
 * Avtopilot butun marshrutni relyef ustida bosib o'tadi — yo'l haydashga yaroqliligini tekshirish:
 * qotib qolish, ag'darilish, yo'ldan chiqib ketish joylarini ko'rsatadi.
 * Ko'prik (alohida collider) bu testda yo'q, shuning uchun jarlik ustidan teleport qilinadi.
 * Ishga tushirish: npm run sim:route -w client
 */
import { BRIDGE, CHECKPOINTS, ROUTE_LENGTH, START, nearestOnRoute, routeAt, yawOf, zoneAt } from '@game/shared';
import { computeDrive } from '../src/game/car/driveLogic';
import { applyDriveCommand } from '../src/game/car/vehicleSetup';
import { DT, body, forwardSpeed, teleport, upright, vehicle, world, yawOfBody } from './simWorld';

const TARGET_SPEED = 20; // m/s ≈ 72 km/h
const LOOKAHEAD = 12;

teleport(...START.position, START.yaw);
let steer = 0;
let t = 0;
let nextReport = 0;
let stuckTime = 0;
let problems = 0;
let bestS = 0;
const near = { s: 0, dist: 0, lateral: 0, roadY: 0 };

while (t < 240) {
  const p = body.translation();
  const n = nearestOnRoute(p.x, p.z, near);
  bestS = Math.max(bestS, n.s);
  if (n.s > ROUTE_LENGTH - 12) break;

  // Ko'prik uchastkasi — jarlikdan keyin teleport
  if (n.s > BRIDGE.start - 4 && n.s < BRIDGE.end) {
    const f = routeAt(BRIDGE.end + 6);
    teleport(f.x, f.y + 1.2, f.z, yawOf(f.tx, f.tz));
    continue;
  }

  // Oldindagi nuqtaga qarab rul: burchak farqi → chap/o'ng
  const target = routeAt(n.s + LOOKAHEAD);
  const want = Math.atan2(target.x - p.x, target.z - p.z);
  let diff = want - yawOfBody();
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const speed = forwardSpeed();
  const input = {
    forward: speed < TARGET_SPEED,
    backward: false,
    left: diff > 0.05,
    right: diff < -0.05,
    handbrake: false,
  };
  const cmd = computeDrive(steer, input, speed, DT);
  steer = cmd.steer;
  applyDriveCommand(vehicle, cmd);
  vehicle.updateVehicle(DT);
  world.step();
  t += DT;

  stuckTime = Math.abs(speed) < 2 ? stuckTime + DT : 0;
  const bad = upright() < 0.3 || stuckTime > 3 || n.dist > 15;
  if (bad) {
    problems++;
    console.log(
      `⚠️  s=${n.s.toFixed(0)} (${zoneAt(n.s)}) muammo: up=${upright().toFixed(2)} tezlik=${speed.toFixed(1)} yo'ldan=${n.dist.toFixed(1)}m`,
    );
    // Keyingi checkpointdan davom ettiramiz
    const cp = CHECKPOINTS.find((c) => c.s > n.s + 5) ?? CHECKPOINTS[CHECKPOINTS.length - 1];
    teleport(cp.position[0], cp.position[1] + 1.2, cp.position[2], cp.yaw);
    stuckTime = 0;
    if (problems > 10) break;
  }

  if (t >= nextReport) {
    nextReport += 5;
    console.log(
      `t=${t.toFixed(0).padStart(3)}s  s=${n.s.toFixed(0).padStart(4)}m  ${zoneAt(n.s).padEnd(6)}  ` +
        `${(speed * 3.6).toFixed(0).padStart(3)} km/h  yon=${n.lateral.toFixed(1).padStart(5)}  ` +
        `y-yo'l=${(p.y - n.roadY).toFixed(2)}  up=${upright().toFixed(2)}`,
    );
  }
}
console.log(`\nNatija: ${bestS.toFixed(0)}/${ROUTE_LENGTH} m, vaqt ${t.toFixed(1)} s, muammolar: ${problems}`);
