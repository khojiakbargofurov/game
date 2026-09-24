import { create } from 'zustand';
import {
  MAX_UPGRADE_LEVEL,
  NO_LOOK,
  cosmeticKey,
  findCosmetic,
  sanitizeLook,
  type CarLook,
  type CosmeticCategory,
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
  /** Sotib olingan vizual buyumlar: "kategoriya:id" */
  owned: string[];
  look: CarLook;
}

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    const wallet = typeof raw.wallet === 'number' && Number.isFinite(raw.wallet) ? Math.max(0, Math.floor(raw.wallet)) : 0;
    const owned = Array.isArray(raw.owned) ? raw.owned.filter((k): k is string => typeof k === 'string') : [];
    // Faqat sotib olingan buyumlar kiyilgan bo'lishi mumkin
    const look = sanitizeLook(raw.look);
    for (const cat of Object.keys(look) as CosmeticCategory[]) {
      const id = look[cat];
      if (id && !owned.includes(cosmeticKey(cat, id))) look[cat] = null;
    }
    return { wallet, levels: sanitizeUpgrades(raw.levels), tune: sanitizeTune(raw.tune), owned, look };
  } catch {
    return { wallet: 0, levels: { ...NO_UPGRADES }, tune: { ...NO_TUNE }, owned: [], look: { ...NO_LOOK } };
  }
}

function save({ wallet, levels, tune, owned, look }: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ wallet, levels, tune, owned, look }));
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
  /** Vizual buyum: sotib olinmagan bo'lsa sotib oladi (tanga yetmasa — false), keyin kiyadi */
  buyOrEquip: (cat: CosmeticCategory, id: string) => boolean;
  /** Kategoriyani zavod holatiga qaytarish */
  unequip: (cat: CosmeticCategory) => void;
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
  buyOrEquip: (cat, id) => {
    const item = findCosmetic(cat, id);
    if (!item) return false;
    const { wallet, owned, look } = get();
    const key = cosmeticKey(cat, id);
    if (!owned.includes(key)) {
      if (wallet < item.cost) return false;
      set({ wallet: wallet - item.cost, owned: [...owned, key] });
    }
    set({ look: { ...look, [cat]: id } });
    save(get());
    return true;
  },
  unequip: (cat) => {
    set((s) => ({ look: { ...s.look, [cat]: null } }));
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
