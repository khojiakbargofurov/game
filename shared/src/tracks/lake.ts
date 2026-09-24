import type { TrackDef } from './types';

/** Ko'l bo'yi: daryo ustidan ko'prik → ko'lni aylanib o'tuvchi o'rmon yo'li → qirg'oqdagi xarobalar (~1400 m) */
export const LAKE: TrackDef = {
  id: 'lake',
  name: "Ko'l bo'yi",
  description: "Ko'prik → ko'l atrofi → xarobalar",
  seed: 577,
  control: [
    [-330, 3, -420],
    [-310, 3, -380],
    [-260, 4, -300],
    [-190, 4, -210],
    [-140, 3, -120],
    // Ko'l atrofida (markaz 40, -40)
    [-135, 4, -40],
    [-112, 3, 47],
    [-47, 4, 112],
    [40, 3, 135],
    [128, 4, 112],
    [192, 3, 47],
    [215, 4, -40],
    [192, 3, -127],
    // Xarobalar
    [240, 4, -210],
    [300, 5, -270],
    [345, 6, -340],
    [360, 6, -420],
  ],
  zones: [
    { type: 'forest', end: 900 },
    { type: 'ruins', end: Infinity },
  ],
  checkpoints: [140, 280, 420, 560, 700, 840, 980, 1120, 1260],
  boosts: [200, 360, 520, 760, 1000, 1220],
  ramps: [
    { s: 120, lateral: 0, width: 6, length: 8, height: 1.6 },
    { s: 640, lateral: 0, width: 6, length: 8, height: 1.8 },
    { s: 1090, lateral: 0, width: 6, length: 8, height: 1.8 },
  ],
  logs: [
    { s: 170, side: 1, length: 9 },
    { s: 440, side: -1, length: 9 },
    { s: 580, side: 1, length: 8 },
    { s: 760, side: -1, length: 9 },
  ],
  fallenPillars: [
    { s: 1040, side: 1, length: 7 },
    { s: 1250, side: -1, length: 7 },
  ],
  arches: [950, 1150, 1330],
  boulderSpawners: [],
  bridge: { start: 250, end: 300, halfWidth: 4, gorgeDepth: 14 },
  tunnel: null,
  narrow: { start: 1185, end: 1209, halfWidth: 3.5 },
  lake: { x: 40, z: -40, radius: 145, y: 1, depth: 4 },
};
