import { create } from 'zustand';

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
  // Oddiy evristika: kam yadroli yoki mobil qurilma — o'rta sifatdan boshlash
  const cores = navigator.hardwareConcurrency ?? 4;
  return cores <= 4 || /Mobi|Android/i.test(navigator.userAgent) ? 'medium' : 'high';
}

interface QualityState {
  quality: Quality;
  setQuality: (q: Quality) => void;
}

export const useQuality = create<QualityState>((set) => ({
  quality: initialQuality(),
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
