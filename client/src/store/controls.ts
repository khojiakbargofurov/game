import { create } from 'zustand';

/**
 * Sensorli ekran boshqaruvi sozlamalari (localStorage'da saqlanadi).
 *  - buttons: chapda ◀ ▶ rul tugmalari
 *  - tilt: telefonni rul kabi egish (DeviceOrientation)
 */
export type ControlScheme = 'buttons' | 'tilt';

export interface ControlSettings {
  scheme: ControlScheme;
  /** Tilt sezgirligi 0.5..2 (1 = ~24° egilishda to'liq rul) */
  tiltSensitivity: number;
  /** Gaz doim bosilgan — faqat tormoz tugmasi bilan to'xtatiladi */
  autoAccel: boolean;
  /** Tugma bosilganda / nitroda qisqa vibratsiya */
  haptics: boolean;
  /** Tugmalar o'lchami 0.8..1.3 */
  buttonScale: number;
  /** Chap qo'l: rul o'ngda, gaz/tormoz chapda */
  leftHanded: boolean;
}

const KEY = 'racer:controls';

const DEFAULTS: ControlSettings = {
  scheme: 'buttons',
  tiltSensitivity: 1,
  autoAccel: false,
  haptics: true,
  buttonScale: 1,
  leftHanded: false,
};

function load(): ControlSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ControlSettings>) };
  } catch {
    // e'tiborsiz
  }
  return DEFAULTS;
}

interface ControlsState extends ControlSettings {
  set: (patch: Partial<ControlSettings>) => void;
}

export const useControls = create<ControlsState>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    const { set: _, ...settings } = { ...get() };
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // e'tiborsiz
    }
  },
}));
