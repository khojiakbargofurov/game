import type { TrackDef } from './types';

/**
 * Alp dovoni (Asphalt uslubi): vodiydagi startdan ikki serpantin bilan tog' yonbag'riga ko'tarilish,
 * tepada tunnel bilan tizmani kesib o'tish, g'arbiy yonbag'ir bo'ylab tez tushish. Yopiq halqa, 2 aylana (~2.5 km).
 * Relyef — `landform`: har serpantin bo'lagi o'z pog'onasida, bo'laklar orasida tik qoya, tashqarida chuqur vodiy.
 */
export const ALPINE: TrackDef = {
  id: 'alpine',
  name: 'Alp dovoni',
  description: "Serpantin → tunnel → jarlik bo'ylab tushish · 2 aylana",
  seed: 911,
  laps: 2,
  startLine: 60,
  control: [
    // Vodiydagi start to'g'ri yo'li (sharqqa)
    [-300, 6, -400],
    [-150, 6, -405],
    [0, 6, -400],
    [110, 7, -395],
    [170, 8, -370],
    [200, 10, -320],
    // 1-bo'lak: shimolga ko'tarilish
    [205, 16, -220],
    [200, 25, -110],
    [195, 32, -40],
    // 1-serpantin
    [185, 35, 5],
    [150, 36, 25],
    [115, 37, 5],
    // 2-bo'lak: janubga ko'tarilish
    [100, 42, -60],
    [100, 51, -170],
    [105, 58, -250],
    // 2-serpantin
    [90, 61, -300],
    [50, 62, -320],
    [10, 63, -300],
    // 3-bo'lak: tepadagi uzun to'g'ri yo'l
    [0, 67, -230],
    [-5, 72, -100],
    [0, 77, 20],
    [5, 80, 120],
    // Tizmani tunnel bilan kesib o'tish
    [-30, 81, 200],
    [-90, 81, 240],
    [-160, 78, 250],
    // G'arbiy yonbag'ir bo'ylab tushish
    [-240, 70, 220],
    [-310, 60, 150],
    [-350, 49, 50],
    [-370, 38, -80],
    [-380, 27, -200],
    [-370, 16, -310],
    [-340, 8, -385],
  ],
  zones: [{ type: 'alpine', end: Infinity }],
  landform: {
    anchors: [
      // Sharqiy vodiy (1-bo'lak va 1-serpantin tashqarisi — jarlik)
      [300, -320, -12],
      [310, -150, -8],
      [300, 20, -4],
      [240, 150, 4],
      [150, 130, 10],
      // Janubiy vodiy (start yo'li ostida)
      [-200, -480, -6],
      [0, -485, -6],
      [180, -470, -8],
      // G'arbiy vodiy (tushish yo'li ostida)
      [-480, -250, -10],
      [-480, -50, -6],
      [-470, 150, 0],
      [-380, 300, 10],
      // Shimoliy vodiy
      [-150, 360, 20],
      [60, 300, 25],
    ],
    // Yo'l yonidagi devor (+) va jarlik (−); chap = harakat yo'nalishiga nisbatan
    edges: [
      // Start yo'li: janubda vodiyga jarlik, shimolda 2-serpantin ostidagi qoya
      { from: 0, to: 430, side: 1, offset: 26, dy: -26 },
      { from: 60, to: 420, side: -1, offset: 32, dy: 30 },
      { from: 430, to: 560, side: 1, offset: 26, dy: -28 },
      // 1-bo'lak: sharqda jarlik, g'arbda devor
      { from: 540, to: 860, side: 1, offset: 26, dy: -34 },
      { from: 560, to: 820, side: -1, offset: 32, dy: 22 },
      // 1-serpantin tashqarisi
      { from: 860, to: 990, side: 1, offset: 24, dy: -24 },
      // 2-bo'lak: g'arbda (3-bo'lak tomonda) devor
      { from: 1000, to: 1220, side: 1, offset: 30, dy: 18 },
      // 2-serpantin tashqarisi — start yo'li ustidagi chuqur jarlik
      { from: 1230, to: 1390, side: -1, offset: 24, dy: -40 },
      // 3-bo'lak: g'arbda cho'qqi devori
      { from: 1400, to: 1790, side: -1, offset: 30, dy: 24 },
      // Tizma (tunnel atrofi): ikkala tomonda qoya
      { from: 1800, to: 2020, side: 1, offset: 28, dy: 16 },
      { from: 1800, to: 2020, side: -1, offset: 28, dy: 16 },
      // Tushish: g'arbda vodiyga jarlik, sharqda cho'qqi devori
      { from: 2030, to: 2760, side: 1, offset: 26, dy: -34 },
      { from: 2030, to: 2740, side: -1, offset: 30, dy: 24 },
    ],
    bumps: [
      // Halqa ichidagi katta cho'qqi
      { x: -190, z: -110, radius: 95, height: 70 },
      // Tunnel ustidagi tizma
      { x: -75, z: 235, radius: 45, height: 30 },
    ],
  },
  env: { skyline: 'peaks' },
  checkpoints: [260, 520, 780, 1040, 1300, 1560, 1820, 2080],
  boosts: [120, 330, 700, 1180, 1500, 1900],
  ramps: [{ s: 1600, lateral: 0, width: 6, length: 9, height: 1.8 }],
  logs: [],
  fallenPillars: [],
  arches: [],
  boulderSpawners: [],
  bridge: null,
  tunnel: { start: 1890, end: 1960, height: 7 },
  narrow: null,
  lake: null,
};
