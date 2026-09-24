import { create } from 'zustand';
import {
  MAX_UPGRADE_LEVEL,
  NO_TUNE,
  NO_UPGRADES,
  UPGRADE_COSTS,
  WEATHER_FX,
  carStats,
  sanitizeTune,
  sanitizeUpgrades,
  type CarStats,
  type TuneId,
  type TuneSetup,
  type UpgradeId,
  type UpgradeLevels,
} from '@game/shared';
import { useNetStore } from './netStore';
import { activeSettings } from './raceSettings';

const KEY = 'adventure-racer:garage';

interface Saved {
  wallet: number;
  levels: UpgradeLevels;
  tune: TuneSetup;
}

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    const wallet = typeof raw.wallet === 'number' && Number.isFinite(raw.wallet) ? Math.max(0, Math.floor(raw.wallet)) : 0;
    return { wallet, levels: sanitizeUpgrades(raw.levels), tune: sanitizeTune(raw.tune) };
  } catch {
    return { wallet: 0, levels: { ...NO_UPGRADES }, tune: { ...NO_TUNE } };
  }
}

function save({ wallet, levels, tune }: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ wallet, levels, tune }));
  } catch {
    // xotira yopiq bo'lsa ham shu seansda ishlaydi
  }
}

/** Keyingi darajaga o'tish narxi (maksimal darajada — null) */
export const nextCost = (level: number): number | null => (level < MAX_UPGRADE_LEVEL ? UPGRADE_COSTS[level] : null);

interface GarageState extends Saved {
  /** Poyga tugagach yig'ilgan tangalarni hamyonga qo'shish */
  deposit: (coins: number) => void;
  /** Upgrade sotib olish; tanga yetmasa yoki maksimal darajada — false */
  buy: (id: UpgradeId) => boolean;
  /** Sozlash slayderi (bepul) */
  setTune: (id: TuneId, value: number) => void;
}

/** Garaj: tanga hamyoni va upgrade darajalari (brauzerda saqlanadi) */
export const useGarage = create<GarageState>((set, get) => ({
  ...load(),
  deposit: (coins) => {
    if (coins <= 0) return;
    set((s) => ({ wallet: s.wallet + coins }));
    save(get());
  },
  buy: (id) => {
    const { wallet, levels } = get();
    const cost = nextCost(levels[id]);
    if (cost === null || wallet < cost) return false;
    set({ wallet: wallet - cost, levels: { ...levels, [id]: levels[id] + 1 } });
    save(get());
    return true;
  },
  setTune: (id, value) => {
    set((s) => ({ tune: sanitizeTune({ ...s.tune, [id]: value }) }));
    save(get());
  },
}));

/**
 * Poygada amal qiladigan darajalar va sozlash: onlayn — server tasdiqlagani (host o'chirgan bo'lsa 0),
 * yakka — garajdagi
 */
export function ownUpgrades(): { levels: UpgradeLevels; tune: TuneSetup } {
  const { mode, room, selfId } = useNetStore.getState();
  if (mode === 'online') {
    const me = room?.players.find((p) => p.id === selfId);
    return { levels: me?.upgrades ?? NO_UPGRADES, tune: me?.tune ?? NO_TUNE };
  }
  const { levels, tune } = useGarage.getState();
  return { levels, tune };
}

/** O'z mashinamizning fizik parametrlari: upgrade'lar + ob-havo tutishi + sozlash */
export function ownCarStats(): CarStats {
  const { levels, tune } = ownUpgrades();
  return carStats(levels, WEATHER_FX[activeSettings().weather].grip, tune);
}
