/**
 * Headless simulyatsiyalar uchun umumiy dunyo: relyef trimesh + mashina (o'yindagi bilan bir xil).
 * Argumentlar: [trackId] [weather] [max], masalan `npm run sim:route -w client -- mountain rain max`
 * (`max` — barcha upgrade'lar 5-darajada). 4-argument — sozlash: `speed` (hammasi +1) yoki `grip` (hammasi -1).
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { PlaneGeometry } from 'three';
import {
  CAR,
  DEFAULT_TRACK,
  DEFAULT_WEATHER,
  MAX_UPGRADE_LEVEL,
  WEATHER_FX,
  WORLD,
  carStats,
  getTrack,
  isTrackId,
  isWeather,
  upgradesAt,
} from '@game/shared';
import { createVehicleController } from '../src/game/car/vehicleSetup';
import { addKitColliders } from './kitColliders';

const [trackArg, weatherArg, levelArg, tuneArg] = process.argv.slice(2);
export const track = getTrack(isTrackId(trackArg) ? trackArg : DEFAULT_TRACK);
export const weather = isWeather(weatherArg) ? weatherArg : DEFAULT_WEATHER;
const L = levelArg === 'max' ? MAX_UPGRADE_LEVEL : 0;
export const stats = carStats(
  upgradesAt(L),
  WEATHER_FX[weather].grip,
  tuneArg === 'speed' ? { balance: 1, suspension: 1, drift: 1 } : tuneArg === 'grip' ? { balance: -1, suspension: -1, drift: -1 } : undefined,
);
const { START, terrainHeight } = track;
console.log(`Trassa: ${track.def.name} (${track.ROUTE_LENGTH} m), ob-havo: ${weather}, upgrade: ${L}, sozlash: ${tuneArg ?? '0'}`);

await RAPIER.init();
export const DT = 1 / 60;
export const world = new RAPIER.World({ x: 0, y: WORLD.GRAVITY, z: 0 });
world.timestep = DT;

// Relyef — Terrain.tsx dagi bilan bir xil trimesh
const geo = new PlaneGeometry(WORLD.TERRAIN_SIZE, WORLD.TERRAIN_SIZE, WORLD.TERRAIN_SEGMENTS, WORLD.TERRAIN_SEGMENTS);
geo.rotateX(-Math.PI / 2);
const pos = geo.attributes.position;
for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
export const terrainCollider = world.createCollider(
  RAPIER.ColliderDesc.trimesh(pos.array as Float32Array, geo.index!.array as Uint32Array).setFriction(1),
);
// Plitkali trassa: rampa va ko'priklar (o'yindagi KitTrack bilan bir xil collider)
const kitTris = addKitColliders(world, track);
if (kitTris) console.log(`Kit collider: ${kitTris} uchburchak (rampa, ko'prik)`);

const [HX, HY, HZ] = CAR.CHASSIS_HALF_EXTENTS;

/** O'yindagi bilan bir xil mashina: dinamik korpus + collider + vehicle controller */
export function createCar(x: number, y: number, z: number, carStats = stats) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setAngularDamping(CAR.ANGULAR_DAMPING).setCanSleep(false),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(HX, HY, HZ)
      .setFriction(0.3)
      .setMassProperties(
        CAR.MASS,
        { x: 0, y: CAR.CENTER_OF_MASS_Y, z: 0 },
        {
          x: (CAR.MASS / 12) * ((2 * HY) ** 2 + (2 * HZ) ** 2),
          y: (CAR.MASS / 12) * ((2 * HX) ** 2 + (2 * HZ) ** 2),
          z: (CAR.MASS / 12) * ((2 * HX) ** 2 + (2 * HY) ** 2),
        },
        { x: 0, y: 0, z: 0, w: 1 },
      ),
    body,
  );
  return { body, collider, vehicle: createVehicleController(world, body, carStats) };
}

type Body = ReturnType<typeof createCar>['body'];

export const { body, vehicle, collider: chassisCollider } = createCar(START.position[0], START.position[1], START.position[2]);

/** Mashina tezligi oldinga yo'nalishda (m/s) */
export function forwardSpeed(b: Body = body) {
  const q = b.rotation();
  const fx = 2 * (q.x * q.z + q.w * q.y);
  const fy = 2 * (q.y * q.z - q.w * q.x);
  const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const v = b.linvel();
  return fx * v.x + fy * v.y + fz * v.z;
}

export const yawOfBody = (b: Body = body) => {
  const q = b.rotation();
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
};

export const upright = (b: Body = body) => {
  const q = b.rotation();
  return 1 - 2 * (q.x * q.x + q.z * q.z);
};

export function teleport(x: number, y: number, z: number, yaw: number, b: Body = body) {
  b.setTranslation({ x, y, z }, true);
  b.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
  b.setLinvel({ x: 0, y: 0, z: 0 }, true);
  b.setAngvel({ x: 0, y: 0, z: 0 }, true);
}
