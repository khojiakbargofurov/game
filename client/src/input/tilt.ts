import { input } from './keyboard';
import { useControls } from '../store/controls';

/**
 * Tilt rul: telefon landshaftda rul kabi egiladi → `input.steerAxis` (-1..1, musbat = chapga).
 * Landshaftda "rul" burilishi qurilmaning `beta` burchagida ko'rinadi; ekran qaysi tomonga
 * aylanganiga qarab ishorasi almashadi. Kalibrlash — joriy holatni nol deb olish.
 */

/** Sezgirlik 1 bo'lganda shuncha gradus egilish = to'liq rul */
const FULL_LOCK_DEG = 24;
const DEAD_ZONE_DEG = 1.5;

let offset = 0;
let lastRaw = 0;
let attached = false;

/** Qurilma vertikalga yaqinlashganda beta 180° ga sakraydi — [-90, 90] ga qaytariladi */
function normBeta(b: number) {
  if (b > 90) return 180 - b;
  if (b < -90) return -180 - b;
  return b;
}

function rawSteerDeg(e: DeviceOrientationEvent): number {
  const beta = normBeta(e.beta ?? 0);
  const angle = screen.orientation?.angle ?? (window.orientation as number | undefined) ?? 90;
  // angle 90: qurilma tepasi chapda — o'ngga burish = beta ortadi; 270/-90 da teskari
  return angle === 90 ? -beta : beta;
}

function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta === null) return;
  lastRaw = rawSteerDeg(e);
  const deg = lastRaw - offset;
  const mag = Math.max(0, Math.abs(deg) - DEAD_ZONE_DEG);
  const full = FULL_LOCK_DEG / useControls.getState().tiltSensitivity;
  input.steerAxis = Math.sign(deg) * Math.min(1, mag / full);
}

/** Joriy egilishni "to'g'ri" holat deb olish */
export function calibrateTilt() {
  offset = lastRaw;
}

type PermissionRequester = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * iOS 13+ ruxsat so'raydi — faqat foydalanuvchi harakati (tugma bosish) ichida chaqirilishi kerak.
 * Ruxsat berilmasa false qaytaradi.
 */
export async function requestTiltPermission(): Promise<boolean> {
  const req = (DeviceOrientationEvent as unknown as PermissionRequester).requestPermission;
  if (!req) return typeof DeviceOrientationEvent !== 'undefined';
  try {
    return (await req()) === 'granted';
  } catch {
    return false;
  }
}

function attach() {
  if (attached) return;
  attached = true;
  window.addEventListener('deviceorientation', onOrientation);
}

function detach() {
  if (!attached) return;
  attached = false;
  window.removeEventListener('deviceorientation', onOrientation);
  input.steerAxis = undefined;
}

// Sxema almashganda tinglovchini ulash/uzish
const sync = () => (useControls.getState().scheme === 'tilt' ? attach() : detach());
useControls.subscribe(sync);
sync();
