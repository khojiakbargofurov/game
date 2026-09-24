import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { Euler, Quaternion, Vector3, type Group } from 'three';
import { CAR, WORLD, type NearestResult, type NetState, type SpawnPoint } from '@game/shared';
import { attachKeyboard, consumeRespawn, input } from '../../input/keyboard';
import { useGameStore } from '../../store/gameStore';
import { controlsEnabled, useNetStore } from '../../store/netStore';
import { carTarget } from '../carTarget';
import { CarBody } from './CarBody';
import { Wheel } from './Wheel';
import { useCarModel } from './carGeometry';
import { useCarChoice } from '../../store/carChoice';
import { activeTrack } from '../../store/raceSettings';
import { ownCarStats } from '../../store/garage';
import { computeDrive } from './driveLogic';
import { useVehicleController } from './useVehicleController';
import { WHEEL_COUNT, applyDriveCommand } from './vehicleSetup';

const [HX, HY, HZ] = CAR.CHASSIS_HALF_EXTENTS;

const tmpQuat = new Quaternion();
const tmpVec = new Vector3();
const FORWARD = new Vector3(0, 0, 1);
const near: NearestResult = { s: 0, dist: 0, lateral: 0, roadY: 0 };

/** Yo'l yaqinida yo'ldan ancha pastga tushib ketdimi (masalan, ko'prikdan jarlikka) */
function fellOffTrack(rb: RapierRigidBody) {
  const p = rb.translation();
  if (p.y < WORLD.KILL_Y) return true;
  const n = activeTrack().nearestOnRoute(p.x, p.z, near);
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

/** Boshqaruv qulflanganda (menyu, xona) — hech qanday tugma bosilmagan */
const IDLE_INPUT = { forward: false, backward: false, left: false, right: false, handbrake: false };

function yawQuat(yaw: number) {
  return new Quaternion().setFromEuler(new Euler(0, yaw, 0));
}

/** Mashinani spawn nuqtasiga qaytarish: pozitsiya, yo'nalish, tezliklar nolga */
function teleport(rb: RapierRigidBody, p: SpawnPoint) {
  const q = yawQuat(p.yaw);
  rb.setTranslation({ x: p.position[0], y: p.position[1], z: p.position[2] }, true);
  rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/** Server tuzatishi: aniq holatga qo'yish, tezliklar nolga */
function applyCorrection(rb: RapierRigidBody, s: NetState) {
  const [x, y, z] = s.position;
  const [qx, qy, qz, qw] = s.rotation;
  rb.setTranslation({ x, y, z }, true);
  rb.setRotation({ x: qx, y: qy, z: qz, w: qw }, true);
  rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/** Mashinaning oldinga yo'nalishdagi tezligi (m/s) */
function forwardSpeed(rb: RapierRigidBody) {
  const r = rb.rotation();
  tmpQuat.set(r.x, r.y, r.z, r.w);
  const v = rb.linvel();
  return tmpVec.copy(FORWARD).applyQuaternion(tmpQuat).dot(v as Vector3);
}

/** Mashina "tepasi" qanchalik yuqoriga qaragan: 1 = to'g'ri, 0 = yonboshda, -1 = teskari */
function uprightness(rb: RapierRigidBody) {
  const r = rb.rotation();
  return 1 - 2 * (r.x * r.x + r.z * r.z);
}

/**
 * O'yinchi mashinasi: Rapier rigid body (shassi) + raycast vehicle controller.
 * Fizika qadamidan oldin tugmalar o'qiladi va g'ildiraklarga kuch beriladi;
 * render kadrida g'ildirak vizuallari va kamera/HUD/tarmoq uchun `carTarget` yangilanadi.
 */
export function Car() {
  // Onlayn rejimda server tasdiqlagan mashina, yakkada — menyudagi tanlov
  const chosen = useCarChoice((s) => s.car);
  const car = useNetStore((s) => {
    const me = s.mode === 'online' ? s.room?.players.find((p) => p.id === s.selfId) : undefined;
    return me ? me.car : chosen;
  });
  const { wheelX } = useCarModel(car);
  const body = useRef<RapierRigidBody>(null);
  const anchor = useRef<Group>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const { controller, ensure } = useVehicleController();
  const steer = useRef(0);
  const flipTime = useRef(0);
  const lastBoost = useRef(0);

  useEffect(attachKeyboard, []);

  useBeforePhysicsStep((world) => {
    const rb = body.current;
    const v = ensure(rb);
    if (!rb || !v) return;
    const dt = world.timestep;
    const speed = forwardSpeed(rb);

    const game = useGameStore.getState();

    // Server anti-cheat tuzatishi
    if (carTarget.pendingCorrection) {
      applyCorrection(rb, carTarget.pendingCorrection);
      carTarget.pendingCorrection = null;
    }

    // Respawn: R tugmasi, jarlikka/dunyodan tushib ketish yoki ag'darilib qolish
    const flipped = uprightness(rb) < 0.3 && Math.abs(speed) < 3;
    flipTime.current = flipped ? flipTime.current + dt : 0;
    if (consumeRespawn() || fellOffTrack(rb) || flipTime.current * 1000 > CAR.FLIP_RESPAWN_DELAY_MS) {
      teleport(rb, game.respawnPoint);
      steer.current = 0;
      flipTime.current = 0;
      carTarget.respawns++;
    }

    const boosting = performance.now() < game.boostUntil;
    // Yangi boost — oldinga bir martalik turtki
    if (game.boostUntil !== lastBoost.current) {
      lastBoost.current = game.boostUntil;
      if (boosting) {
        const r = rb.rotation();
        tmpVec.copy(FORWARD).applyQuaternion(tmpQuat.set(r.x, r.y, r.z, r.w)).multiplyScalar(CAR.MASS * CAR.BOOST_KICK);
        rb.applyImpulse(tmpVec, true);
      }
    }
    const keys = controlsEnabled() ? input : IDLE_INPUT;
    // Upgrade'lar va ob-havo (sirpanchiq yo'l) — har qadamda (poygalar orasida o'zgarishi mumkin)
    const stats = ownCarStats();
    const cmd = computeDrive(steer.current, keys, speed, dt, boosting ? CAR.BOOST_MULTIPLIER : 1, stats);
    steer.current = cmd.steer;

    applyDriveCommand(v, cmd, stats);
    v.updateVehicle(dt);
  });

  useFrame(() => {
    const v = controller.current;
    const rb = body.current;
    if (!v || !rb) return;

    // G'ildirak vizuallari: suspensiya uzunligi, rul, aylanish
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const w = wheels.current[i];
      if (!w) continue;
      const [x, y, z] = CAR.WHEEL_POSITIONS[i];
      // Vizual g'ildirak model proporsiyasida (X), balandlik va rul — fizikadan
      w.position.set(Math.sign(x) * wheelX, y - (v.wheelSuspensionLength(i) ?? CAR.SUSPENSION_REST_LENGTH), z);
      w.rotation.y = v.wheelSteering(i) ?? 0;
      w.children[0].rotation.x = v.wheelRotation(i) ?? 0;
    }

    // Kamera/yorug'lik uchun interpolyatsiyalangan pozitsiya
    if (anchor.current) {
      anchor.current.getWorldPosition(carTarget.position);
      anchor.current.getWorldQuaternion(carTarget.quaternion);
    }
    carTarget.speed = forwardSpeed(rb);
    const lv = rb.linvel();
    carTarget.velocity.set(lv.x, lv.y, lv.z);
  });

  // Boshlang'ich joy faqat bir marta olinadi. MUHIM: r3/rapier `position`/`rotation` prop'lari o'zgarib
  // komponent qayta render bo'lsa, body'ni o'sha joyga ko'chiradi (tezlik saqlangan holda). Agar bu yerda
  // joriy respawnPoint berilsa, har qanday qayta renderda (masalan, PerformanceMonitor DPR'ni o'zgartirganda)
  // mashina haydash o'rtasida oxirgi checkpointga "sakrab" ketardi. Respawn'lar imperativ (teleport()).
  const [initial] = useState(() => {
    // Menyu/xona ekranida dunyo boshqa trassaga qayta qurilgan bo'lishi mumkin — mashina shu trassaning startida
    // turishi kerak (oldingi trassaning start nuqtasi yangi relyef ichida qolib, mashina yer ostiga tushib ketardi)
    if (useNetStore.getState().screen !== 'race') useGameStore.setState({ respawnPoint: activeTrack().START });
    const spawn = useGameStore.getState().respawnPoint;
    return { position: spawn.position, rotation: [0, spawn.yaw, 0] as [number, number, number] };
  });
  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={initial.position}
      rotation={initial.rotation}
      angularDamping={CAR.ANGULAR_DAMPING}
      canSleep={false}
      ccd
    >
      <CuboidCollider args={[HX, HY, HZ]} massProperties={MASS_PROPS} friction={0.3} />
      <group ref={anchor} />
      <CarBody car={car} />
      {CAR.WHEEL_POSITIONS.map(([x], i) => (
        <Wheel key={i} car={car} right={x < 0} ref={(el) => void (wheels.current[i] = el)} />
      ))}
    </RigidBody>
  );
}
