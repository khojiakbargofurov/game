import { createRng } from '../noise';
import { buildTileLayout, type TileLayoutDef } from './tiles';
import type { PropDef, TrackDef } from './types';

/**
 * Gran Pri: Kenney Racing Kit plitkalaridan yig'ilgan F1 halqasi (Sample.png uslubida), 3 aylana.
 * Uzun start to'g'ri yo'li (pit binolari va tribunalar orasida) → katta o'ng burilish → "S" → ikkinchi to'g'ri →
 * sharqiy burilish → shikanalar → orqa to'g'ri → startga qaytish. Ichki maydonda chodirlar, bannerlar, daraxtlar.
 */

const TILES: TileLayoutDef = {
  size: 22,
  origin: [140, -100],
  forward: [0, 1],
  y: 2,
  steps: [
    ['S', 2],
    ['S', 4, 'start'],
    ['S', 3],
    ['R', 3],
    ['S', 3],
    ['R', 1],
    ['L', 1],
    ['S', 4],
    ['R', 3],
    ['S', 3],
    ['R', 2],
    ['S', 2],
    ['L', 1],
    ['R', 1],
    ['S', 3],
    ['R', 1],
    ['L', 1],
    ['S', 1],
    ['L', 2],
    ['S', 1],
    ['R', 2],
    ['R', 1],
  ],
};

const layout = buildTileLayout(TILES);
const L = layout.length;

/** Plitka chetidan tashqarida (m): plitka yarim kengligi 11 m */
const EDGE = 12.5;
const OUT = 1; // chap — halqaning tashqi tomoni (asosan o'ngga buriladi)
const IN = -1;

function props(): PropDef[] {
  const p: PropDef[] = [];
  const row = (model: string, from: number, to: number, step: number, lateral: number, extra: Partial<PropDef> = {}) => {
    for (let s = from; s <= to; s += step) p.push({ model, s, lateral, face: 'road', ...extra });
  };

  // ── Start to'g'ri yo'li (0..198): tashqarida yopiq tribunalar, ichkarida pit binolari ──
  row('grandStandCovered', 30, 186, 12, OUT * 19, { solid: true });
  p.push({ model: 'pitsGarageCorner', s: 18, lateral: IN * 19, face: 'road', solid: true });
  row('pitsGarage', 30, 138, 12, IN * 19, { solid: true });
  p.push({ model: 'pitsOffice', s: 150, lateral: IN * 19, face: 'road', solid: true });
  p.push({ model: 'pitsOfficeRoof', s: 162, lateral: IN * 19, face: 'road', solid: true });
  p.push({ model: 'flagCheckers', s: layout.startS, lateral: OUT * EDGE, face: 'road' });
  p.push({ model: 'bannerTowerRed', s: 6, lateral: OUT * EDGE, face: 'road', solid: true });
  p.push({ model: 'bannerTowerGreen', s: 192, lateral: IN * EDGE, face: 'road', solid: true });

  // ── Katta o'ng burilish (198..284): tashqarida ochiq tribunalar ──
  row('grandStand', 214, 270, 13, OUT * 20, { solid: true });

  // ── Yuqori to'g'ri (284..350): bannerlar ──
  p.push({ model: 'billboard', s: 300, lateral: OUT * 15, face: 'road', solid: true });
  p.push({ model: 'billboardLow', s: 330, lateral: OUT * 15, face: 'road', solid: true });

  // ── Ikkinchi to'g'ri (385..473): yo'l ustidan piyodalar ko'prigi, chiroqli ark ──
  p.push({ model: 'overhead', s: 430, lateral: 0, face: 'along', scale: 1.5 });
  p.push({ model: 'overheadLights', s: 400, lateral: 0, face: 'along', scale: 1.5 });
  row('grandStand', 440, 466, 13, OUT * 20, { solid: true });

  // ── Sharqiy tomon (559..625): ichkarida chodirlar (paddok) ──
  row('tent', 565, 610, 15, IN * 22, { solid: true });
  row('tentLong', 575, 605, 30, IN * 42, { solid: true });
  p.push({ model: 'tentClosed', s: 620, lateral: IN * 38, face: 'road', solid: true });
  p.push({ model: 'radarEquipment', s: 595, lateral: IN * 60, face: 'road' });

  // ── Pastki to'g'ri (755..822): tribunalar, kamera ──
  row('grandStandCovered', 762, 814, 13, OUT * 19, { solid: true });
  p.push({ model: 'camera_exclusive', s: 790, lateral: IN * EDGE, face: 'road' });
  p.push({ model: 'billboardLower', s: 900, lateral: OUT * 15, face: 'road', solid: true });

  // ── Chiroq ustunlari: to'g'ri yo'llar bo'ylab ikki tomonda ──
  for (const [from, to] of [
    [8, 190],
    [290, 345],
    [392, 468],
    [565, 620],
    [760, 815],
  ]) {
    row('lightPostLarge', from, to, 36, OUT * EDGE);
    row('lightPostLarge', from + 18, to, 36, IN * EDGE);
  }

  // ── Daraxtlar: tashqarida va ichkarida (yo'lga yaqin tushganlari client'da tashlab yuboriladi) ──
  const rng = createRng(77);
  for (let i = 0; i < 90; i++) {
    const s = rng() * L;
    const side = rng() < 0.55 ? OUT : IN;
    p.push({
      model: rng() < 0.6 ? 'treeLarge' : 'treeSmall',
      s,
      lateral: side * (EDGE + 20 + rng() * 60),
      yaw: rng() * Math.PI * 2,
      scale: 0.8 + rng() * 0.5,
    });
  }
  return p;
}

export const CIRCUIT: TrackDef = {
  id: 'circuit',
  name: 'Gran Pri',
  description: 'Kit halqasi · 3 aylana',
  seed: 911,
  laps: 3,
  startLine: layout.startS,
  control: layout.control,
  zones: [{ type: 'circuit', end: Infinity }],
  // Start chizig'idan aylana oxirigacha teng taqsimlangan (halqada checkpointlar LINE_S..L oralig'ida bo'lishi kerak)
  checkpoints: [0.13, 0.27, 0.41, 0.55, 0.69, 0.83, 0.96].map((f) => Math.round(layout.startS + f * (L - layout.startS))),
  boosts: [0.2, 0.5, 0.8].map((f) => Math.round(layout.startS + f * (L - layout.startS))),
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
