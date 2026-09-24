import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA, CAR } from '@game/shared';
import { activeTrack } from '../store/raceSettings';
import { carTarget } from './carTarget';

const [, OFFSET_UP, OFFSET_BACK] = CAMERA.OFFSET;
const [, LOOK_UP, LOOK_AHEAD] = CAMERA.LOOK_AHEAD;

const heading = new Vector3(0, 0, 1);
const carForward = new Vector3();
const desired = new Vector3();
const look = new Vector3();
const smoothLook = new Vector3();
let initialized = false;

/** Framerate'ga bog'liq bo'lmagan lerp koeffitsiyenti: 1 - e^(-k·dt) */
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

/**
 * Mashina orqasidan kuzatuvchi kamera.
 * Faqat mashinaning gorizontal yo'nalishiga (heading) ergashadi — mashina sakrasa yoki
 * ag'darilsa kamera aylanib ketmaydi.
 */
export function ChaseCamera() {
  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);

    // Mashina oldi yo'nalishini XZ tekisligiga proyeksiya qilamiz
    // Birinchi kadr yoki respawn (katta sakrash) — kamera darhol joyiga qo'yiladi
    const snap = !initialized || camera.position.distanceToSquared(carTarget.position) > 60 * 60;
    carForward.set(0, 0, 1).applyQuaternion(carTarget.quaternion).setY(0);
    if (carForward.lengthSq() > 1e-4) {
      carForward.normalize();
      if (snap) heading.copy(carForward);
      else heading.lerp(carForward, damp(CAMERA.HEADING_SHARPNESS, dt)).normalize();
    }

    // OFFSET_BACK manfiy (orqada), shuning uchun heading bo'yicha qo'shamiz
    desired.copy(carTarget.position).addScaledVector(heading, OFFSET_BACK);
    desired.y += OFFSET_UP;
    // Kamera yer ostiga kirib ketmasin
    desired.y = Math.max(desired.y, activeTrack().terrainHeight(desired.x, desired.z) + 1.2);

    look.copy(carTarget.position).addScaledVector(heading, LOOK_AHEAD);
    look.y += LOOK_UP;

    if (snap) {
      camera.position.copy(desired);
      smoothLook.copy(look);
      initialized = true;
    }
    const a = damp(CAMERA.FOLLOW_SHARPNESS, dt);
    camera.position.lerp(desired, a);
    smoothLook.lerp(look, a);
    camera.lookAt(smoothLook);

    // Tezlik hissi: tezlik oshgani sari FOV biroz kengayadi
    const cam = camera as PerspectiveCamera;
    const speedRatio = Math.min(Math.abs(carTarget.speed) / CAR.MAX_SPEED, 1.5);
    const fov = CAMERA.FOV + CAMERA.SPEED_FOV_BOOST * speedRatio;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * a;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}
