/**
 * Sarguzasht marshruti: nazorat nuqtalari → Catmull-Rom spline → yoy uzunligi bo'yicha
 * teng qadamli namunalar. Relyef, yo'l, checkpointlar va barcha trassa obyektlari
 * shu marshrutga nisbatan (masofa `s`, metrda) joylashtiriladi.
 * Faqat sof matematika — server ham ishlatadi (three.js kerak emas).
 */

/** [x, yo'l balandligi, z] — o'rmon → kanyon → xarobalar → marra */
const CONTROL: [number, number, number][] = [
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
];

/** Namunalar orasidagi masofa (m) */
export const ROUTE_STEP = 2;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function buildSamples() {
  // 1) Spline'ni zich namunalash
  const dense: [number, number, number][] = [];
  const n = CONTROL.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = CONTROL[Math.max(0, i - 1)];
    const p1 = CONTROL[i];
    const p2 = CONTROL[i + 1];
    const p3 = CONTROL[Math.min(n - 1, i + 2)];
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      dense.push([0, 1, 2].map((a) => catmullRom(p0[a], p1[a], p2[a], p3[a], t)) as [number, number, number]);
    }
  }
  dense.push(CONTROL[n - 1]);

  // 2) Yoy uzunligi bo'yicha teng qadamli qayta namunalash
  const xs: number[] = [dense[0][0]];
  const ys: number[] = [dense[0][1]];
  const zs: number[] = [dense[0][2]];
  let carry = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i];
    const seg = Math.hypot(b[0] - a[0], b[2] - a[2]);
    let pos = ROUTE_STEP - carry;
    while (pos <= seg) {
      const t = pos / seg;
      xs.push(a[0] + (b[0] - a[0]) * t);
      ys.push(a[1] + (b[1] - a[1]) * t);
      zs.push(a[2] + (b[2] - a[2]) * t);
      pos += ROUTE_STEP;
    }
    carry = seg - (pos - ROUTE_STEP);
  }

  // 3) Gorizontal tangentlar
  const count = xs.length;
  const txs = new Float32Array(count);
  const tzs = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(count - 1, i + 1);
    const dx = xs[b] - xs[a];
    const dz = zs[b] - zs[a];
    const len = Math.hypot(dx, dz) || 1;
    txs[i] = dx / len;
    tzs[i] = dz / len;
  }
  return {
    count,
    xs: Float32Array.from(xs),
    ys: Float32Array.from(ys),
    zs: Float32Array.from(zs),
    txs,
    tzs,
  };
}

export const ROUTE = buildSamples();
export const ROUTE_LENGTH = (ROUTE.count - 1) * ROUTE_STEP;

export interface RouteFrame {
  /** Marshrut bo'ylab masofa (m) */
  s: number;
  x: number;
  y: number;
  z: number;
  /** Gorizontal birlik tangent (harakat yo'nalishi) */
  tx: number;
  tz: number;
}

/** Marshrutdagi `s` masofadagi nuqta (chiziqli interpolyatsiya) */
export function routeAt(s: number, out: RouteFrame = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 1 }): RouteFrame {
  const f = Math.min(Math.max(s, 0), ROUTE_LENGTH) / ROUTE_STEP;
  const i = Math.min(Math.floor(f), ROUTE.count - 2);
  const t = f - i;
  const { xs, ys, zs, txs, tzs } = ROUTE;
  out.s = Math.min(Math.max(s, 0), ROUTE_LENGTH);
  out.x = xs[i] + (xs[i + 1] - xs[i]) * t;
  out.y = ys[i] + (ys[i + 1] - ys[i]) * t;
  out.z = zs[i] + (zs[i + 1] - zs[i]) * t;
  const tx = txs[i] + (txs[i + 1] - txs[i]) * t;
  const tz = tzs[i] + (tzs[i + 1] - tzs[i]) * t;
  const len = Math.hypot(tx, tz) || 1;
  out.tx = tx / len;
  out.tz = tz / len;
  return out;
}

/** Yo'nalish burchagi (yaw): 0 = +Z. Mashina/obyektlarni yo'l bo'ylab burish uchun */
export const yawOf = (tx: number, tz: number) => Math.atan2(tx, tz);

export interface NearestResult {
  s: number;
  /** Marshrut o'qigacha gorizontal masofa */
  dist: number;
  /** Yon ofset: musbat = harakat yo'nalishiga nisbatan chap tomon (+X ga o'xshash) */
  lateral: number;
  /** Eng yaqin nuqtadagi yo'l balandligi */
  roadY: number;
}

const COARSE = 8;

/**
 * (x, z) ga eng yaqin marshrut nuqtasi. Ikki bosqichli qidiruv: har 8-namuna bo'yicha
 * qo'pol, keyin atrofida aniq + kesmaga proyeksiya. Relyef qurishda ~60k marta chaqiriladi,
 * shuning uchun natija obyekti qayta ishlatiladi (`out`).
 */
export function nearestOnRoute(x: number, z: number, out: NearestResult = { s: 0, dist: 0, lateral: 0, roadY: 0 }) {
  const { xs, zs, ys, count } = ROUTE;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < count; i += COARSE) {
    const d = (xs[i] - x) ** 2 + (zs[i] - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const lo = Math.max(0, best - COARSE);
  const hi = Math.min(count - 1, best + COARSE);
  for (let i = lo; i <= hi; i++) {
    const d = (xs[i] - x) ** 2 + (zs[i] - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  // Qo'shni kesmalarga proyeksiya
  let seg = best;
  let t = 0;
  let segD = bestD;
  for (const i of [best - 1, best]) {
    if (i < 0 || i >= count - 1) continue;
    const ax = xs[i];
    const az = zs[i];
    const dx = xs[i + 1] - ax;
    const dz = zs[i + 1] - az;
    const len2 = dx * dx + dz * dz;
    const u = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * u;
    const pz = az + dz * u;
    const d = (x - px) ** 2 + (z - pz) ** 2;
    if (d <= segD) {
      segD = d;
      seg = i;
      t = u;
    }
  }
  const i2 = Math.min(seg + 1, count - 1);
  const px = xs[seg] + (xs[i2] - xs[seg]) * t;
  const pz = zs[seg] + (zs[i2] - zs[seg]) * t;
  const tx = xs[i2] - xs[seg];
  const tz = zs[i2] - zs[seg];
  out.s = (seg + t) * ROUTE_STEP;
  out.dist = Math.sqrt(segD);
  // Chap tomon vektori: up × tangent = (tz, 0, -tx)
  out.lateral = Math.sign((x - px) * tz - (z - pz) * tx) * out.dist;
  out.roadY = ys[seg] + (ys[i2] - ys[seg]) * t;
  return out;
}
