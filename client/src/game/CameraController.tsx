import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA, CAR, ROOM } from '@game/shared';
import { input } from '../input/keyboard';
import { camFx, addTrauma, useCameraStore } from '../store/cameraStore';
import { useGameStore } from '../store/gameStore';
import { useNetStore } from '../store/netStore';
import { activeTrack } from '../store/raceSettings';
import { carTarget } from './carTarget';

const UP = new Vector3(0, 1, 0);
const heading = new Vector3(0, 0, 1);
const view = new Vector3();
const carForward = new Vector3();
const desired = new Vector3();
const look = new Vector3();
const local = new Vector3();
const basePos = new Vector3();
const smoothLook = new Vector3();
const shake = new Vector3();
let initialized = false;
let prevYaw = 0;
let roll = 0;
let lastBoostUntil = 0;
let time = 0;
/** Menyudagi shourum aylanishi burchagi (mashina oldidan hisoblanadi) */
let showroomAngle: number = CAMERA.SHOWROOM.START_ANGLE;

/** Framerate'ga bog'liq bo'lmagan lerp koeffitsiyenti: 1 - e^(-k·dt) */
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Arzon "shovqin": turli chastotali sinuslar yig'indisi, -1..1 atrofida */
const wobble = (t: number, seed: number) => (Math.sin(t * 1.0 + seed) + Math.sin(t * 2.3 + seed * 3.1) * 0.5) / 1.5;

/**
 * Horizontal (orqa, tepa) ofsetni sichqoncha pitch'i bilan vertikal tekislikda aylantirish:
 * kamera masofasi saqlanadi, balandlik burchagi o'zgaradi.
 */
function pitched(back: number, up: number, pitch: number): [number, number] {
  if (pitch === 0) return [back, up];
  const r = Math.hypot(back, up);
  const elev = clamp(Math.atan2(up, -back) + pitch, -0.1, 1.45);
  return [-r * Math.cos(elev), r * Math.sin(elev)];
}

/** Sichqoncha tortib mashina atrofida qarash; qo'yib yuborilsa kamera o'z joyiga qaytadi */
function useOrbitDrag() {
  const el = useThree((s) => s.gl.domElement);
  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      camFx.dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!camFx.dragging) return;
      // Tugma boshqa joyda (masalan, oyna tashqarisida) qo'yib yuborilgan
      if (e.buttons === 0) return void (camFx.dragging = false);
      const { SENSITIVITY, MIN_PITCH, MAX_PITCH } = CAMERA.ORBIT;
      camFx.orbitYaw = wrap(camFx.orbitYaw - (e.clientX - lastX) * SENSITIVITY);
      camFx.orbitPitch = clamp(camFx.orbitPitch + (e.clientY - lastY) * SENSITIVITY, MIN_PITCH, MAX_PITCH);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      camFx.dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const release = () => void (camFx.dragging = false);
    const noMenu = (e: MouseEvent) => e.preventDefault();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', noMenu);
    window.addEventListener('pointerup', release);
    window.addEventListener('mouseup', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('mouseup', release);
      window.removeEventListener('blur', release);
      camFx.dragging = false;
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('contextmenu', noMenu);
    };
  }, [el]);
}

/**
 * O'yin kamerasi: rejimlar (orqadan / uzoqdan / kapot / tepadan — V), Q — orqaga qarash,
 * sichqoncha bilan aylantirish, countdown paytida mashina atrofida intro, silkinish, burilishda og'ish, tezlikda FOV.
 * Chase rejimlari faqat mashinaning gorizontal yo'nalishiga (heading) ergashadi — mashina sakrasa yoki
 * ag'darilsa kamera aylanib ketmaydi.
 */
export function CameraController() {
  useOrbitDrag();

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    time += dt;
    const mode = useCameraStore.getState().mode;
    const cfg = CAMERA.MODES[mode];
    const game = useGameStore.getState();
    const screen = useNetStore.getState().screen;
    const intro = game.phase === 'countdown' && screen === 'race';
    // Menyu va xona: kamera mashina atrofida sekin aylanadi (Asphalt'dagi garaj kabi), sichqoncha bilan buriladi
    const showroom = screen !== 'race';

    // Mashina oldi yo'nalishini XZ tekisligiga proyeksiya qilamiz.
    // Birinchi kadr yoki respawn (katta sakrash) — kamera darhol joyiga qo'yiladi
    const snap = !initialized || basePos.distanceToSquared(carTarget.position) > 60 * 60;
    carForward.set(0, 0, 1).applyQuaternion(carTarget.quaternion).setY(0);
    if (carForward.lengthSq() > 1e-4) {
      carForward.normalize();
      if (snap) heading.copy(carForward);
      else heading.lerp(carForward, damp(CAMERA.HEADING_SHARPNESS, dt)).normalize();
    }

    // Sichqoncha qo'yib yuborilgan — orbit asta nolga qaytadi
    if (!camFx.dragging) {
      const k = 1 - damp(CAMERA.ORBIT.RETURN_SHARPNESS, dt);
      camFx.orbitYaw *= k;
      camFx.orbitPitch *= k;
    }
    // Orbit (sichqoncha) va orqaga qarash burchagi — silliqlashdan keyin mashina atrofida aylantiriladi,
    // shunda kamera aylanada harakatlanadi (to'g'ri chiziq bo'ylab mashina ichidan o'tib ketmaydi)
    const yaw = camFx.orbitYaw + (input.lookBack ? Math.PI : 0);

    let sharpness: number = cfg.sharpness;
    if (showroom) {
      const { SPEED, RADIUS, HEIGHT, LOOK_Y } = CAMERA.SHOWROOM;
      // Tortilgan burchak doimiy aylanishga qo'shiladi (qaytib ketmaydi)
      showroomAngle = wrap(showroomAngle + SPEED * dt + camFx.orbitYaw);
      camFx.orbitYaw = 0;
      const [back, up] = pitched(-RADIUS, HEIGHT, camFx.orbitPitch);
      local.copy(heading).applyAxisAngle(UP, showroomAngle);
      desired.copy(carTarget.position).addScaledVector(local, -back);
      desired.y += up;
      look.copy(carTarget.position);
      look.y += LOOK_Y;
      sharpness = 6;
    } else if (intro) {
      // Old tomondan orqaga aylanish: countdown boshida START_ANGLE, oxirida 0 (mashina orqasida)
      const left = clamp((game.countdownEndsAt - performance.now()) / (ROOM.COUNTDOWN_SECONDS * 1000), 0, 1);
      local.copy(heading).negate().applyAxisAngle(UP, CAMERA.INTRO.START_ANGLE * left * left);
      desired.copy(carTarget.position).addScaledVector(local, CAMERA.INTRO.RADIUS);
      desired.y += CAMERA.INTRO.HEIGHT;
      look.copy(carTarget.position);
      look.y += 0.8;
      sharpness = 8;
    } else if (mode === 'hood') {
      // Mashinaga qattiq bog'langan: lokal ofset to'liq kvaternion bilan
      const [ox, oy, oz] = cfg.offset;
      const [lx, ly, lz] = cfg.look;
      desired.set(ox, oy, oz).applyQuaternion(carTarget.quaternion).add(carTarget.position);
      look.set(lx, ly, lz).applyAxisAngle(UP, yaw);
      look.y += Math.sin(camFx.orbitPitch) * -lz;
      look.applyQuaternion(carTarget.quaternion).add(carTarget.position);
    } else {
      const [ox, oy, oz] = cfg.offset;
      const [, ly, lz] = cfg.look;
      const [back, up] = pitched(oz, oy, camFx.orbitPitch);
      // Offset orqasi manfiy, shuning uchun view bo'yicha qo'shamiz
      desired.copy(carTarget.position).addScaledVector(heading, back);
      desired.x += heading.z * ox;
      desired.z -= heading.x * ox;
      desired.y += up;
      look.copy(carTarget.position).addScaledVector(heading, lz);
      look.y += ly;
    }
    if (snap) {
      basePos.copy(desired);
      smoothLook.copy(look);
      initialized = true;
    }
    const a = damp(sharpness, dt);
    basePos.lerp(desired, a);
    smoothLook.lerp(look, a);

    // Orbit: kapotda yaw look'ga kiritilgan, qolgan rejimlarda kamera mashina atrofida buriladi
    const orbit = mode === 'hood' || intro || showroom ? 0 : yaw;
    view.copy(basePos).sub(carTarget.position).applyAxisAngle(UP, orbit).add(carTarget.position);
    local.copy(smoothLook).sub(carTarget.position).applyAxisAngle(UP, orbit).add(carTarget.position);
    // Kamera yer ostiga kirib ketmasin
    if (mode !== 'hood' || intro || showroom) {
      view.y = Math.max(view.y, activeTrack().terrainHeight(view.x, view.z) + 1.2);
    }

    // ─── Effektlar ───
    const speedRatio = Math.min(Math.abs(carTarget.speed) / CAR.MAX_SPEED, 1.5);
    if (game.boostUntil !== lastBoostUntil) {
      if (game.boostUntil > lastBoostUntil) addTrauma(CAMERA.SHAKE.BOOST);
      lastBoostUntil = game.boostUntil;
    }
    camFx.trauma = Math.max(0, camFx.trauma - CAMERA.SHAKE.DECAY * dt);
    const speedShake = CAMERA.SHAKE.SPEED * clamp((speedRatio - 0.8) / 0.7, 0, 1);
    const s = Math.max(camFx.trauma, speedShake) ** 2;
    const ft = time * CAMERA.SHAKE.FREQUENCY;
    shake.set(wobble(ft, 1), wobble(ft, 2), wobble(ft, 3)).multiplyScalar(s * CAMERA.SHAKE.MAX_OFFSET);
    // Kapotda silkinish kamroq (kamera mashinaga yaqin — kuchli sezildi)
    if (mode === 'hood') shake.multiplyScalar(0.3);

    camera.position.copy(view).add(shake);
    camera.lookAt(local);

    // Burilishda og'ish: yaw burchak tezligi × tezlik ulushi
    const carYaw = Math.atan2(carForward.x, carForward.z);
    const yawRate = snap || dt === 0 ? 0 : wrap(carYaw - prevYaw) / dt;
    prevYaw = carYaw;
    const targetRoll = intro || showroom ? 0 : clamp(yawRate * CAMERA.ROLL.FACTOR * Math.min(speedRatio, 1), -CAMERA.ROLL.MAX, CAMERA.ROLL.MAX);
    roll += (targetRoll - roll) * damp(CAMERA.ROLL.SHARPNESS, dt);
    camera.rotateZ(roll + wobble(ft, 4) * s * CAMERA.SHAKE.MAX_ROLL);

    // Tezlik hissi: tezlik oshgani sari FOV biroz kengayadi, boost/nitro paytida yana
    const cam = camera as PerspectiveCamera;
    const fov = showroom
      ? CAMERA.FOV + CAMERA.SHOWROOM.FOV
      : CAMERA.FOV + cfg.fov + CAMERA.SPEED_FOV_BOOST * speedRatio + (carTarget.boosting ? CAMERA.BOOST_FOV : 0);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * damp(4, dt);
      cam.updateProjectionMatrix();
    }
  });
  return null;
}
