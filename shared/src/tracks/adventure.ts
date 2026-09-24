import type { TrackDef } from './types';

/** Asl trassa: o'rmon → ko'prik → kanyon (tunnel) → qadimiy xarobalar → marra (~1300 m) */
export const ADVENTURE: TrackDef = {
  id: 'adventure',
  name: 'Sarguzasht',
  description: "O'rmon → kanyon → xarobalar",
  seed: 0,
  control: [
    // O'rmon
    [0, 2, -440],
    [0, 2, -400],
    [8, 3, -350],
    [40, 8, -300],
    [95, 12, -265],
    [140, 7, -215],
    [150, 3, -160],
    [120, 3, -110],
    [70, 5, -75],
    // Kanyon
    [10, 3, -40],
    [-50, 1, 0],
    [-110, -1, 45],
    [-160, -2, 105],
    [-175, 0, 170],
    [-150, 3, 230],
    [-100, 6, 265],
    // Xarobalar
    [-40, 9, 285],
    [25, 11, 300],
    [85, 11, 330],
    [130, 11, 375],
    [150, 11, 425],
    [155, 11, 460],
  ],
  zones: [
    { type: 'forest', end: 480 },
    { type: 'canyon', end: 880 },
    { type: 'ruins', end: Infinity },
  ],
  checkpoints: [150, 300, 440, 560, 670, 800, 940, 1060, 1180],
  boosts: [200, 380, 598, 850, 983, 1105],
  ramps: [
    { s: 110, lateral: 0, width: 6, length: 8, height: 1.6 },
    { s: 612, lateral: 0, width: 6, length: 9, height: 2.2 },
    { s: 995, lateral: 0, width: 6, length: 8, height: 1.8 },
  ],
  logs: [
    { s: 185, side: 1, length: 9 },
    { s: 255, side: -1, length: 9 },
    { s: 330, side: 1, length: 8 },
    { s: 400, side: -1, length: 9 },
  ],
  fallenPillars: [
    { s: 1040, side: 1, length: 7 },
    { s: 1165, side: -1, length: 7 },
  ],
  arches: [925, 1075, 1200],
  boulderSpawners: [
    { s: 570, side: 1 },
    { s: 780, side: -1 },
    { s: 835, side: 1 },
  ],
  bridge: { start: 450, end: 505, halfWidth: 4, gorgeDepth: 16 },
  tunnel: { start: 685, end: 750, height: 6.5 },
  narrow: { start: 1118, end: 1142, halfWidth: 3.5 },
  lake: null,
};
