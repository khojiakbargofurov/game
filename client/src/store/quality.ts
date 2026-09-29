import { create } from 'zustand';
import { isTouch } from './device';

/**
 * Grafika sifati darajalari. Menyuda tanlanadi (localStorage'da saqlanadi) yoki `?quality=low|medium|high`.
 * Fizika va colliderlar hamma darajada bir xil — faqat vizual detallar farq qiladi
 * (multiplayer'da hamma bir xil dunyoda o'ynashi uchun).
 */
export type Quality = 'low' | 'medium' | 'high';

export interface QualityPreset {
  /** Piksel zichligi oralig'i — PerformanceMonitor shu oraliqda moslashtiradi */
  dpr: [number, number];
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** Faqat vizual (collidersiz) manzara ulushi */
  sceneryDensity: number;
  fogFar: number;
  /** Yomg'ir/qor zarrachalari soni */
  weatherParticles: number;
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  low: { dpr: [0.75, 1], antialias: false, shadows: false, shadowMapSize: 512, sceneryDensity: 0.35, fogFar: 190, weatherParticles: 700 },
  medium: { dpr: [1, 1.25], antialias: true, shadows: true, shadowMapSize: 1024, sceneryDensity: 0.7, fogFar: 230, weatherParticles: 1600 },
  high: { dpr: [1, 1.75], antialias: true, shadows: true, shadowMapSize: 2048, sceneryDensity: 1, fogFar: 260, weatherParticles: 2800 },
};

/**
 * Telefon ekrani CSS pikselda kichik (~850×390), lekin DPR 2–3 — desktop oralig'i (1x atrofida) unda juda xira.
 * Sensorli qurilmada piksel zichligi yuqoriroq, lekin qurilmaning o'z DPR'idan oshmaydi.
 */
const TOUCH_DPR: Record<Quality, [number, number]> = { low: [1, 1.25], medium: [1.25, 1.75], high: [1.5, 2.25] };

if (isTouch) {
  const cap = window.devicePixelRatio || 1;
  for (const q of Object.keys(TOUCH_DPR) as Quality[]) {
    const [min, max] = TOUCH_DPR[q];
    QUALITY_PRESETS[q].dpr = [Math.min(min, cap), Math.min(max, cap)];
  }
}

export const QUALITY_LABELS: Record<Quality, string> = { low: 'Past', medium: "O'rta", high: 'Yuqori' };

const KEY = 'racer:quality';
const isQuality = (v: unknown): v is Quality => v === 'low' || v === 'medium' || v === 'high';

function initialQuality(): Quality {
  const fromUrl = new URLSearchParams(location.search).get('quality');
  if (isQuality(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(KEY);
    if (isQuality(saved)) return saved;
  } catch {
    // e'tiborsiz
  }
  // Oddiy evristika: telefon/planshet va kam yadroli kompyuter — o'rta sifatdan boshlash
  // (sekin qurilmada Scene FPS past qolsa o'zi bir daraja pasaytiradi)
  const cores = navigator.hardwareConcurrency ?? 4;
  return cores <= 4 || isTouch ? 'medium' : 'high';
}

interface QualityState {
  quality: Quality;
  /** FPS uzoq vaqt past bo'lgani uchun sifat avtomatik pasaytirilgan vaqt (performance.now()), 0 — hali yo'q */
  autoDowngradedAt: number;
  setQuality: (q: Quality) => void;
  /** Bir daraja pasaytirish (seansda bir marta) — true qaytarsa pasaytirildi */
  autoDowngrade: () => boolean;
}

const LOWER: Record<Quality, Quality | null> = { high: 'medium', medium: 'low', low: null };

export const useQuality = create<QualityState>((set, get) => ({
  quality: initialQuality(),
  autoDowngradedAt: 0,
  autoDowngrade: () => {
    const next = LOWER[get().quality];
    if (!next || get().autoDowngradedAt) return false;
    get().setQuality(next);
    set({ autoDowngradedAt: performance.now() });
    return true;
  },
  setQuality: (quality) => {
    try {
      localStorage.setItem(KEY, quality);
    } catch {
      // e'tiborsiz
    }
    set({ quality });
  },
}));

export const usePreset = () => QUALITY_PRESETS[useQuality((s) => s.quality)];
