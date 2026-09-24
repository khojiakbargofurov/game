import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { CAR } from '@game/shared';

export type VehicleController = ReturnType<World['createVehicleController']>;

export const WHEEL_COUNT = CAR.WHEEL_POSITIONS.length;
/** Oldingi (rul boshqaradigan) g'ildiraklar indekslari: 0, 1; orqa: 2, 3 */
export const isFrontWheel = (i: number) => i < 2;

/**
 * Rapier DynamicRayCastVehicleController: har bir g'ildirak — pastga yo'nalgan raycast
 * + prujina/damper suspensiya. React'dan mustaqil — headless testda ham ishlatiladi.
 */
export function createVehicleController(world: World, chassis: RigidBody): VehicleController {
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
    v.setWheelFrictionSlip(i, CAR.FRICTION_SLIP);
    v.setWheelSideFrictionStiffness(i, CAR.SIDE_FRICTION);
  });
  return v;
}

export interface WheelCommand {
  engine: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

/** Drive buyrug'ini g'ildiraklarga qo'llash (qo'l tormozi: orqa g'ildiraklar qulf + kam yon ishqalanish → drift) */
export function applyDriveCommand(v: VehicleController, cmd: WheelCommand) {
  for (let i = 0; i < WHEEL_COUNT; i++) {
    const front = isFrontWheel(i);
    const rearHandbrake = cmd.handbrake && !front;
    v.setWheelEngineForce(i, cmd.engine);
    v.setWheelSteering(i, front ? cmd.steer : 0);
    v.setWheelBrake(i, rearHandbrake ? CAR.HANDBRAKE_FORCE : cmd.brake);
    v.setWheelSideFrictionStiffness(i, rearHandbrake ? CAR.DRIFT_SIDE_FRICTION : CAR.SIDE_FRICTION);
  }
}
