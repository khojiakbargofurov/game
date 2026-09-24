/**
 * Mashina fizikasini brauzersiz (headless) sinash va sozlash uchun skript.
 * Ishga tushirish: npm run sim -w client
 *
 * O'yindagi drive/vehicle kodi bilan bir necha ssenariy o'ynaladi
 * (tezlanish, maksimal tezlik, tormoz, burilish, drift, orqaga yurish).
 */
import { computeDrive, type DriveInput } from '../src/game/car/driveLogic';
import { applyDriveCommand } from '../src/game/car/vehicleSetup';
import { DT, body, forwardSpeed, stats, teleport, track, upright, vehicle, world, yawOfBody } from './simWorld';

const { START } = track;

let steer = 0;
const yawDeg = () => (yawOfBody() * 180) / Math.PI;

function run(label: string, seconds: number, keys: Partial<DriveInput>) {
  const input: DriveInput = { forward: false, backward: false, left: false, right: false, handbrake: false, ...keys };
  const steps = Math.round(seconds / DT);
  for (let s = 0; s < steps; s++) {
    const cmd = computeDrive(steer, input, forwardSpeed(), DT, 1, stats);
    steer = cmd.steer;
    applyDriveCommand(vehicle, cmd, stats);
    vehicle.updateVehicle(DT);
    world.step();
  }
  const p = body.translation();
  const contacts = [0, 1, 2, 3].map((i) => (vehicle.wheelIsInContact(i) ? 1 : 0)).join('');
  console.log(
    `${label.padEnd(22)} t=${seconds.toFixed(1)}s  speed=${(forwardSpeed() * 3.6).toFixed(1).padStart(6)} km/h  ` +
      `pos=(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})  yaw=${yawDeg().toFixed(0).padStart(4)}°  ` +
      `up=${upright().toFixed(2)}  wheels=${contacts}  susp=${(vehicle.wheelSuspensionLength(0) ?? 0).toFixed(2)}`,
  );
}

function reset() {
  teleport(START.position[0], START.position[1], START.position[2], START.yaw);
  steer = 0;
  run('  settle', 1, {});
}

console.log('— Tezlanish va tormoz');
reset();
run('gaz', 1, { forward: true });
run('gaz', 1, { forward: true });
run('gaz', 2, { forward: true });
run('gaz', 2, { forward: true });
run('tormoz', 1, { backward: true });
run('tormoz', 1, { backward: true });
run('tormoz', 1, { backward: true });

console.log('— Yuqori tezlikda burilish');
reset();
run('gaz', 4, { forward: true });
run('gaz + chap', 1, { forward: true, left: true });
run('gaz + chap', 1, { forward: true, left: true });

console.log('— Past tezlikda burilish');
reset();
run('gaz', 1, { forward: true });
run('chap (gazsiz)', 1, { left: true });
run('chap (gazsiz)', 1, { left: true });

console.log('— Drift');
reset();
run('gaz', 3, { forward: true });
run('Space + chap', 1, { forward: true, left: true, handbrake: true });
run('Space + chap', 1, { forward: true, left: true, handbrake: true });
run("qo'yib yuborish", 2, {});

console.log('— Orqaga');
reset();
run('orqaga', 2, { backward: true });
run('orqaga', 2, { backward: true });
run('gaz (tormoz)', 1, { forward: true });

console.log("— Qo'yib yuborish (inersiya)");
reset();
run('gaz', 3, { forward: true });
run("qo'yib yuborish", 1, {});
run("qo'yib yuborish", 2, {});
