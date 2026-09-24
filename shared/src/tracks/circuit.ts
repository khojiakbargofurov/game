import { createRng } from '../noise';
import { buildTileLayout, type TileLayoutDef } from './tiles';
import type { PropDef, TrackDef } from './types';

/**
 * Gran Pri: Kenney Racing Kit plitkalaridan yig'ilgan 8-shakl F1 trassasi (Sample.png uslubida), 3 aylana.
 * Uzun start to'g'ri yo'li (pit binolari va tribunalar orasida) → shimoliy halqa (o'ngga burilishlar) → ko'prik
 * start to'g'ri yo'lining ustidan → janubiy halqa (chapga burilishlar) → startga qaytish.
 */

const TILES: TileLayoutDef = {
  size: 22,
  origin: [44, -132],
  forward: [0, 1],
  y: 2,
  steps: [
    ['S', 2],
    ['S', 4, 'start'],
    ['S', 4], // shu yerda (s ≈ 132..154) tepadan ko'prik o'tadi
    ['R', 3],
    ['S', 4],
    ['R', 3],
    ['S', 2],
    ['R', 2],
    ['S', 4],
    ['X', 1], // ko'prik: s ≈ 665..819, oraliq ≈ 731..753
    ['L', 2],
    ['S', 4],
    ['L', 2],
    ['S', 3],
    ['L', 1],
  ],
};

const layout = buildTileLayout(TILES);

/** Plitka chetidan tashqarida (m): plitka yarim kengligi 11 m */
const EDGE = 12.5;
/** Yo'nalishga nisbatan chap (+) va o'ng (−) tomon */
const LEFT = 1;
const RIGHT = -1;

function props(): PropDef[] {
  const p: PropDef[] = [];
  const row = (model: string, from: number, to: number, step: number, lateral: number, extra: Partial<PropDef> = {}) => {
    for (let s = from; s <= to; s += step) p.push({ model, s, lateral, face: 'road', ...extra });
  };

  // ── Start to'g'ri yo'li (0..132): chapda yopiq tribunalar (janubiy halqa ichida), o'ngda pit binolari ──
  row('grandStandCovered', 14, 110, 12, LEFT * 19, { solid: true });
  p.push({ model: 'pitsGarageCorner', s: 8, lateral: RIGHT * 19, face: 'road', solid: true });
  row('pitsGarage', 20, 80, 12, RIGHT * 19, { solid: true });
  p.push({ model: 'pitsOffice', s: 92, lateral: RIGHT * 19, face: 'road', solid: true });
  p.push({ model: 'pitsOfficeRoof', s: 104, lateral: RIGHT * 19, face: 'road', solid: true });
  p.push({ model: 'flagCheckers', s: layout.startS, lateral: RIGHT * EDGE, face: 'road' });
  p.push({ model: 'bannerTowerRed', s: 200, lateral: LEFT * EDGE, face: 'road', solid: true });

  // ── Shimoliy halqa: tashqarisida (chapda) tribunalar va bannerlar ──
  row('grandStand', 236, 292, 13, LEFT * 20, { solid: true });
  p.push({ model: 'billboard', s: 322, lateral: LEFT * 15, face: 'road', solid: true });
  p.push({ model: 'billboardLow', s: 360, lateral: LEFT * 15, face: 'road', solid: true });
  p.push({ model: 'overheadLights', s: 340, lateral: 0, face: 'along', scale: 1.5 });
  row('grandStand', 410, 466, 13, LEFT * 20, { solid: true });
  p.push({ model: 'bannerTowerGreen', s: 500, lateral: LEFT * EDGE, face: 'road', solid: true });

  // ── Janubiy halqa: tashqarisida (o'ngda) tribunalar ──
  row('grandStandCovered', 1016, 1068, 13, RIGHT * 19, { solid: true });
  p.push({ model: 'billboardLower', s: 900, lateral: RIGHT * 15, face: 'road', solid: true });
  p.push({ model: 'overhead', s: 910, lateral: 0, face: 'along', scale: 1.5 });

  // ── Chiroq ustunlari: to'g'ri yo'llar bo'ylab ikki tomonda (ko'prik yaqinidagilari avtomatik tashlanadi) ──
  for (const [from, to] of [
    [4, 215],
    [310, 390],
    [580, 660],
    [872, 955],
    [1012, 1072],
  ]) {
    row('lightPostLarge', from, to, 36, LEFT * EDGE);
    row('lightPostLarge', from + 18, to, 36, RIGHT * EDGE);
  }

  // ── Daraxtlar: tashqarida va ichkarida (yo'lga yaqin tushganlari client'da tashlab yuboriladi) ──
  const rng = createRng(77);
  for (let i = 0; i < 110; i++) {
    const s = rng() * layout.length;
    p.push({
      model: rng() < 0.6 ? 'treeLarge' : 'treeSmall',
      s,
      lateral: (rng() < 0.5 ? LEFT : RIGHT) * (EDGE + 20 + rng() * 60),
      yaw: rng() * Math.PI * 2,
      scale: 0.8 + rng() * 0.5,
    });
  }
  return p;
}

export const CIRCUIT: TrackDef = {
  id: 'circuit',
  name: 'Gran Pri',
  description: '8-shakl, ko\'prik · 3 aylana',
  seed: 911,
  laps: 3,
  startLine: layout.startS,
  control: layout.control,
  zones: [{ type: 'circuit', end: Infinity }],
  // Start chizig'idan keyin; kesishma (start yo'lida s ≈ 132..154, ko'prikda ≈ 700..790) va rampalardan uzoqda
  checkpoints: [250, 350, 450, 560, 640, 840, 930, 1040],
  boosts: [310, 600, 960],
  ramps: [],
  logs: [],
  fallenPillars: [],
  arches: [],
  boulderSpawners: [],
  bridge: null,
  tunnel: null,
  narrow: null,
  lake: null,
  tiles: TILES,
  props: props(),
};
