import type { TrackDef } from './types';

/**
 * Gran Pri: F1 uslubidagi yopiq halqa (~1700 m, 3 aylana) — keng asfalt, kerblar, tribunalar.
 * Uzun start to'g'ri yo'li → 1-burilish (shpilka) → "S" burilishlar → sharqiy shpilka → orqa to'g'ri → shikana.
 */
export const CIRCUIT: TrackDef = {
  id: 'circuit',
  name: 'Gran Pri',
  description: 'F1 halqasi · 3 aylana',
  seed: 911,
  laps: 3,
  startLine: 60,
  control: [
    // Start to'g'ri yo'li (janubdan shimolga)
    [-238, 2, -110],
    [-238, 2, 0],
    [-238, 2, 110],
    [-236, 2, 160],
    // 1-burilish (shpilka)
    [-216, 2, 202],
    [-169, 2, 209],
    [-148, 2, 166],
    [-155, 2, 108],
    // "S" burilishlar
    [-122, 2, 65],
    [-72, 2, 79],
    [-29, 2, 122],
    [29, 2, 115],
    [65, 2, 65],
    [108, 2, 29],
    [173, 2, 43],
    // Sharqiy shpilka
    [238, 2, 29],
    [259, 2, -29],
    [230, 2, -79],
    // Orqa to'g'ri yo'l va shikana
    [158, 2, -101],
    [86, 2, -108],
    [29, 2, -133],
    [-29, 2, -144],
    [-108, 2, -216],
    [-194, 2, -236],
    [-234, 2, -200],
  ],
  zones: [{ type: 'circuit', end: Infinity }],
  checkpoints: [250, 440, 630, 820, 1010, 1200, 1390, 1580],
  boosts: [170, 700, 1250],
  ramps: [],
  logs: [],
  fallenPillars: [],
  arches: [],
  boulderSpawners: [],
  // Start to'g'ri yo'lining tashqi tomonida (yo'nalishga nisbatan o'ngda)
  grandstands: [
    { s: 10, side: -1, length: 160 },
    { s: 1560, side: -1, length: 90 },
  ],
  bridge: null,
  tunnel: null,
  narrow: null,
  lake: null,
};
