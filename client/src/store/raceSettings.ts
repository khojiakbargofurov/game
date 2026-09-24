import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  DEFAULT_SEASON,
  DEFAULT_TRACK,
  DEFAULT_WEATHER,
  WEATHER_FX,
  getTrack,
  isSeason,
  isTrackId,
  isWeather,
  seasonPalette,
  type Palette,
  type RaceSettings,
  type Season,
  type Track,
  type TrackId,
  type Weather,
  type WeatherFx,
} from '@game/shared';
import { useNetStore } from './netStore';
import { DIFFICULTIES, type Difficulty } from '../game/bots/botDriver';

const KEY = 'adventure-racer:settings';

/** Yakka rejimdagi botlar: 0..MAX_BOTS */
export const MAX_BOTS = 7;

interface MenuChoice {
  trackId: TrackId;
  season: Season;
  weather: Weather;
  /** Yakka rejim: botlar soni va qiyinligi */
  bots: number;
  difficulty: Difficulty;
}

const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.some((d) => d.id === v);

function load(): MenuChoice {
  const fallback: MenuChoice = {
    trackId: DEFAULT_TRACK,
    season: DEFAULT_SEASON,
    weather: DEFAULT_WEATHER,
    bots: 3,
    difficulty: 'medium',
  };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return {
      trackId: isTrackId(raw.trackId) ? raw.trackId : fallback.trackId,
      season: isSeason(raw.season) ? raw.season : fallback.season,
      weather: isWeather(raw.weather) ? raw.weather : fallback.weather,
      bots:
        typeof raw.bots === 'number' && Number.isInteger(raw.bots) ? Math.min(MAX_BOTS, Math.max(0, raw.bots)) : fallback.bots,
      difficulty: isDifficulty(raw.difficulty) ? raw.difficulty : fallback.difficulty,
    };
  } catch {
    return fallback;
  }
}

/** Menyuda tanlangan trassa, fasl, ob-havo, botlar (brauzerda saqlanadi; onlayn xona yaratishda host shularni yuboradi) */
export const useMenuChoice = create<MenuChoice & { set: (patch: Partial<MenuChoice>) => void }>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    const { trackId, season, weather, bots, difficulty } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ trackId, season, weather, bots, difficulty }));
    } catch {
      // xotira yopiq bo'lsa ham tanlov shu seansda ishlaydi
    }
  },
}));

function pick(online: RaceSettings | null, menu: Pick<MenuChoice, 'trackId' | 'season' | 'weather'>): RaceSettings {
  // Yakka rejimda upgrade'lar doim ishlaydi; onlayn — xona sozlamasi (host tanlaydi)
  return online ?? { trackId: menu.trackId, season: menu.season, weather: menu.weather, upgradesEnabled: true };
}

const onlineSettings = (s: ReturnType<typeof useNetStore.getState>) =>
  s.mode === 'online' && s.room ? s.room.settings : null;

/** Joriy poyga sharoiti: onlayn — xonadan, yakka — menyudan */
export function activeSettings(): RaceSettings {
  return pick(onlineSettings(useNetStore.getState()), useMenuChoice.getState());
}

export function useActiveSettings(): RaceSettings {
  const online = useNetStore(useShallow((s) => onlineSettings(s) ?? NONE));
  const menu = useMenuChoice(useShallow((s) => ({ trackId: s.trackId, season: s.season, weather: s.weather })));
  return pick(online === NONE ? null : online, menu);
}
const NONE = {} as RaceSettings;

/** Joriy trassa (keshlangan — har kadrda chaqirish arzon) */
export const activeTrack = (): Track => getTrack(activeSettings().trackId);

export function useTrack(): Track {
  return getTrack(useActiveSettings().trackId);
}

/** Joriy fasl ranglari */
export function usePalette(): Palette {
  return seasonPalette(useActiveSettings().season);
}

/** Joriy ob-havo effektlari (tuman, yorug'lik, zarrachalar, yo'l tutishi) */
export function useWeatherFx(): WeatherFx {
  return WEATHER_FX[useActiveSettings().weather];
}
