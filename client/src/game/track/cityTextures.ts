import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { createRng } from '@game/shared';

/**
 * Tungi shahar teksturalari — hammasi canvas'da dasturda chiziladi (tashqi rasm yo'q), bir marta yaratiladi.
 *  - facade: bino fasadi (deraza oynalari to'q, oralig'i och) — vertex rang bilan ko'paytiriladi
 *  - windows: tunda yonib turgan derazalar (emissive): iliq sariq, oq, ba'zan ko'kish; devor — juda xira ko'k
 *  - neon: yozuvlar atlasi — chap yarmi 4 ta tik lavha, o'ng yarmi 4 ta yotiq lavha (oq, rangni vertex rang beradi)
 *  - glow: fonar ostidagi yorug'lik dog'i (radial gradient)
 */

/** Deraza katagi: 8×8 katak, har biri bitta qavat × bitta oraliq (FLOOR × BAY metr) */
export const WINDOW_CELLS = 8;
export const BAY = 3.2;
export const FLOOR = 3.6;
const CELL = 32;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function texture(c: HTMLCanvasElement, repeat: boolean) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

let facade: CanvasTexture | null = null;
let windows: CanvasTexture | null = null;
let glass: CanvasTexture | null = null;

/** Deraza o'rni katak ichida (chetlari — devor); (0,0) katakning chap-yuqori burchagi doim devor (tom uchun) */
const pane = (x: number, y: number) => [x * CELL + 5, y * CELL + 6, CELL - 10, CELL - 11] as const;

export function facadeTexture() {
  if (facade) return facade;
  const [c, ctx] = canvas(WINDOW_CELLS * CELL, WINDOW_CELLS * CELL);
  // Oqartirilgan beton/kompozit panel: bino vertex rangi bilan ko'paytirilganda ham tungi yorug'likni ushlaydi.
  ctx.fillStyle = '#eceef2';
  ctx.fillRect(0, 0, c.width, c.height);
  // Panel choklari va qavat plitalari
  ctx.fillStyle = '#b8bdc7';
  for (let y = 0; y < WINDOW_CELLS; y++) ctx.fillRect(0, y * CELL + CELL - 4, c.width, 4);
  ctx.fillStyle = '#d3d6dd';
  for (let x = 0; x < WINDOW_CELLS; x++) ctx.fillRect(x * CELL, 0, 3, c.height);
  for (let y = 0; y < WINDOW_CELLS; y++) {
    for (let x = 0; x < WINDOW_CELLS; x++) {
      const [px, py, w, h] = pane(x, y);
      // Chuqur oyna o'rni, metall rama va pastki tokcha
      ctx.fillStyle = '#424b5a';
      ctx.fillRect(px - 2, py - 2, w + 4, h + 4);
      ctx.fillStyle = '#242b38';
      ctx.fillRect(px, py, w, h);
      // Ichki xona chuqurligi: qorong'i shift/pol va perspektiv yon devorlar.
      const room = ctx.createLinearGradient(px, py, px, py + h);
      room.addColorStop(0, 'rgba(4,7,13,0.85)');
      room.addColorStop(0.28, 'rgba(24,31,43,0.45)');
      room.addColorStop(0.78, 'rgba(12,17,27,0.28)');
      room.addColorStop(1, 'rgba(2,4,8,0.8)');
      ctx.fillStyle = room;
      ctx.fillRect(px + 1, py + 1, w - 2, h - 2);
      ctx.strokeStyle = 'rgba(125,145,170,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 1, py + 1);
      ctx.lineTo(px + w * 0.3, py + h * 0.32);
      ctx.lineTo(px + w * 0.3, py + h * 0.82);
      ctx.lineTo(px + 1, py + h - 1);
      ctx.stroke();
      ctx.fillStyle = 'rgba(160,185,210,0.18)';
      ctx.fillRect(px + 2, py + 2, Math.max(2, w * 0.16), h - 4);
      ctx.fillStyle = '#aeb3bd';
      ctx.fillRect(px - 2, py + h + 1, w + 4, 2);
    }
  }
  return (facade = texture(c, true));
}

export function windowsTexture() {
  if (windows) return windows;
  const rng = createRng(8080);
  const [c, ctx] = canvas(WINDOW_CELLS * CELL, WINDOW_CELLS * CELL);
  // Fon — juda xira ko'k: devorlar tungi shahar yorug'ida biroz ko'rinadi (qop-qora bo'lib qolmaydi)
  ctx.fillStyle = '#111624';
  ctx.fillRect(0, 0, c.width, c.height);
  // O'chiq derazalar — devordan biroz to'qroq oyna
  ctx.fillStyle = '#070a11';
  for (let y = 0; y < WINDOW_CELLS; y++) for (let x = 0; x < WINDOW_CELLS; x++) ctx.fillRect(...pane(x, y));
  const lit = ['#ffd98a', '#ffe7b3', '#fff4dc', '#cfe3ff', '#ffc46b'];
  for (let y = 0; y < WINDOW_CELLS; y++) {
    for (let x = 0; x < WINDOW_CELLS; x++) {
      if (rng() < 0.48) continue; // o'chiq deraza
      const [px, py, w, h] = pane(x, y);
      ctx.globalAlpha = 0.55 + rng() * 0.45;
      ctx.fillStyle = lit[Math.floor(rng() * lit.length)];
      ctx.fillRect(px, py, w, h);
      // Yoritilgan xonada ham shift/pol soyasi va orqa devor chuqurligi saqlanadi.
      const shade = ctx.createLinearGradient(px, py, px, py + h);
      shade.addColorStop(0, 'rgba(25,18,12,0.48)');
      shade.addColorStop(0.22, 'rgba(255,255,255,0)');
      shade.addColorStop(0.78, 'rgba(255,255,255,0)');
      shade.addColorStop(1, 'rgba(35,20,8,0.55)');
      ctx.fillStyle = shade;
      ctx.fillRect(px, py, w, h);
      // Parda/odam soyasi — deraza bir xil ko'rinmasin
      if (rng() < 0.3) {
        ctx.fillStyle = '#000';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(px + w * rng(), py, w * 0.3, h);
      }
    }
  }
  ctx.globalAlpha = 1;
  return (windows = texture(c, true));
}

/** Fasad ustidagi alohida shisha qatlami: envMap aksi + diagonal tungi yorug'lik izi. */
export function glassTexture() {
  if (glass) return glass;
  const [c, ctx] = canvas(WINDOW_CELLS * CELL, WINDOW_CELLS * CELL);
  ctx.clearRect(0, 0, c.width, c.height);
  for (let y = 0; y < WINDOW_CELLS; y++) {
    for (let x = 0; x < WINDOW_CELLS; x++) {
      const [px, py, w, h] = pane(x, y);
      const g = ctx.createLinearGradient(px, py + h, px + w, py);
      g.addColorStop(0, 'rgba(15,31,48,0.18)');
      g.addColorStop(0.42, 'rgba(65,106,145,0.1)');
      g.addColorStop(0.52, 'rgba(205,235,255,0.58)');
      g.addColorStop(0.61, 'rgba(83,139,180,0.16)');
      g.addColorStop(1, 'rgba(8,19,34,0.24)');
      ctx.fillStyle = g;
      ctx.fillRect(px, py, w, h);
      ctx.strokeStyle = 'rgba(190,225,255,0.26)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
    }
  }
  return (glass = texture(c, true));
}

let neon: CanvasTexture | null = null;

/** Neon atlasidagi lavha uv to'rtburchagi: [u0, v0, u1, v1] (v — pastdan) */
export function neonRect(vertical: boolean, k: number): [number, number, number, number] {
  return vertical ? [k * 0.125, 0, (k + 1) * 0.125, 1] : [0.5, 1 - (k + 1) * 0.25, 1, 1 - k * 0.25];
}

/** Ieroglifga o'xshash belgi: kvadrat ichida gorizontal/vertikal chiziqlar va qutilar */
function glyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rng: () => number) {
  const s = size;
  ctx.beginPath();
  const strokes = 3 + Math.floor(rng() * 4);
  for (let k = 0; k < strokes; k++) {
    const t = rng();
    if (t < 0.4) {
      const yy = y + s * (0.15 + rng() * 0.7);
      ctx.moveTo(x + s * (0.1 + rng() * 0.2), yy);
      ctx.lineTo(x + s * (0.7 + rng() * 0.2), yy);
    } else if (t < 0.75) {
      const xx = x + s * (0.15 + rng() * 0.7);
      ctx.moveTo(xx, y + s * (0.1 + rng() * 0.2));
      ctx.lineTo(xx, y + s * (0.7 + rng() * 0.2));
    } else {
      ctx.rect(x + s * 0.25, y + s * (0.2 + rng() * 0.3), s * 0.5, s * 0.3);
    }
  }
  ctx.stroke();
}

export function neonTexture() {
  if (neon) return neon;
  const rng = createRng(5151);
  const [c, ctx] = canvas(512, 256);
  ctx.clearRect(0, 0, 512, 256);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const panel = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = 'rgba(8,6,16,0.82)';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
  };
  // Tik lavhalar: 4 ta 64×256
  for (let k = 0; k < 4; k++) {
    const x = k * 64;
    panel(x, 0, 64, 256);
    ctx.lineWidth = 4;
    for (let g = 0; g < 4; g++) glyph(ctx, x + 10, 14 + g * 58, 44, rng);
  }
  // Yotiq lavhalar: 4 ta 256×64
  for (let k = 0; k < 4; k++) {
    const y = k * 64;
    panel(256, y, 256, 64);
    ctx.lineWidth = 4;
    for (let g = 0; g < 5; g++) glyph(ctx, 256 + 14 + g * 46, y + 12, 40, rng);
  }
  ctx.shadowBlur = 0;
  return (neon = texture(c, false));
}

let glow: CanvasTexture | null = null;

export function glowTexture() {
  if (glow) return glow;
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return (glow = texture(c, false));
}
