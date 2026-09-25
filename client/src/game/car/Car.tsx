import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { Vector3, type Group } from 'three';
import { CAMERA, CAR, type NetState, type SpawnPoint } from '@game/shared';
import { attachKeyboard, consumeRespawn, input } from '../../input/keyboard';
import { useGameStore } from '../../store/gameStore';
import { controlsEnabled, useNetStore } from '../../store/netStore';
import { carTarget } from '../carTarget';
import { addTrauma } from '../../store/cameraStore';
import { useCarModel } from './carGeometry';
import { Chassis, boostKick, fellOffTrack, forwardSpeed, syncWheels, teleport, uprightness } from './chassis';
import { useCarChoice } from '../../store/carChoice';
import { activeTrack } from '../../store/raceSettings';
import { ownCarStats, useGarage, useLookPreview } from '../../store/garage';
import { computeDrive } from './driveLogic';
import { useVehicleController } from './useVehicleController';
import { applyDriveCommand } from './vehicleSetup';

/** Boshqaruv qulflanganda (menyu, xona) — hech qanday tugma bosilmagan */
const IDLE_INPUT = { forward: false, backward: false, left: false, right: false, handbrake: false };

/** Server tuzatishi: aniq holatga qo'yish, tezliklar nolga */
function applyCorrection(rb: RapierRigidBody, s: NetState) {
  const [x, y, z] = s.position;
  const [qx, qy, qz, qw] = s.rotation;
  rb.setTranslation({ x, y, z }, true);
  rb.setRotation({ x: qx, y: qy, z: qz, w: qw }, true);
  rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/**
 * O'yinchi mashinasi: Rapier rigid body (shassi) + raycast vehicle controller.
 * Fizika qadamidan oldin tugmalar o'qiladi va g'ildiraklarga kuch beriladi;
 * render kadrida g'ildirak vizuallari va kamera/HUD/tarmoq uchun `carTarget` yangilanadi.
 */
export function Car() {
  // Onlayn rejimda server tasdiqlagan mashina, yakkada — menyudagi tanlov
  const chosen = useCarChoice((s) => s.car);
  const garageLook = useGarage((s) => s.look);
  const previewLook = useLookPreview((s) => s.look);
  const me = useNetStore((s) => (s.mode === 'online' ? s.room?.players.find((p) => p.id === s.selfId) : undefined));
  const car = me ? me.car : chosen;
  const look = me ? me.look : (previewLook ?? garageLook);
  const { wheelX, wheelDrop } = useCarModel(car);
  const body = useRef<RapierRigidBody>(null);
  const anchor = useRef<Group>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const { controller, ensure } = useVehicleController();
  const steer = useRef(0);
  const flipTime = useRef(0);
  const lastBoost = useRef(0);
  const nitroWas = useRef(false);
  /** Oldingi qadamdagi tezlik vektori — urilishni (keskin Δv) aniqlash uchun; null = teleportdan keyin */
  const prevVel = useRef<Vector3 | null>(null);

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
      prevVel.current = null;
    }

    // Urilish / qattiq qo'nish: bir qadamda tezlik keskin o'zgarsa — kamera silkinadi
    const lv = rb.linvel();
    if (prevVel.current) {
      const dv = Math.hypot(lv.x - prevVel.current.x, lv.y - prevVel.current.y, lv.z - prevVel.current.z);
      if (dv > CAMERA.SHAKE.HIT_DV) addTrauma((dv - CAMERA.SHAKE.HIT_DV) * CAMERA.SHAKE.HIT_SCALE);
      prevVel.current.set(lv.x, lv.y, lv.z);
    } else prevVel.current = new Vector3(lv.x, lv.y, lv.z);

    // Respawn: R tugmasi, jarlikka/dunyodan tushib ketish yoki ag'darilib qolish
    const flipped = uprightness(rb) < 0.3 && Math.abs(speed) < 3;
    flipTime.current = flipped ? flipTime.current + dt : 0;
    if (consumeRespawn() || fellOffTrack(rb) || flipTime.current * 1000 > CAR.FLIP_RESPAWN_DELAY_MS) {
      teleport(rb, game.respawnPoint);
      steer.current = 0;
      flipTime.current = 0;
      carTarget.respawns++;
      prevVel.current = null;
    }

    const keys = controlsEnabled() ? input : IDLE_INPUT;
    // Upgrade'lar va ob-havo (sirpanchiq yo'l) — har qadamda (poygalar orasida o'zgarishi mumkin)
    const stats = ownCarStats();

    // Nitro: Shift bosib turilsa bak sarflanadi; kristall boost bilan qo'shilmaydi (multiplikator bir xil)
    const nitroOn = keys === input && input.nitro && game.nitroMs > 0 && speed > -0.5;
    if (nitroOn) {
      if (!nitroWas.current) addTrauma(CAMERA.SHAKE.BOOST * 0.6);
      game.setNitro(Math.max(0, game.nitroMs - dt * 1000));
    }
    nitroWas.current = nitroOn;
    const boosting = performance.now() < game.boostUntil || nitroOn;
    carTarget.boosting = boosting;
    // Yangi boost — oldinga bir martalik turtki
    if (game.boostUntil !== lastBoost.current) {
      lastBoost.current = game.boostUntil;
      if (performance.now() < game.boostUntil) boostKick(rb);
    }
    const cmd = computeDrive(steer.current, keys, speed, dt, boosting ? CAR.BOOST_MULTIPLIER : 1, stats);
    steer.current = cmd.steer;

    applyDriveCommand(v, cmd, stats);
    v.updateVehicle(dt);
  });

  useFrame(() => {
    const v = controller.current;
    const rb = body.current;
    if (!v || !rb) return;

    syncWheels(v, wheels.current, wheelX, wheelDrop);

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
  const [initial] = useState<SpawnPoint>(() => {
    // Menyu/xona ekranida dunyo boshqa trassaga qayta qurilgan bo'lishi mumkin — mashina shu trassaning startida
    // turishi kerak (oldingi trassaning start nuqtasi yangi relyef ichida qolib, mashina yer ostiga tushib ketardi)
    if (useNetStore.getState().screen !== 'race') useGameStore.setState({ respawnPoint: activeTrack().START });
    return useGameStore.getState().respawnPoint;
  });
  return (
    <Chassis body={body} wheels={wheels} car={car} look={look} initial={initial}>
      <group ref={anchor} />
    </Chassis>
  );
}
