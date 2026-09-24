import type { ReactNode, RefObject } from 'react';
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { Euler, Quaternion, Vector3, type Group } from 'three';
import { CAR, WORLD, type CarId, type CarLook, type NearestResult, type SpawnPoint } from '@game/shared';
import { activeTrack } from '../../store/raceSettings';
import { CarBody } from './CarBody';
import { Wheel } from './Wheel';
import { WHEEL_COUNT, type VehicleController } from './vehicleSetup';

/**
 * O'yinchi (Car) va botlar (BotCar) uchun umumiy fizik korpus: rigid body + collider + vizual,
 * hamda respawn/tezlik yordamchilari.
 */

const [HX, HY, HZ] = CAR.CHASSIS_HALF_EXTENTS;

const tmpQuat = new Quaternion();
const tmpVec = new Vector3();
export const FORWARD = new Vector3(0, 0, 1);
const near: NearestResult = { s: 0, dist: 0, lateral: 0, roadY: 0 };

/** Yo'l yaqinida yo'ldan ancha pastga tushib ketdimi (masalan, ko'prikdan jarlikka) */
export function fellOffTrack(rb: RapierRigidBody) {
  const p = rb.translation();
  if (p.y < WORLD.KILL_Y) return true;
  const n = activeTrack().nearestOnRoute(p.x, p.z, near, p.y);
  return n.dist < WORLD.OFF_TRACK_RADIUS && p.y < n.roadY - WORLD.OFF_TRACK_DROP;
}

/** Og'irlik markazini pastga tushirish uchun collider mass properties */
const MASS_PROPS = {
  mass: CAR.MASS,
  centerOfMass: { x: 0, y: CAR.CENTER_OF_MASS_Y, z: 0 },
  // Cuboid inersiyasi: m/12 * (b² + c²)
  principalAngularInertia: {
    x: (CAR.MASS / 12) * ((2 * HY) ** 2 + (2 * HZ) ** 2),
    y: (CAR.MASS / 12) * ((2 * HX) ** 2 + (2 * HZ) ** 2),
    z: (CAR.MASS / 12) * ((2 * HX) ** 2 + (2 * HY) ** 2),
  },
  angularInertiaLocalFrame: { x: 0, y: 0, z: 0, w: 1 },
};

function yawQuat(yaw: number) {
  return new Quaternion().setFromEuler(new Euler(0, yaw, 0));
}

/** Mashinani spawn nuqtasiga qaytarish: pozitsiya, yo'nalish, tezliklar nolga */
export function teleport(rb: RapierRigidBody, p: SpawnPoint) {
  const q = yawQuat(p.yaw);
  rb.setTranslation({ x: p.position[0], y: p.position[1], z: p.position[2] }, true);
  rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/** Mashinaning oldinga yo'nalishdagi tezligi (m/s) */
export function forwardSpeed(rb: RapierRigidBody) {
  const r = rb.rotation();
  tmpQuat.set(r.x, r.y, r.z, r.w);
  const v = rb.linvel();
  return tmpVec.copy(FORWARD).applyQuaternion(tmpQuat).dot(v as Vector3);
}

/** Mashina "tepasi" qanchalik yuqoriga qaragan: 1 = to'g'ri, 0 = yonboshda, -1 = teskari */
export function uprightness(rb: RapierRigidBody) {
  const r = rb.rotation();
  return 1 - 2 * (r.x * r.x + r.z * r.z);
}

/** Gorizontal yo'nalish burchagi (yaw, 0 = +Z) */
export function yawOfBody(rb: RapierRigidBody) {
  const q = rb.rotation();
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
}

/** Boost olinganda oldinga bir martalik turtki */
export function boostKick(rb: RapierRigidBody) {
  const r = rb.rotation();
  tmpVec.copy(FORWARD).applyQuaternion(tmpQuat.set(r.x, r.y, r.z, r.w)).multiplyScalar(CAR.MASS * CAR.BOOST_KICK);
  rb.applyImpulse(tmpVec, true);
}

/** G'ildirak vizuallari: suspensiya uzunligi, rul, aylanish (har render kadrida) */
export function syncWheels(v: VehicleController, wheels: (Group | null)[], wheelX: number, wheelDrop = 0) {
  for (let i = 0; i < WHEEL_COUNT; i++) {
    const w = wheels[i];
    if (!w) continue;
    const [x, y, z] = CAR.WHEEL_POSITIONS[i];
    // Vizual g'ildirak model proporsiyasida (X), balandlik va rul — fizikadan
    w.position.set(Math.sign(x) * wheelX, y - (v.wheelSuspensionLength(i) ?? CAR.SUSPENSION_REST_LENGTH) - wheelDrop, z);
    w.rotation.y = v.wheelSteering(i) ?? 0;
    w.children[0].rotation.x = v.wheelRotation(i) ?? 0;
  }
}

/**
 * Rigid body (shassi collideri bilan) + korpus va g'ildirak vizuallari.
 * `initial` faqat mount paytida qo'llanadi — keyingi joy o'zgarishlari imperativ (teleport()).
 */
export function Chassis({
  body,
  wheels,
  car,
  look,
  initial,
  children,
}: {
  body: RefObject<RapierRigidBody | null>;
  wheels: RefObject<(Group | null)[]>;
  car: CarId;
  look: CarLook;
  initial: SpawnPoint;
  children?: ReactNode;
}) {
  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={initial.position}
      rotation={[0, initial.yaw, 0]}
      angularDamping={CAR.ANGULAR_DAMPING}
      canSleep={false}
      ccd
    >
      <CuboidCollider args={[HX, HY, HZ]} massProperties={MASS_PROPS} friction={0.3} />
      <CarBody car={car} look={look} />
      {CAR.WHEEL_POSITIONS.map(([x], i) => (
        <Wheel key={i} car={car} rim={look.rim} right={x < 0} ref={(el) => void (wheels.current[i] = el)} />
      ))}
      {children}
    </RigidBody>
  );
}
