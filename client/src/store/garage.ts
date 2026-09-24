import { create } from 'zustand';
import {
  MAX_UPGRADE_LEVEL,
  NO_UPGRADES,
  UPGRADE_COSTS,
  WEATHER_FX,
  carStats,
  sanitizeUpgrades,
  type CarStats,
  type UpgradeId,
  type UpgradeLevels,
} from '@game/shared';
import { useNetStore } from './netStore';
import { activeSettings } from './raceSettings';

const KEY = 'adventure-racer:garage';

interface Saved {
  wallet: number;
  levels: UpgradeLevels;
}

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    const wallet = typeof raw.wallet === 'number' && Number.isFinite(raw.wallet) ? Math.max(0, Math.floor(raw.wallet)) : 0;
    return { wallet, levels: sanitizeUpgrades(raw.levels) };
  } catch {
    return { wallet: 0, levels: { ...NO_UPGRADES } };
  }
}

function save({ wallet, levels }: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ wallet, levels }));
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
}));

/** Poygada amal qiladigan darajalar: onlayn — server tasdiqlagani (host o'chirgan bo'lsa 0), yakka — garajdagi */
export function ownUpgrades(): UpgradeLevels {
  const { mode, room, selfId } = useNetStore.getState();
  if (mode === 'online') return room?.players.find((p) => p.id === selfId)?.upgrades ?? NO_UPGRADES;
  return useGarage.getState().levels;
}

/** O'z mashinamizning fizik parametrlari: upgrade'lar + ob-havo tutishi */
export function ownCarStats(): CarStats {
  return carStats(ownUpgrades(), WEATHER_FX[activeSettings().weather].grip);
}
