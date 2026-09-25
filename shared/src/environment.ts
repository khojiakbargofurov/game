import { COLORS } from './config';

/**
 * Fasl (ranglar palitrasi) va ob-havo (tuman, yorug'lik, zarrachalar, yo'l ishqalanishi).
 * Menyuda tanlanadi; onlayn xonada — host tanlaydi, hamma bir xil sharoitda o'ynaydi.
 */

export const SEASONS = [
  { id: 'summer', label: 'Yoz' },
  { id: 'autumn', label: 'Kuz' },
  { id: 'winter', label: 'Qish' },
  { id: 'spring', label: 'Bahor' },
] as const;
export type Season = (typeof SEASONS)[number]['id'];
export const DEFAULT_SEASON: Season = 'summer';
export const isSeason = (v: unknown): v is Season => SEASONS.some((s) => s.id === v);

export const WEATHERS = [
  { id: 'clear', label: 'Ochiq' },
  { id: 'rain', label: "Yomg'ir" },
  { id: 'snow', label: 'Qor' },
] as const;
export type Weather = (typeof WEATHERS)[number]['id'];
export const DEFAULT_WEATHER: Weather = 'clear';
export const isWeather = (v: unknown): v is Weather => WEATHERS.some((w) => w.id === v);

type ColorKey = keyof typeof COLORS;
export type Palette = Record<ColorKey, string> & {
  /** Qarag'ay barglari ranglari (instanceColor) */
  pineLeaves: string[];
  /** Bargli daraxt tojlari ranglari */
  broadleaf: string[];
};

const SUMMER: Palette = {
  ...COLORS,
  pineLeaves: [COLORS.leaves, COLORS.leavesLight, '#3f6d33'],
  broadleaf: ['#7a9a3c', '#9aa447', '#c49a45', '#6f8f3a'],
};

const OVERRIDES: Record<Season, Partial<Palette>> = {
  summer: {},
  autumn: {
    sky: '#f0b98a',
    fog: '#e9b489',
    grass: '#b39a4f',
    grassDark: '#8f7a3c',
    ruinsGrass: '#b0924f',
    leaves: '#5d6b34',
    leavesLight: '#7c7a3a',
    pineLeaves: ['#4d6b33', '#5f7236', '#44602f'],
    broadleaf: ['#d9822b', '#c4512a', '#e0a431', '#b8452a'],
  },
  winter: {
    sky: '#dfe7ef',
    fog: '#dde5ee',
    sun: '#f4f8ff',
    hemiSky: '#e8f0fa',
    hemiGround: '#8a8f99',
    grass: '#eef3f7',
    grassDark: '#dde6ee',
    dirt: '#c9ced4',
    ruinsGround: '#e3e7ec',
    ruinsGrass: '#e8edf2',
    canyonTop: '#eef2f6',
    // Qorli qoyalar: kulrang-ko'kish qatlamlar orasida oq qor
    canyonA: '#aeb4bd',
    canyonB: '#8f96a1',
    canyonC: '#dfe5ec',
    rock: '#9aa1ab',
    riverbed: '#b8c3cc',
    roadForest: '#9a8a7a',
    roadCanyon: '#a8927e',
    roadRuins: '#b3aa9c',
    roadEdge: '#e6ecf1',
    alpineGrass: '#e6ecf1',
    cityGround: '#5c6069',
    // Qishki asfalt: tuz va qor changidan oqarib ketgan
    asphaltForest: '#6c7178',
    asphaltCanyon: '#74716d',
    asphaltRuins: '#7a7874',
    asphaltAlpine: '#6d7279',
    asphaltCity: '#474a51',
    water: '#8fb7c9',
    leaves: '#e9f0f5',
    leavesLight: '#ffffff',
    pineLeaves: ['#e9f0f5', '#ffffff', '#cfdae3'],
    broadleaf: ['#8a7563', '#7a6656', '#9a8573', '#6e5c4d'],
  },
  spring: {
    sky: '#f6d7c4',
    fog: '#f3d3bf',
    grass: '#9cc45e',
    grassDark: '#7fae47',
    ruinsGrass: '#b6c166',
    leaves: '#5c9a42',
    leavesLight: '#86bb52',
    pineLeaves: ['#5c9a42', '#86bb52', '#4b8a3a'],
    broadleaf: ['#f2a7c3', '#f7c4d6', '#e98fb2', '#9ccf6a'],
  },
};

const palettes = new Map<Season, Palette>();

/** Fasl palitrasi (COLORS asosida, faslga xos ranglar ustidan yoziladi) */
export function seasonPalette(season: Season): Palette {
  let p = palettes.get(season);
  if (!p) palettes.set(season, (p = { ...SUMMER, ...OVERRIDES[season] }));
  return p;
}

export interface WeatherFx {
  /** Yo'l tutishi (g'ildirak ishqalanishiga ko'paytiriladi) */
  grip: number;
  /** Tuman uzoqligi ko'paytiruvchisi (kichik = qalinroq tuman) */
  fogScale: number;
  /** Quyosh yorug'ligi ko'paytiruvchisi */
  sunScale: number;
  /** Osmon/tuman shu rangga `tintAmount` ulushda aralashtiriladi */
  tint: string | null;
  tintAmount: number;
  particles: 'none' | 'rain' | 'snow';
}

export const WEATHER_FX: Record<Weather, WeatherFx> = {
  clear: { grip: 1, fogScale: 1, sunScale: 1, tint: null, tintAmount: 0, particles: 'none' },
  rain: { grip: 0.72, fogScale: 0.6, sunScale: 0.5, tint: '#8e98a4', tintAmount: 0.6, particles: 'rain' },
  snow: { grip: 0.5, fogScale: 0.55, sunScale: 0.75, tint: '#e3e9f0', tintAmount: 0.55, particles: 'snow' },
};
