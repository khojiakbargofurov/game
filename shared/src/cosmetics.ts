/**
 * Vizual tuning: bo'yoq va neon. Tangalar evaziga sotib olinadi (garaj, localStorage), fizikaga ta'sir qilmaydi.
 * Onlayn'da boshqa o'yinchilarga ham ko'rinadi (server faqat id'larni tekshiradi).
 * Disk rangi va spoyler olib tashlangan (teksturali mashinalarda disk alohida qism emas; spoyler har mashinada
 * bir xil chiqardi) — sotib olinganlari uchun tangalar qaytariladi (client/src/store/garage.ts).
 */

export interface CosmeticItem {
  id: string;
  label: string;
  /** Asosiy rang (bo'yoq, neon) */
  color: string;
  cost: number;
  /** Metall bo'yoq (oltin, xrom) */
  metallic?: boolean;
}

export const COSMETICS = {
  paint: [
    { id: 'black', label: 'Qora mat', color: '#2a2a2e', cost: 30 },
    { id: 'blue', label: "Ko'k", color: '#2b6fe0', cost: 30 },
    { id: 'lime', label: 'Laym', color: '#9bd13a', cost: 40 },
    { id: 'purple', label: 'Binafsha', color: '#8a4fe0', cost: 40 },
    { id: 'pink', label: 'Pushti', color: '#e04f9b', cost: 40 },
    { id: 'gold', label: 'Oltin', color: '#e8b923', cost: 90, metallic: true },
    { id: 'chrome', label: 'Xrom', color: '#d8dde3', cost: 120, metallic: true },
  ],
  neon: [
    { id: 'cyan', label: 'Moviy', color: '#2bf0ff', cost: 60 },
    { id: 'pink', label: 'Pushti', color: '#ff3fb4', cost: 60 },
    { id: 'green', label: 'Yashil', color: '#4dff6a', cost: 60 },
    { id: 'orange', label: "To'q sariq", color: '#ff8a2b', cost: 60 },
    { id: 'purple', label: 'Binafsha', color: '#a45bff', cost: 60 },
  ],
} as const satisfies Record<string, readonly CosmeticItem[]>;

export type CosmeticCategory = keyof typeof COSMETICS;
export const COSMETIC_CATEGORIES = Object.keys(COSMETICS) as CosmeticCategory[];

/** Har kategoriya bo'yicha tanlangan buyum id'si; null — zavod holati (neon — yo'q) */
export type CarLook = Record<CosmeticCategory, string | null>;
export const NO_LOOK: CarLook = { paint: null, neon: null };

export const cosmeticKey = (cat: CosmeticCategory, id: string) => `${cat}:${id}`;

export function findCosmetic(cat: CosmeticCategory, id: string | null): CosmeticItem | undefined {
  return id === null ? undefined : (COSMETICS[cat] as readonly CosmeticItem[]).find((c) => c.id === id);
}

/** Noma'lum id'lar — null (server ham, localStorage ham shu orqali) */
export function sanitizeLook(raw: unknown): CarLook {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...NO_LOOK };
  for (const cat of COSMETIC_CATEGORIES) {
    const v = src[cat];
    out[cat] = typeof v === 'string' && findCosmetic(cat, v) ? v : null;
  }
  return out;
}
