import { create } from 'zustand';
import { START, type SpawnPoint } from '@game/shared';

/**
 * ready — menyu/xona (mashina turibdi), countdown — 3-2-1 (boshqaruv qulf),
 * racing — poyga, finished — o'yinchi marraga yetdi.
 */
export type RacePhase = 'ready' | 'countdown' | 'racing' | 'finished';

interface GameState {
  phase: RacePhase;
  /** Countdown tugash vaqti (performance.now() bo'yicha) */
  countdownEndsAt: number;
  /** performance.now() bo'yicha poyga boshlangan / tugagan vaqt */
  startedAt: number | null;
  finishedAt: number | null;
  /** Keyingi o'tilishi kerak bo'lgan checkpoint indeksi */
  nextCheckpoint: number;
  coins: number;
  /** Boost tugash vaqti (performance.now()); 0 = boost yo'q */
  boostUntil: number;
  /** Respawn nuqtasi — oxirgi o'tilgan checkpoint */
  respawnPoint: SpawnPoint;

  startCountdown: (endsAt: number) => void;
  startRace: (at?: number) => void;
  passCheckpoint: (index: number, respawn: SpawnPoint) => void;
  finish: (at: number) => void;
  addCoin: () => void;
  startBoost: (until: number) => void;
  reset: () => void;
}

const initial = {
  phase: 'ready' as RacePhase,
  countdownEndsAt: 0,
  startedAt: null,
  finishedAt: null,
  nextCheckpoint: 0,
  coins: 0,
  boostUntil: 0,
  respawnPoint: START,
};

export const useGameStore = create<GameState>((set) => ({
  ...initial,
  startCountdown: (countdownEndsAt) => set({ phase: 'countdown', countdownEndsAt }),
  startRace: (at = performance.now()) => set({ phase: 'racing', startedAt: at }),
  passCheckpoint: (index, respawnPoint) => set({ nextCheckpoint: index + 1, respawnPoint }),
  finish: (finishedAt) => set({ phase: 'finished', finishedAt }),
  addCoin: () => set((s) => ({ coins: s.coins + 1 })),
  startBoost: (boostUntil) => set({ boostUntil }),
  reset: () => set({ ...initial }),
}));
