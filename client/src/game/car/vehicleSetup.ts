import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { CAR, NO_UPGRADES, carStats, type CarStats } from '@game/shared';

const BASE_STATS = carStats(NO_UPGRADES);

export type VehicleController = ReturnType<World['createVehicleController']>;

export const WHEEL_COUNT = CAR.WHEEL_POSITIONS.length;
/** Oldingi (rul boshqaradigan) g'ildiraklar indekslari: 0, 1; orqa: 2, 3 */
export const isFrontWheel = (i: number) => i < 2;

/**
 * Rapier DynamicRayCastVehicleController: har bir g'ildirak — pastga yo'nalgan raycast
 * + prujina/damper suspensiya. React'dan mustaqil — headless testda ham ishlatiladi.
 */
export function createVehicleController(world: World, chassis: RigidBody, stats: CarStats = BASE_STATS): VehicleController {
  const v = world.createVehicleController(chassis);
  // Mashinaning "oldi" lokal +Z o'qi (Rapier'da default +X)
  v.setIndexForwardAxis = 2;

  CAR.WHEEL_POSITIONS.forEach(([x, y, z], i) => {
    v.addWheel({ x, y, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, CAR.SUSPENSION_REST_LENGTH, CAR.WHEEL_RADIUS);
    v.setWheelMaxSuspensionTravel(i, CAR.SUSPENSION_TRAVEL);
    v.setWheelSuspensionStiffness(i, CAR.SUSPENSION_STIFFNESS);
    v.setWheelSuspensionCompression(i, CAR.SUSPENSION_COMPRESSION);
    v.setWheelSuspensionRelaxation(i, CAR.SUSPENSION_RELAXATION);
    v.setWheelMaxSuspensionForce(i, 100_000);
    v.setWheelFrictionSlip(i, stats.frictionSlip);
    v.setWheelSideFrictionStiffness(i, stats.sideFriction);
  });
  return v;
}

export interface WheelCommand {
  engine: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

/**
 * Drive buyrug'ini g'ildiraklarga qo'llash (qo'l tormozi: orqa g'ildiraklar qulf + kam yon ishqalanish → drift).
 * Ishqalanish va suspensiya har qadamda qo'llanadi — ob-havo/upgrade o'zgarsa controller qayta yaratilmaydi.
 */
export function applyDriveCommand(v: VehicleController, cmd: WheelCommand, stats: CarStats = BASE_STATS) {
  for (let i = 0; i < WHEEL_COUNT; i++) {
    const front = isFrontWheel(i);
    const rearHandbrake = cmd.handbrake && !front;
    v.setWheelEngineForce(i, cmd.engine);
    v.setWheelSteering(i, front ? cmd.steer : 0);
    v.setWheelBrake(i, rearHandbrake ? stats.handbrakeForce : cmd.brake);
    v.setWheelFrictionSlip(i, stats.frictionSlip);
    v.setWheelSideFrictionStiffness(i, rearHandbrake ? stats.driftSideFriction : stats.sideFriction);
    v.setWheelSuspensionStiffness(i, stats.suspensionStiffness);
    v.setWheelSuspensionCompression(i, stats.suspensionCompression);
    v.setWheelSuspensionRelaxation(i, stats.suspensionRelaxation);
  }
}
