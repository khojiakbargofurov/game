/**
 * Marshrut: nazorat nuqtalari → Catmull-Rom spline → yoy uzunligi bo'yicha teng qadamli namunalar.
 * Relyef, yo'l, checkpointlar va barcha trassa obyektlari marshrutga nisbatan (masofa `s`, metrda)
 * joylashtiriladi. Har bir trassa o'z marshrutini quradi (tracks/createTrack.ts).
 * Faqat sof matematika — server ham ishlatadi (three.js kerak emas).
 */

/** Nazorat nuqtasi: [x, yo'l balandligi, z] */
export type ControlPoint = [number, number, number];

export interface Route {
  count: number;
  xs: Float32Array;
  ys: Float32Array;
  zs: Float32Array;
  txs: Float32Array;
  tzs: Float32Array;
  /** Marshrut uzunligi (m) */
  length: number;
  /** Yopiq halqa (aylanali poyga): oxirgi namuna birinchisi bilan bir xil, `s` halqa bo'ylab o'raladi */
  closed: boolean;
}

/** Namunalar orasidagi masofa (m) */
export const ROUTE_STEP = 2;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function buildRoute(control: readonly ControlPoint[], closed = false): Route {
  // 1) Spline'ni zich namunalash (yopiq halqada oxirgi nuqta birinchisiga ulanadi)
  const dense: [number, number, number][] = [];
  const n = control.length;
  const at = (i: number) => (closed ? control[(i + n) % n] : control[Math.min(n - 1, Math.max(0, i))]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      dense.push([0, 1, 2].map((a) => catmullRom(p0[a], p1[a], p2[a], p3[a], t)) as [number, number, number]);
    }
  }
  dense.push(closed ? control[0] : control[n - 1]);

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

  // Yopiq halqa: oxirgi namuna aynan birinchisi bo'lsin (chok joyida uzilish bo'lmasin)
  if (closed) {
    const gap = Math.hypot(xs[xs.length - 1] - xs[0], zs[zs.length - 1] - zs[0]);
    if (gap > ROUTE_STEP * 0.5) {
      xs.push(xs[0]);
      ys.push(ys[0]);
      zs.push(zs[0]);
    } else {
      xs[xs.length - 1] = xs[0];
      ys[ys.length - 1] = ys[0];
      zs[zs.length - 1] = zs[0];
    }
  }

  // 3) Gorizontal tangentlar (halqada chok orqali o'raladi)
  const count = xs.length;
  const txs = new Float32Array(count);
  const tzs = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = closed ? (i === 0 ? count - 2 : i - 1) : Math.max(0, i - 1);
    const b = closed ? (i === count - 1 ? 1 : i + 1) : Math.min(count - 1, i + 1);
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
    length: (count - 1) * ROUTE_STEP,
    closed,
  };
}

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
export function routeFrameAt(
  ROUTE: Route,
  s: number,
  out: RouteFrame = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 1 },
): RouteFrame {
  // Halqada `s` o'raladi (manfiy yoki uzunlikdan katta bo'lishi mumkin — masalan, start panjarasi chiziq ortida)
  const L = ROUTE.length;
  const sc = ROUTE.closed ? ((s % L) + L) % L : Math.min(Math.max(s, 0), L);
  const f = sc / ROUTE_STEP;
  const i = Math.min(Math.floor(f), ROUTE.count - 2);
  const t = f - i;
  const { xs, ys, zs, txs, tzs } = ROUTE;
  out.s = sc;
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
export function nearestOnRouteOf(
  ROUTE: Route,
  x: number,
  z: number,
  out: NearestResult = { s: 0, dist: 0, lateral: 0, roadY: 0 },
): NearestResult {
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
