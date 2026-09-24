/**
 * Headless simulyatsiyalar uchun umumiy dunyo: relyef trimesh + mashina (o'yindagi bilan bir xil).
 * Argumentlar: [trackId] [weather] [max], masalan `npm run sim:route -w client -- mountain rain max`
 * (`max` — barcha upgrade'lar 5-darajada).
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

const [trackArg, weatherArg, levelArg] = process.argv.slice(2);
export const track = getTrack(isTrackId(trackArg) ? trackArg : DEFAULT_TRACK);
export const weather = isWeather(weatherArg) ? weatherArg : DEFAULT_WEATHER;
const L = levelArg === 'max' ? MAX_UPGRADE_LEVEL : 0;
export const stats = carStats(
  upgradesAt(L),
  WEATHER_FX[weather].grip,
);
const { START, terrainHeight } = track;
console.log(`Trassa: ${track.def.name} (${track.ROUTE_LENGTH} m), ob-havo: ${weather}, upgrade: ${L}`);

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

const [HX, HY, HZ] = CAR.CHASSIS_HALF_EXTENTS;
export const body = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(START.position[0], START.position[1], START.position[2])
    .setAngularDamping(CAR.ANGULAR_DAMPING)
    .setCanSleep(false),
);
export const chassisCollider = world.createCollider(
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
export const vehicle = createVehicleController(world, body, stats);


/** Mashina tezligi oldinga yo'nalishda (m/s) */
export function forwardSpeed() {
  const q = body.rotation();
  const fx = 2 * (q.x * q.z + q.w * q.y);
  const fy = 2 * (q.y * q.z - q.w * q.x);
  const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const v = body.linvel();
  return fx * v.x + fy * v.y + fz * v.z;
}

export const yawOfBody = () => {
  const q = body.rotation();
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
};

export const upright = () => {
  const q = body.rotation();
  return 1 - 2 * (q.x * q.x + q.z * q.z);
};

export function teleport(x: number, y: number, z: number, yaw: number) {
  body.setTranslation({ x, y, z }, true);
  body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}
