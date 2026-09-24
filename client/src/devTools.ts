import { carTarget } from './game/carTarget';
import { perfSnapshot } from './game/PerfStats';
import { useLoadState } from './store/loadState';
import { useQuality, type Quality } from './store/quality';
import { input, requestRespawn } from './input/keyboard';
import { useGameStore } from './store/gameStore';
import { activeTrack } from './store/raceSettings';

/**
 * Faqat dev rejimda: brauzer konsolidan trassani tez ko'rish uchun.
 *   __goto(700)  — mashinani marshrutning 700-metriga ko'chirish
 *   __state()    — mashina holati (pozitsiya, yo'lga nisbatan, tezlik, tugmalar)
 *   __setRespawn(100) — respawn nuqtasini (checkpoint o'tgandagidek) teleportsiz o'zgartirish
 */
declare global {
  interface Window {
    __goto?: (s: number) => void;
    __setRespawn?: (s: number) => void;
    __quality?: (q: Quality) => void;
    __state?: () => string;
    __perf?: () => typeof perfSnapshot & { worldReadyAt: number | null };
  }
}

window.__goto = (s: number) => {
  useGameStore.setState({ respawnPoint: activeTrack().trackPoint(s, 0, 1.2) });
  requestRespawn();
};

window.__state = () => {
  const p = carTarget.position;
  const n = activeTrack().nearestOnRoute(p.x, p.z);
  const keys = Object.entries(input)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(',');
  // up: 1 = tik, 0 = yonboshda, -1 = teskari
  const q = carTarget.quaternion;
  const up = 1 - 2 * (q.x * q.x + q.z * q.z);
  return `s=${n.s.toFixed(1)} y=${p.y.toFixed(2)} road=${n.roadY.toFixed(2)} lat=${n.lateral.toFixed(1)} v=${carTarget.speed.toFixed(1)} up=${up.toFixed(2)} keys=[${keys}]`;
};

window.__perf = () => ({ ...perfSnapshot, worldReadyAt: useLoadState.getState().readyAt });

window.__setRespawn = (s: number) => useGameStore.setState({ respawnPoint: activeTrack().trackPoint(s, 0, 1.2) });
window.__quality = (q: Quality) => useQuality.getState().setQuality(q);
