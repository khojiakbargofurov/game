import { create } from 'zustand';
import type { RaceResult, RoomInfo } from '@game/shared';
import { useGameStore } from './gameStore';

/** Qaysi ekran ko'rsatilmoqda: bosh menyu, xona (kutish), poyga */
export type Screen = 'menu' | 'room' | 'race';
export type Mode = 'solo' | 'online';

interface NetState {
  screen: Screen;
  mode: Mode;
  connected: boolean;
  room: RoomInfo | null;
  selfId: string | null;
  error: string | null;
  busy: boolean;
  /** Server hisoblagan joriy o'rinlar (o'yinchi id'lari) */
  standings: string[];
  /** Poyga tugagach server yuborgan natijalar */
  results: RaceResult[] | null;
  /** Birinchi o'yinchi marraga yetgach — poyga majburan tugaydigan vaqt (performance.now() shkalasida) */
  finishDeadline: number | null;
}

export const useNetStore = create<NetState>(() => ({
  screen: 'menu',
  mode: 'solo',
  connected: false,
  room: null,
  selfId: null,
  error: null,
  busy: false,
  standings: [],
  results: null,
  finishDeadline: null,
}));

/**
 * Mashina boshqaruvi faqat poyga ekranida va countdown tugagach ishlaydi
 * (menyuda yoki 3-2-1 paytida tugmalar mashinani yurgizmaydi).
 */
export const controlsEnabled = () => {
  const phase = useGameStore.getState().phase;
  return useNetStore.getState().screen === 'race' && (phase === 'racing' || phase === 'finished');
};

/** O'zimizning joriy o'rnimiz (1 dan), noma'lum bo'lsa 0 */
export function usePlace(): number {
  return useNetStore((s) => (s.selfId ? s.standings.indexOf(s.selfId) + 1 : 0));
}
