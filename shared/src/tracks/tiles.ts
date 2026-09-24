import type { ControlPoint } from '../route';

/**
 * Plitkali trassa (Kenney Racing Kit): trassa to'g'ri va burilish plitkalari ketma-ketligi sifatida yoziladi
 * ("toshbaqa grafikasi"). Shundan ikkita narsa hisoblanadi:
 *  - markaziy chiziq (`control`) — oddiy trassalardagi kabi marshrut (checkpoint, bot, mini-xarita, server) shundan;
 *  - plitkalar joylashuvi (`pieces`) — client kit modellarini shu joylarga qo'yadi.
 *
 * Kit modellari (1×1 birlik setka): to'g'ri plitka lokal −z bo'ylab yo'naladi, kirish qirrasi z = −0.65,
 * x ∈ [−0.35, 0.65] (model boshi plitka burchagidan siljigan). Burilish plitkalari (1×1, 2×2, 3×3) o'ngga buriladi;
 * chapga burilish — shu plitka teskari yo'nalishda o'tiladi. Markaziy chiziq radiusi: (n − 0.5) plitka.
 * Asfalt plitka kengligining o'rta 69% qismi (0.155..0.845).
 *
 * Ko'prik (`['X', k]`): rampa ↑ (2 plitka) → ko'prik boshi (tayanch) → k ta ochiq oraliq → ko'prik boshi → rampa ↓.
 * Ochiq oraliq tagidan boshqa to'g'ri yo'l perpendikulyar o'tishi mumkin (8-shakl trassa). Ko'tarilgan plitkalar
 * balandligi TILE_ELEV_SCALE bilan (kit masshtabida juda baland chiqardi), ular uchun trimesh collider quriladi.
 */

/**
 * To'g'ri: n plitka ('start' — 2 ta start panjarasi + 2 plitkali start arkasi, jami 4);
 * burilish: 1×1, 2×2, 3×3; ko'prik: jami k + 6 plitka
 */
export type TileStep =
  | readonly ['S', number]
  | readonly ['S', 4, 'start']
  | readonly ['R' | 'L', 1 | 2 | 3]
  | readonly ['X', number];

export interface TileLayoutDef {
  /** Plitka o'lchami (m) */
  size: number;
  /** Birinchi plitka kirish qirrasining o'rtasi (x, z) */
  origin: readonly [number, number];
  /** Boshlang'ich yo'nalish (dunyo XZ, birlik vektor) */
  forward: readonly [number, number];
  /** Yo'l balandligi (tekis) */
  y: number;
  steps: readonly TileStep[];
}

/** Kit modelining joyi: model boshi (x, z), burilish (yaw), masshtab = plitka o'lchami */
export interface TilePiece {
  model: string;
  x: number;
  z: number;
  yaw: number;
  /** Ko'tarilgan (rampa, ko'prik): balandlik TILE_ELEV_SCALE bilan, fizika — trimesh collider */
  elevated?: boolean;
}

export interface TileLayout {
  control: ControlPoint[];
  /** Bir aylana uzunligi (m) — markaziy chiziq bo'yicha */
  length: number;
  pieces: TilePiece[];
  /** Start arkasi joyi (`s`, m) */
  startS: number;
}

/** Asfaltning yarim kengligi (plitka o'lchamiga nisbatan) */
export const TILE_ROAD_HALF = 0.345;

/** Ko'tarilgan plitkalar: 1 kit birligi balandlikda = shuncha metr (ko'prik yo'li 0.5 birlikda → 6 m) */
export const TILE_ELEV_SCALE = 12;
const DECK = 0.5;
/** Ko'prik yo'lining balandligi (m, yer sathidagi yo'ldan) */
export const TILE_DECK_HEIGHT = DECK * TILE_ELEV_SCALE;
/** Yer sathidagi plitkalar yupqa qatlam: shu balandlikdan (kit birligi) past uchlar FLAT_Y_SCALE masshtabida */
const FLAT_Y_LIMIT = 0.03;
const FLAT_Y_SCALE = 4;
/**
 * Asfalt usti relyefdan shuncha balandda. Plitka qatlamlari (kit birligida, tugun siljishi bilan): chetdagi o't −0.01,
 * asfalt 0, oq chiziq/bordyur +0.01 — yassilangandan keyin ±0.04 m; eng pastki qatlam ham relyefdan yuqorida bo'lsin
 */
const ROAD_LIFT = 0.09;

/**
 * Kit modeli uchini (model koordinatalari, tugun siljishi qo'shilgan) dunyoga o'tkazish — client (vizual, collider)
 * va headless simulyatsiya bir xil formulani ishlatadi. `out` — [x, y, z].
 */
export function tileVertex(piece: TilePiece, size: number, roadY: number, x: number, y: number, z: number, out: number[]) {
  const vy = piece.elevated ? y * TILE_ELEV_SCALE : y <= FLAT_Y_LIMIT ? y * FLAT_Y_SCALE : y * size;
  const c = Math.cos(piece.yaw);
  const s = Math.sin(piece.yaw);
  const sx = x * size;
  const sz = z * size;
  out[0] = piece.x + sx * c + sz * s;
  out[1] = roadY + ROAD_LIFT + vy;
  out[2] = piece.z - sx * s + sz * c;
  return out;
}

const CORNER = { 1: 'roadCornerSmall', 2: 'roadCornerLarge', 3: 'roadCornerLarger' } as const;
/** Burilish bordyurlari (qizil-oq kerb): tashqi va ichki */
const CORNER_KERBS = {
  1: ['roadCornerSmallBorder'],
  2: ['roadCornerLargeBorder', 'roadCornerLargeBorderInner'],
  3: ['roadCornerLargerBorder', 'roadCornerLargerBorderInner'],
} as const;

/** Nazorat nuqtalari orasidagi masofa (m) */
const SAMPLE = 4;

export function buildTileLayout(def: TileLayoutDef): TileLayout {
  const T = def.size;
  const control: ControlPoint[] = [];
  const pieces: TilePiece[] = [];
  let [px, pz] = def.origin;
  let [fx, fz] = def.forward;
  let length = 0;
  let startS = 0;

  /** Model −z yo'nalishi `F` ga qaraydigan burilish; model boshi — kirish qirrasi o'rtasidan (−0.15, +0.65)·T */
  const place = (model: string, ex: number, ez: number, dx: number, dz: number, elevated = false) => {
    const yaw = Math.atan2(-dx, -dz);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const ox = -0.15 * T;
    const oz = 0.65 * T;
    pieces.push({ model, x: ex + ox * c + oz * s, z: ez - ox * s + oz * c, yaw, ...(elevated && { elevated }) });
  };
  const point = (x: number, z: number, up = 0) => control.push([x, def.y + up, z]);

  for (const step of def.steps) {
    // O'ng tomon (three.js: −z ga qarab turganda o'ng = +x)
    const rx = -fz;
    const rz = fx;
    if (step[0] === 'X') {
      // Ko'prik: rampa ↑ (2) → bosh → k oraliq → bosh (teskari) → rampa ↓ (teskari)
      const k = step[1];
      const cells = k + 6;
      const at = (i: number): [number, number] => [px + fx * i * T, pz + fz * i * T];
      place('roadRampLongWall', ...at(0), fx, fz, true);
      place('roadStraightBridgeStart', ...at(2), fx, fz, true);
      for (let i = 0; i < k; i++) place('roadStraightBridgeMid', ...at(3 + i), fx, fz, true);
      // Teskari bo'laklar: o'z kirishi bizning chiqish tomonimizda
      place('roadStraightBridgeStart', ...at(4 + k), -fx, -fz, true);
      place('roadRampLongWall', ...at(cells), -fx, -fz, true);
      const len = cells * T;
      const H = TILE_DECK_HEIGHT;
      for (let d = 0; d < len; d += SAMPLE) {
        const up = d < 2 * T ? (d / (2 * T)) * H : d > len - 2 * T ? ((len - d) / (2 * T)) * H : H;
        point(px + fx * d, pz + fz * d, up);
      }
      px += fx * len;
      pz += fz * len;
      length += len;
      continue;
    }
    if (step[0] === 'S') {
      const n = step[1];
      const len = n * T;
      if (step[2] === 'start') {
        place('roadStartPositions', px, pz, fx, fz);
        place('roadStart', px + fx * 2 * T, pz + fz * 2 * T, fx, fz);
        // Ark 2 plitkali bo'lakning o'rtasida
        startS = length + 3 * T;
      } else {
        let k = 0;
        for (; k + 2 <= n; k += 2) place('roadStraightLong', px + fx * k * T, pz + fz * k * T, fx, fz);
        if (k < n) place('roadStraight', px + fx * k * T, pz + fz * k * T, fx, fz);
      }
      for (let d = 0; d < len; d += SAMPLE) point(px + fx * d, pz + fz * d);
      px += fx * len;
      pz += fz * len;
      length += len;
      continue;
    }

    const [dir, n] = step;
    const r = (n - 0.5) * T;
    const sign = dir === 'R' ? 1 : -1;
    // Burilish markazi — o'ng (yoki chap) tomonda r masofada
    const cx = px + rx * r * sign;
    const cz = pz + rz * r * sign;
    const arc = (Math.PI / 2) * r;
    const segs = Math.max(2, Math.ceil(arc / SAMPLE));
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * (Math.PI / 2);
      // Markazdan boshlang'ich nuqtaga: −sign·R; burilgan sari F tomonga
      point(cx + (-rx * sign * Math.cos(a) + fx * Math.sin(a)) * r, cz + (-rz * sign * Math.cos(a) + fz * Math.sin(a)) * r);
    }
    if (dir === 'R') {
      for (const m of [CORNER[n], ...CORNER_KERBS[n]]) place(m, px, pz, fx, fz);
      px += (fx + rx) * r;
      pz += (fz + rz) * r;
      [fx, fz] = [rx, rz];
    } else {
      // Chap: plitka teskari o'tiladi — plitkaning o'z kirishi bizning chiqishimizda, o'z yo'nalishi = bizning o'ng
      const ex = px + (fx - rx) * r;
      const ez = pz + (fz - rz) * r;
      for (const m of [CORNER[n], ...CORNER_KERBS[n]]) place(m, ex, ez, rx, rz);
      px = ex;
      pz = ez;
      [fx, fz] = [-rx, -rz];
    }
    length += arc;
  }
  return { control, length, pieces, startS };
}
