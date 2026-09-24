import { create } from 'zustand';
import { CAMERA_MODES, type CameraMode } from '@game/shared';

const KEY = 'adventure-racer:camera';

function load(): CameraMode {
  try {
    const v = localStorage.getItem(KEY);
    return CAMERA_MODES.includes(v as CameraMode) ? (v as CameraMode) : 'chase';
  } catch {
    return 'chase';
  }
}

interface CameraState {
  mode: CameraMode;
  /** Oxirgi rejim almashgan vaqt (performance.now()) — HUD yorlig'i uchun */
  changedAt: number;
  cycle: () => void;
}

/** Kamera rejimi (V tugmasi), brauzerda saqlanadi */
export const useCameraStore = create<CameraState>((set, get) => ({
  mode: load(),
  changedAt: 0,
  cycle: () => {
    const mode = CAMERA_MODES[(CAMERA_MODES.indexOf(get().mode) + 1) % CAMERA_MODES.length];
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // xotira yopiq bo'lsa ham shu seansda ishlaydi
    }
    set({ mode, changedAt: performance.now() });
  },
}));

/**
 * Kamera effektlari holati — har kadrda o'qiladi/yoziladi (React re-render yo'q, `carTarget` kabi).
 *  - trauma: silkinish kuchi 0..1 (urilish, boost qo'shadi; kamera o'zi so'ndiradi)
 *  - orbitYaw/Pitch: sichqoncha bilan aylantirish (radian); dragging=false bo'lsa nolga qaytadi
 */
export const camFx = {
  trauma: 0,
  orbitYaw: 0,
  orbitPitch: 0,
  dragging: false,
};

export function addTrauma(amount: number) {
  camFx.trauma = Math.min(1, camFx.trauma + amount);
}
