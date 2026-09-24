/**
 * Stress-test: agressiv haydovchi (to'liq gaz, maksimal/boost tezlik) o'rmon zonasini bosib o'tadi.
 * Qayd etiladi: korpusning relyefga tegishi (g'ildiraklar yerda bo'lsa ham — "ghost collision"),
 * keskin aylanish (angvel), ag'darilish.
 *   npm run sim:stress -w client
 */
import { CAR } from '@game/shared';
import { computeDrive } from '../src/game/car/driveLogic';
import { applyDriveCommand } from '../src/game/car/vehicleSetup';
import {
  DT,
  body,
  chassisCollider,
  forwardSpeed,
  teleport,
  terrainCollider,
  track,
  upright,
  vehicle,
  world,
  stats,
  yawOfBody,
} from './simWorld';

const { START, BRIDGE, nearestOnRoute, routeAt, def } = track;
// Birinchi o'rmon zonasi oxirigacha (hamma trassa o'rmondan boshlanadi); ko'prik collideri bu testda yo'q — undan oldin to'xtaymiz
const FOREST_END = Math.min(def.zones[0].end, BRIDGE ? BRIDGE.start : Infinity);
const near = { s: 0, dist: 0, lateral: 0, roadY: 0 };

function run(label: string, speedMultiplier: number) {
  teleport(START.position[0], START.position[1], START.position[2], START.yaw);
  let steer = 0;
  let t = 0;
  let chassisContacts = 0;
  let ghostFrames = 0;
  let spins = 0;
  let flips = 0;
  let maxAngvel = 0;
  const events: string[] = [];

  while (t < 60) {
    const p = body.translation();
    const n = nearestOnRoute(p.x, p.z, near);
    if (n.s > FOREST_END - 40) break;

    const target = routeAt(n.s + 14);
    let diff = Math.atan2(target.x - p.x, target.z - p.z) - yawOfBody();
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const speed = forwardSpeed();
    const cmd = computeDrive(
      steer,
      { forward: true, backward: false, left: diff > 0.03, right: diff < -0.03, handbrake: false },
      speed,
      DT,
      speedMultiplier,
      stats,
    );
    steer = cmd.steer;
    applyDriveCommand(vehicle, cmd, stats);
    vehicle.updateVehicle(DT);
    world.step();
    t += DT;

    // Korpus relyefga tegdimi (kontakt nuqtalari bor manifoldlar)
    let touching = false;
    world.contactPair(chassisCollider, terrainCollider, (manifold) => {
      if (manifold.numContacts() > 0) touching = true;
    });
    const wheels = [0, 1, 2, 3].filter((i) => vehicle.wheelIsInContact(i)).length;
    if (touching) {
      chassisContacts++;
      if (wheels >= 3) ghostFrames++;
    }
    const w = body.angvel();
    const angvel = Math.hypot(w.x, w.y, w.z);
    maxAngvel = Math.max(maxAngvel, angvel);
    // Yon (roll) yoki bo'ylama (pitch) aylanish — rul burishidan (yaw) farqli
    const q = body.rotation();
    const rollPitch = Math.hypot(w.x, w.z);
    if (rollPitch > 2.5 && events.length < 12) {
      spins++;
      events.push(
        `  s=${n.s.toFixed(0)} t=${t.toFixed(1)} v=${(speed * 3.6).toFixed(0)}km/h roll/pitch=${rollPitch.toFixed(1)}rad/s ` +
          `korpus-relyef=${touching ? 'HA' : "yo'q"} g'ildirak=${wheels}/4 yo'l-y=${(p.y - n.roadY).toFixed(2)} q=(${q.x.toFixed(2)},${q.z.toFixed(2)})`,
      );
    }
    if (upright() < 0.3) {
      flips++;
      events.push(`  ⚠️ AG'DARILDI s=${n.s.toFixed(0)}`);
      const f = routeAt(n.s + 5);
      teleport(f.x, f.y + 1.2, f.z, Math.atan2(f.tx, f.tz));
    }
  }
  const p = body.translation();
  console.log(
    `${label}: s=${nearestOnRoute(p.x, p.z).s.toFixed(0)} m, ${t.toFixed(1)} s | korpus-relyef kontakt: ${chassisContacts} kadr ` +
      `(g'ildiraklar yerda: ${ghostFrames}) | keskin roll/pitch: ${spins} | ag'darilish: ${flips} | max angvel ${maxAngvel.toFixed(1)}`,
  );
  events.forEach((e) => console.log(e));
}

run('Oddiy (max 108 km/h)', 1);
run('Boost (max 162 km/h)', CAR.BOOST_MULTIPLIER);
