import {
  DEFAULT_CAR,
  ROOM,
  isCarId,
  isSeason,
  isTrackId,
  isWeather,
  type CarId,
  type NetState,
  type RaceSettings,
  type Quat,
  type Vec3,
} from '@game/shared';

/** Klientdan kelgan ma'lumotlarga ishonmaymiz — har bir payload tekshiriladi */

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const LIMIT = 10_000;

function isVec(v: unknown, len: number): boolean {
  return Array.isArray(v) && v.length === len && v.every((n) => isFiniteNumber(n) && Math.abs(n) < LIMIT);
}

export function parseNetState(raw: unknown): NetState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (!isVec(s.position, 3) || !isVec(s.rotation, 4) || !isVec(s.velocity, 3)) return null;
  return {
    position: s.position as Vec3,
    rotation: s.rotation as Quat,
    velocity: s.velocity as Vec3,
    respawn: s.respawn === true,
  };
}

/** Ismni tozalash: bo'sh joylarni qisqartirish, boshqaruv belgilarini olib tashlash, uzunlikni cheklash */
export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ROOM.NAME_MAX_LENGTH);
  return name.length > 0 ? name : null;
}

export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return code.length === ROOM.CODE_LENGTH ? code : null;
}

/** Noma'lum yoki yo'q mashina — standart mashina (eski klientlar ham ishlayveradi) */
export function parseCar(raw: unknown): CarId {
  return isCarId(raw) ? raw : DEFAULT_CAR;
}

/** Faqat to'g'ri maydonlar `base` ustidan yoziladi — noma'lum qiymatlar e'tiborsiz qoldiriladi */
export function parseSettings(raw: unknown, base: RaceSettings): RaceSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    trackId: isTrackId(src.trackId) ? src.trackId : base.trackId,
    season: isSeason(src.season) ? src.season : base.season,
    weather: isWeather(src.weather) ? src.weather : base.weather,
    upgradesEnabled: typeof src.upgradesEnabled === 'boolean' ? src.upgradesEnabled : base.upgradesEnabled,
  };
}
