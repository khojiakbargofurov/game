import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, MeshBasicMaterial, MeshLambertMaterial, type Group } from 'three';
import { createRng } from '@game/shared';
import { usePalette } from '../store/raceSettings';
import { BAY, FLOOR, WINDOW_CELLS, windowsTexture } from './track/cityTextures';

/**
 * Uzoq fon: kamera bilan birga yuradigan halqa (tuman ortida ham ko'rinadigan silueta, `fog: false`).
 * Geometriya radius 1 da quriladi va har kadrda `camera.far` ichiga masshtablanadi — shuning uchun
 * yurganda yaqinlashmaydi (osmon kabi), relyef va manzara uni oldidan to'sadi.
 */
export function Skyline({ kind, fog }: { kind: 'peaks' | 'city'; fog: Color }) {
  const palette = usePalette();
  const group = useRef<Group>(null);
  const geometry = useMemo(
    () => (kind === 'peaks' ? buildPeaks(fog, palette.snow, palette.alpineRock) : buildCity(fog)),
    [kind, fog, palette],
  );
  const mat = kind === 'peaks' ? material : cityMaterial();

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const r = camera.far * 0.9;
    g.scale.setScalar(r);
    // Etak ufqdan biroz pastda — relyef orqasidan chiqib turadi
    g.position.set(camera.position.x, camera.position.y - r * 0.08, camera.position.z);
  });

  return (
    <group ref={group}>
      <mesh geometry={geometry} material={mat} renderOrder={-1} frustumCulled={false} />
    </group>
  );
}

const material = new MeshLambertMaterial({ vertexColors: true, fog: false, flatShading: true, side: DoubleSide });

let cityMat: MeshBasicMaterial | null = null;
/** Shahar siluetlari: yoritilmaydigan material — derazalar tekstura bilan yonib turadi */
function cityMaterial() {
  return (cityMat ??= new MeshBasicMaterial({ map: windowsTexture(), vertexColors: true, fog: false, side: DoubleSide }));
}

/** Siluet halqasining taxminiy radiusi (m) — deraza kataklari haqiqiy o'lchamga yaqin bo'lishi uchun */
const APPROX_R = 230;

/**
 * Tungi osmono'par binolar halqasi: ikki qator (uzoqda baland, yaqinda past), faqat ichkariga qaragan old yuza.
 * Tekstura — yonib turgan derazalar (qora fonda), vertex rang uzoqdagilarni xiralashtiradi.
 */
function buildCity(fog: Color) {
  const rng = createRng(4040);
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const quad = (a0: number, a1: number, r: number, h: number, c: Color, u0: number, v0: number) => {
    const p = (a: number, y: number) => [Math.sin(a) * r, y, Math.cos(a) * r];
    const w = (a1 - a0) * r * APPROX_R;
    const u1 = u0 + w / BAY / WINDOW_CELLS;
    const v1 = v0 + (h * APPROX_R) / FLOOR / WINDOW_CELLS;
    const verts = [
      [p(a0, 0), u0, v0],
      [p(a1, 0), u1, v0],
      [p(a1, h), u1, v1],
      [p(a0, 0), u0, v0],
      [p(a1, h), u1, v1],
      [p(a0, h), u0, v1],
    ] as const;
    for (const [xyz, u, v] of verts) {
      pos.push(xyz[0], xyz[1], xyz[2]);
      uv.push(u, v);
      col.push(c.r, c.g, c.b);
    }
  };
  for (const layer of [
    { r: 1, count: 120, hMin: 0.08, hMax: 0.34, dim: 0.55 },
    { r: 0.93, count: 90, hMin: 0.05, hMax: 0.16, dim: 0.85 },
  ]) {
    let a = 0;
    while (a < Math.PI * 2) {
      const w = ((Math.PI * 2) / layer.count) * (0.5 + rng());
      const h = layer.hMin + rng() ** 2 * (layer.hMax - layer.hMin);
      const c = new Color(1, 1, 1).multiplyScalar(layer.dim * (0.6 + rng() * 0.4)).lerp(fog, 0.15);
      quad(a, a + w, layer.r, h, c, Math.floor(rng() * 8) / 8, Math.floor(rng() * 8) / 8);
      a += w * (0.85 + rng() * 0.4);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  return geo;
}

/**
 * Tog' tizmalari: ikki qator (uzoq baland, yaqinroq past) uchburchak cho'qqilar. Har cho'qqi — ikki qirra
 * (old tomonga chiqqan qovurg'a bilan), cho'qqi uchi qor, etagi tuman rangiga aralashadi (havo perspektivasi).
 */
function buildPeaks(fog: Color, snowHex: string, rockHex: string) {
  const rng = createRng(77);
  const pos: number[] = [];
  const col: number[] = [];
  const snow = new Color(snowHex);
  const rock = new Color(rockHex);
  const tmp = new Color();
  const push = (a: number, r: number, y: number, c: Color) => {
    pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
    col.push(c.r, c.g, c.b);
  };

  for (const layer of [
    { r: 1, count: 34, hMin: 0.1, hMax: 0.26, haze: 0.35 },
    { r: 0.94, count: 46, hMin: 0.05, hMax: 0.13, haze: 0.2 },
  ]) {
    let a = rng() * 0.2;
    const step = (Math.PI * 2) / layer.count;
    for (let k = 0; k < layer.count; k++) {
      const w = step * (1.2 + rng() * 0.9);
      const a0 = a;
      const a1 = a + w;
      const am = a0 + w * (0.35 + rng() * 0.3);
      const h = layer.hMin + rng() * (layer.hMax - layer.hMin);
      const rockCol = tmp.copy(rock).lerp(fog, layer.haze).clone();
      const peakCol = h > 0.12 ? snow.clone().lerp(fog, layer.haze * 0.3) : rockCol;
      const baseCol = fog.clone().lerp(rock, 0.25);
      const ridgeCol = rockCol.clone().lerp(snow, h > 0.14 ? 0.35 : 0);
      // Qovurg'a (old tomonga chiqqan): cho'qqining yarmi balandlikda, radius ichkariroq — ikki qirra turli yoritiladi
      const fr = layer.r * 0.955;
      const fy = h * 0.45;
      // Chap qirra: etak-chap, qovurg'a, cho'qqi (ichkariga qaragan)
      push(a0, layer.r, 0, baseCol);
      push(am, layer.r, h, peakCol);
      push(am, fr, fy, ridgeCol);
      // O'ng qirra
      push(am, fr, fy, ridgeCol);
      push(am, layer.r, h, peakCol);
      push(a1, layer.r, 0, baseCol);
      // Qovurg'a etagi
      push(a0, layer.r, 0, baseCol);
      push(am, fr, fy, ridgeCol);
      push(am, fr * 0.99, 0, baseCol);
      push(am, fr * 0.99, 0, baseCol);
      push(am, fr, fy, ridgeCol);
      push(a1, layer.r, 0, baseCol);
      a += w * 0.7; // qo'shni cho'qqilar biroz ustma-ust — bo'shliq qolmasin
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  geo.computeVertexNormals();
  return geo;
}
