/**
 * Tashqi mashina modellarini (Sketchfab va h.k.) o'yin formatiga o'tkazish — bir martalik vosita:
 *   npm run import:cars -w client
 * Manba GLB'lar (katta, repo'ga kirmaydi, deploy'ga ham tushmasligi uchun public'dan tashqarida) — client/model-src/;
 * natija — client/public/model/<id>.glb.
 *
 * Har mashina uchun:
 *  - kerakli meshlar ajratiladi (bir faylda bir nechta mashina bo'lsa — kuzov tuguni va unga yaqin g'ildiraklar);
 *  - geometriya mashina koordinatalariga "pishiriladi": old +z, chap +x, tepa +y, g'ildiraklar pasti y = 0
 *    (o'yin masshtabni o'zi g'ildiraklar orasiga moslaydi — carGeometry.ts);
 *  - tugunlar o'yin kutgan nomlarda: body, wheelFrontLeft, wheelFrontRight, wheelBackLeft, wheelBackRight;
 *  - normallar yozilmaydi (o'yin hisoblaydi), teksturalar 512 px JPEG ga siqiladi (macOS `sips`), faqat asosiy rang teksturasi qoladi;
 *    oyna materiali nomi — 'glass' (bo'yoq tuningi unga tegmaydi).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';

const SRC_DIR = fileURLToPath(new URL('../model-src/', import.meta.url));
const MODEL_DIR = fileURLToPath(new URL('../public/model/', import.meta.url));
const TEXTURE_SIZE = 512;

interface CarSpec {
  id: string;
  src: string;
  /** Kuzov tuguni nomi (bir faylda bir nechta mashina); berilmasa — g'ildirak bo'lmagan barcha meshlar */
  body?: string;
  /** Tashlab yuboriladigan meshlar (materiali nomi bo'yicha) */
  skip?: RegExp;
  /** Old tomon teskari aniqlansa (o'yinda tekshirilgan: oyna usuli bu modellarda adashadi) — true */
  flip?: boolean;
  /** Oyna materiali (nomi 'glass' ga o'zgartiriladi) */
  glass: RegExp;
  /** Oyna regex'i aniq (fara/stop oynalarini ajratish shart emas) */
  glassStrict?: boolean;
  /**
   * G'ildiraklarni topish: 'nodes' (standart) — nomida "wheel" bo'lgan tugunlar; 'quadrant' — g'ildirak qismlari
   * (tire, rim, brake, caliper... tugun yoki material nomida) markazga nisbatan 4 chorakka bo'linadi
   */
  wheels?: 'nodes' | 'quadrant';
  /** Tekstura o'lchami (px); standart — TEXTURE_SIZE. Mayda teksturasi ko'p modellarda kichikroq */
  textureSize?: number;
}

/** Standart: oyna materiallari (fara/stop oynalari emas) */
const GLASS = /glass|window|windo_|luna|windshield/i;
const NOT_GLASS = /light|lamp|red|orange|amber|surr|led/i;
/** Standart: g'ildirak qismlari (tugun yoki material nomi bo'yicha) */
const WHEEL_PART = /tire|tyre|wheel|\brims?\b|rim[ ._]|rimbolt|rimlogo|rim_nut|brake(?!light)|disk|disc\b|caliper|calliper|volk/i;

const PACK = 'generic_passenger_car_pack.glb';
const CARS: CarSpec[] = [
  { id: 'rally', src: 'evo_rally_car.glb', skip: /^fire$/, glass: /^windows$/, glassStrict: true },
  { id: 'sedan', src: PACK, body: 'Sedan Body', glass: /^Glass/, glassStrict: true },
  { id: 'compact', src: PACK, body: 'Compact Body', glass: /^Glass/, glassStrict: true },
  { id: 'coupe', src: PACK, body: 'Coupe Body', glass: /^Glass/, glassStrict: true, flip: true },
  { id: 'hatchback', src: PACK, body: 'Hatchback Body', glass: /^Glass/, glassStrict: true },
  { id: 'minivan', src: PACK, body: 'minivan body', glass: /^Glass/, glassStrict: true },
  { id: 'offroad', src: PACK, body: 'Offroad Body', glass: /^Glass/, glassStrict: true, flip: true },
  { id: 'pickup', src: PACK, body: 'Pickup Body', glass: /^Glass/, glassStrict: true },
  { id: 'sport', src: PACK, body: 'Sport body', glass: /^Glass/, glassStrict: true },
  { id: 'suv', src: PACK, body: 'SUV Body', glass: /^Glass/, glassStrict: true },
  { id: 'wagon', src: PACK, body: 'Wagon Body', glass: /^Glass/, glassStrict: true },
  // Sketchfab giperkarlari (baland poligonli — soddalashtiriladi; g'ildiraklar choraklar bo'yicha)
  { id: 'f1lm', src: '1996_mclaren_f1_lm_-_patrol.glb', glass: GLASS, wheels: 'quadrant', textureSize: 256, flip: true },
  { id: 'f1', src: 'mclaren_f1.glb', glass: GLASS, wheels: 'quadrant', textureSize: 256, skip: /^(carshadow|floor|Back)$/ },
  { id: 'gtlm', src: '2006__ford_gt_lm_spec_ll_test_car.glb', glass: GLASS, wheels: 'quadrant', textureSize: 256, flip: true },
  { id: 'bolide', src: '2020_bugatti_bolide_concept.glb', glass: GLASS, wheels: 'quadrant', textureSize: 256, flip: true },
  { id: 'sf90', src: '2023_ferrari_sf90_xx_stradale.glb', glass: GLASS, wheels: 'quadrant', textureSize: 256 },
  { id: 'tourbillon', src: '2026_bugatti_tourbillon.glb', glass: GLASS, wheels: 'quadrant', textureSize: 256 },
  { id: 'pista', src: 'ferrari_488_pista_widebody.glb', glass: GLASS, wheels: 'quadrant', textureSize: 256 },
];

// ───────────── GLB o'qish ─────────────

interface Gltf {
  nodes: { name?: string; mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number }[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; componentType: number; type: string; min?: number[]; max?: number[] }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  materials: { name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index: number } } }[];
  textures: { source: number }[];
  images: { bufferView: number; mimeType: string }[];
}

class Source {
  gltf: Gltf;
  buf: Buffer;
  bin: number;
  parent = new Map<number, number>();
  constructor(file: string) {
    this.buf = readFileSync(join(SRC_DIR, file));
    const len = this.buf.readUInt32LE(12);
    this.gltf = JSON.parse(this.buf.toString('utf8', 20, 20 + len));
    this.bin = 20 + len + 8;
    this.gltf.nodes.forEach((n, i) => n.children?.forEach((c) => this.parent.set(c, i)));
  }
  local(i: number) {
    const n = this.gltf.nodes[i];
    if (n.matrix) return new Matrix4().fromArray(n.matrix);
    return new Matrix4().compose(
      new Vector3(...((n.translation ?? [0, 0, 0]) as [number, number, number])),
      new Quaternion(...((n.rotation ?? [0, 0, 0, 1]) as [number, number, number, number])),
      new Vector3(...((n.scale ?? [1, 1, 1]) as [number, number, number])),
    );
  }
  world(i: number) {
    const m = this.local(i);
    for (let k = i; this.parent.has(k); ) {
      k = this.parent.get(k)!;
      m.premultiply(this.local(k));
    }
    return m;
  }
  ancestors(i: number) {
    const out: number[] = [];
    for (let k = i; this.parent.has(k); ) out.push((k = this.parent.get(k)!));
    return out;
  }
  /** Accessor qiymatlari (float yoki indeks) tekis massivda */
  read(acc: number): number[] {
    const a = this.gltf.accessors[acc];
    const bv = this.gltf.bufferViews[a.bufferView];
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] ?? 1;
    const size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType]!;
    const stride = bv.byteStride ?? comps * size;
    const off = this.bin + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out: number[] = [];
    for (let i = 0; i < a.count; i++) {
      for (let c = 0; c < comps; c++) {
        const o = off + i * stride + c * size;
        out.push(
          a.componentType === 5126
            ? this.buf.readFloatLE(o)
            : a.componentType === 5125
              ? this.buf.readUInt32LE(o)
              : a.componentType === 5123
                ? this.buf.readUInt16LE(o)
                : this.buf.readUInt8(o),
        );
      }
    }
    return out;
  }
  image(i: number): Buffer {
    const bv = this.gltf.bufferViews[this.gltf.images[i].bufferView];
    const off = this.bin + (bv.byteOffset ?? 0);
    return this.buf.subarray(off, off + bv.byteLength);
  }
  meshBox(i: number) {
    const box = new Box3();
    const m = this.world(i);
    for (const p of this.gltf.meshes[this.gltf.nodes[i].mesh!].primitives) {
      const a = this.gltf.accessors[p.attributes.POSITION];
      box.union(new Box3(new Vector3(...(a.min as [number, number, number])), new Vector3(...(a.max as [number, number, number]))).applyMatrix4(m));
    }
    return box;
  }
}

// ───────────── GLB yozish ─────────────

type List = object[];
interface GltfOut {
  asset: object;
  scene: number;
  scenes: List;
  nodes: List;
  meshes: List;
  accessors: List;
  bufferViews: List;
  materials: List;
  textures: List;
  images: List;
  samplers: List;
  buffers?: List;
}

class Writer {
  json: GltfOut = {
    asset: { version: '2.0', generator: 'adventure-racer import-car' },
    scene: 0,
    scenes: [],
    nodes: [],
    meshes: [],
    accessors: [],
    bufferViews: [],
    materials: [],
    textures: [],
    images: [],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
  };
  chunks: Buffer[] = [];
  length = 0;

  view(data: Buffer, target?: number) {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) this.push(Buffer.alloc(pad));
    this.json.bufferViews.push({ buffer: 0, byteOffset: this.length, byteLength: data.length, ...(target && { target }) });
    this.push(data);
    return this.json.bufferViews.length - 1;
  }
  private push(b: Buffer) {
    this.chunks.push(b);
    this.length += b.length;
  }
  accessor(values: number[], type: 'VEC2' | 'VEC3' | 'SCALAR', index = false) {
    const buf = Buffer.alloc(values.length * 4);
    values.forEach((v, i) => (index ? buf.writeUInt32LE(v, i * 4) : buf.writeFloatLE(v, i * 4)));
    const view = this.view(buf, index ? 34963 : 34962);
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type];
    const acc: Record<string, unknown> = { bufferView: view, componentType: index ? 5125 : 5126, count: values.length / comps, type };
    if (type === 'VEC3') {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < values.length; i += 3) {
        for (let c = 0; c < 3; c++) {
          min[c] = Math.min(min[c], values[i + c]);
          max[c] = Math.max(max[c], values[i + c]);
        }
      }
      Object.assign(acc, { min, max });
    }
    this.json.accessors.push(acc);
    return this.json.accessors.length - 1;
  }
  save(file: string) {
    const bin = Buffer.concat(this.chunks);
    const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
    this.json.buffers = [{ byteLength: binPad.length }];
    let js = Buffer.from(JSON.stringify(this.json));
    js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + js.length + 8 + binPad.length, 8);
    const jh = Buffer.alloc(8);
    jh.writeUInt32LE(js.length, 0);
    jh.writeUInt32LE(0x4e4f534a, 4);
    const bh = Buffer.alloc(8);
    bh.writeUInt32LE(binPad.length, 0);
    bh.writeUInt32LE(0x004e4942, 4);
    writeFileSync(file, Buffer.concat([header, jh, js, bh, binPad]));
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'import-car-'));
function compressImage(data: Buffer, name: string, size = TEXTURE_SIZE): Buffer {
  const src = join(tmp, `${name}.src`);
  const out = join(tmp, `${name}.jpg`);
  writeFileSync(src, data);
  execFileSync('sips', ['-Z', String(size), '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', src, '--out', out], { stdio: 'ignore' });
  return readFileSync(out);
}

// ───────────── Bitta mashina ─────────────

/** Uchburchaklar to'plami (material bo'yicha): pozitsiyalar dunyo koordinatalarida, indekslar tartibi to'g'rilangan */
interface Soup {
  pos: number[];
  uv: number[] | null;
  idx: number[];
}
type Soups = Map<number, Soup>;


/** Kuzov va g'ildirak uchun uchburchaklar byudjeti (soddalashtirish — meshoptimizer) */
const BODY_TRIS = 22000;
const WHEEL_TRIS = 2500;

function soupTris(soups: Soups) {
  let n = 0;
  for (const s of soups.values()) n += s.idx.length / 3;
  return n;
}

/**
 * Bir xil pozitsiyadagi uchlarni birlashtirish (Sketchfab bo'laklari alohida — soddalashtirish chetlarni qotirib qo'yardi).
 * Aniqlik model o'lchamiga nisbiy (ba'zi modellar juda mayda birliklarda: butun mashina ~0.02)
 */
function weld(soup: Soup): Soup {
  let span = 0;
  for (let k = 0; k < soup.pos.length; k += 3) span = Math.max(span, Math.abs(soup.pos[k]), Math.abs(soup.pos[k + 1]), Math.abs(soup.pos[k + 2]));
  const q = 1e5 / Math.max(span, 1e-9);
  const map = new Map<string, number>();
  const out: Soup = { pos: [], uv: soup.uv ? [] : null, idx: [] };
  const remap: number[] = [];
  for (let v = 0; v < soup.pos.length / 3; v++) {
    const key = `${Math.round(soup.pos[v * 3] * q)},${Math.round(soup.pos[v * 3 + 1] * q)},${Math.round(soup.pos[v * 3 + 2] * q)}`;
    let k = map.get(key);
    if (k === undefined) {
      k = map.size;
      map.set(key, k);
      out.pos.push(soup.pos[v * 3], soup.pos[v * 3 + 1], soup.pos[v * 3 + 2]);
      if (soup.uv && out.uv) out.uv.push(soup.uv[v * 2], soup.uv[v * 2 + 1]);
    }
    remap[v] = k;
  }
  for (let i = 0; i < soup.idx.length; i += 3) {
    const [a, b, c] = [remap[soup.idx[i]], remap[soup.idx[i + 1]], remap[soup.idx[i + 2]]];
    if (a !== b && b !== c && a !== c) out.idx.push(a, b, c);
  }
  return out;
}

/**
 * Soddalashtirish (kerak bo'lsa) va ishlatilmagan uchlarni tashlab yuborish. Avval topologiyani saqlaydigan
 * simplify (xato chegarasi oshib boradi), byudjetga yetmasa — "sloppy" (topologiyaga qaramaydi, aniq yetadi).
 */
function simplify(input: Soup, ratio: number): Soup {
  const soup = ratio < 1 ? weld(input) : input;
  let idx: Uint32Array = Uint32Array.from(soup.idx);
  if (ratio < 1 && idx.length > 300) {
    const pos = Float32Array.from(soup.pos);
    const target = Math.max(3, Math.floor((soup.idx.length / 3) * ratio)) * 3;
    for (const err of [0.01, 0.05, 0.2]) {
      idx = MeshoptSimplifier.simplify(Uint32Array.from(soup.idx), pos, 3, target, err)[0] as Uint32Array;
      if (idx.length <= target * 1.2) break;
    }
    if (idx.length > target * 1.2) idx = MeshoptSimplifier.simplifySloppy(idx, pos, 3, null, target, 0.2)[0] as Uint32Array;
  }
  const remap = new Map<number, number>();
  const out: Soup = { pos: [], uv: soup.uv ? [] : null, idx: [] };
  for (const v of idx) {
    let k = remap.get(v);
    if (k === undefined) {
      k = remap.size;
      remap.set(v, k);
      out.pos.push(soup.pos[v * 3], soup.pos[v * 3 + 1], soup.pos[v * 3 + 2]);
      if (soup.uv && out.uv) out.uv.push(soup.uv[v * 2], soup.uv[v * 2 + 1]);
    }
    out.idx.push(k);
  }
  return out;
}

function importCar(spec: CarSpec, source: Source) {
  const { gltf } = source;
  const glassRe = spec.glass;
  const isGlass = (name: string) => glassRe.test(name) && (spec.glassStrict || !NOT_GLASS.test(name));
  const meshNodes = gltf.nodes.map((_, i) => i).filter((i) => gltf.nodes[i].mesh !== undefined);
  const matName = (m: number | undefined) => gltf.materials[m ?? 0]?.name ?? '';
  const skipPrim = (m: number | undefined) => !!spec.skip?.test(matName(m));
  const chain = (i: number) => [i, ...source.ancestors(i)].map((k) => gltf.nodes[k].name ?? '');

  // Kuzov tuguni (bir faylda bir nechta mashina)
  const bodyNode = spec.body ? gltf.nodes.findIndex((n) => n.name === spec.body) : -1;
  if (spec.body && bodyNode < 0) throw new Error(`${spec.id}: '${spec.body}' topilmadi`);

  /** Primitivni to'plamga qo'shish (dunyo koordinatalarida) */
  const addPrim = (soups: Soups, i: number, p: Gltf['meshes'][number]['primitives'][number], keep?: (a: Vector3, b: Vector3, c: Vector3) => boolean) => {
    const m = source.world(i);
    const flip = m.determinant() < 0;
    const pos = source.read(p.attributes.POSITION);
    const uv = p.attributes.TEXCOORD_0 !== undefined ? source.read(p.attributes.TEXCOORD_0) : null;
    const idx = p.indices !== undefined ? source.read(p.indices) : Array.from({ length: pos.length / 3 }, (_, k) => k);
    const world: Vector3[] = [];
    for (let k = 0; k < pos.length; k += 3) world.push(new Vector3(pos[k], pos[k + 1], pos[k + 2]).applyMatrix4(m));
    const key = p.material ?? -1;
    let soup = soups.get(key);
    if (!soup) soups.set(key, (soup = { pos: [], uv: uv ? [] : null, idx: [] }));
    // Bir materialda uv bor/yo'q aralash bo'lsa — uv nolga to'ldiriladi
    if (!soup.uv && uv && soup.pos.length) soup.uv = new Array((soup.pos.length / 3) * 2).fill(0);
    const base = soup.pos.length / 3;
    for (const v of world) soup.pos.push(v.x, v.y, v.z);
    if (soup.uv) for (let k = 0; k < world.length * 2; k++) soup.uv.push(uv ? uv[k] : 0);
    for (let k = 0; k < idx.length; k += 3) {
      const [a, b, c] = [idx[k], idx[k + 1], idx[k + 2]];
      if (keep && !keep(world[a], world[b], world[c])) continue;
      soup.idx.push(base + a, base + (flip ? c : b), base + (flip ? b : c));
    }
  };

  // ── G'ildiraklar va kuzov ──
  const body: Soups = new Map();
  let wheels: { soups: Soups; box: Box3; center: Vector3 }[];
  const inCar = (i: number) => bodyNode < 0 || source.ancestors(i).includes(bodyNode);

  if (spec.wheels === 'quadrant') {
    // G'ildirak qismlari nomi bo'yicha, 4 g'ildirak — markazga nisbatan choraklar bo'yicha (bitta meshda bo'lsa ham)
    const wheelPrims: [number, Gltf['meshes'][number]['primitives'][number]][] = [];
    for (const i of meshNodes) {
      if (!inCar(i)) continue;
      const nodeWheel = chain(i).some((n) => WHEEL_PART.test(n));
      for (const p of gltf.meshes[gltf.nodes[i].mesh!].primitives) {
        if (skipPrim(p.material)) continue;
        if (nodeWheel || WHEEL_PART.test(matName(p.material))) wheelPrims.push([i, p]);
        else addPrim(body, i, p);
      }
    }
    const all: Soups = new Map();
    for (const [i, p] of wheelPrims) addPrim(all, i, p);
    const box = new Box3();
    for (const s of all.values()) for (let k = 0; k < s.pos.length; k += 3) box.expandByPoint(new Vector3(s.pos[k], s.pos[k + 1], s.pos[k + 2]));
    const c = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const alongX = size.x > size.z;
    const quadrant = (a: Vector3, b: Vector3, d: Vector3) => {
      const x = (a.x + b.x + d.x) / 3 - c.x;
      const z = (a.z + b.z + d.z) / 3 - c.z;
      return alongX ? (x > 0 ? 1 : 0) * 2 + (z > 0 ? 1 : 0) : (z > 0 ? 1 : 0) * 2 + (x > 0 ? 1 : 0);
    };
    wheels = [0, 1, 2, 3].map((q) => {
      const soups: Soups = new Map();
      for (const [i, p] of wheelPrims) addPrim(soups, i, p, (a, b, d) => quadrant(a, b, d) === q);
      const wb = new Box3();
      for (const s of soups.values()) for (const k of s.idx) wb.expandByPoint(new Vector3(s.pos[k * 3], s.pos[k * 3 + 1], s.pos[k * 3 + 2]));
      return { soups, box: wb, center: wb.getCenter(new Vector3()) };
    });
    if (wheels.some((w) => w.box.isEmpty())) throw new Error(`${spec.id}: g'ildirak qismlari topilmadi`);
  } else {
    // Nomli g'ildirak tugunlari (guruh — eng yuqoridagi 'wheel' tuguni), kuzov markaziga eng yaqin 4 tasi
    const isWheel = (i: number) => chain(i).some((n) => /wheel/i.test(n));
    for (const i of meshNodes) {
      if (!isWheel(i) && inCar(i)) for (const p of gltf.meshes[gltf.nodes[i].mesh!].primitives) if (!skipPrim(p.material)) addPrim(body, i, p);
    }
    const bb = new Box3();
    for (const s of body.values()) for (let k = 0; k < s.pos.length; k += 3) bb.expandByPoint(new Vector3(s.pos[k], s.pos[k + 1], s.pos[k + 2]));
    const bc = bb.getCenter(new Vector3());
    const bs = bb.getSize(new Vector3());
    const groups = new Map<number, number[]>();
    for (const i of meshNodes.filter(isWheel)) {
      const g = [i, ...source.ancestors(i)].reverse().find((k) => /wheel/i.test(gltf.nodes[k].name ?? ''))!;
      groups.set(g, [...(groups.get(g) ?? []), i]);
    }
    const reach = Math.max(bs.x, bs.z) * 0.6;
    wheels = [...groups.values()]
      .map((nodes) => {
        const soups: Soups = new Map();
        for (const i of nodes) for (const p of gltf.meshes[gltf.nodes[i].mesh!].primitives) if (!skipPrim(p.material)) addPrim(soups, i, p);
        const box = new Box3();
        nodes.forEach((i) => box.union(source.meshBox(i)));
        return { soups, box, center: box.getCenter(new Vector3()) };
      })
      .filter((w) => Math.hypot(w.center.x - bc.x, w.center.z - bc.z) < reach)
      .sort((a, b) => Math.hypot(a.center.x - bc.x, a.center.z - bc.z) - Math.hypot(b.center.x - bc.x, b.center.z - bc.z))
      .slice(0, 4);
  }
  if (wheels.length !== 4) throw new Error(`${spec.id}: 4 ta g'ildirak topilmadi (${wheels.length})`);

  // ── Mashina o'qlari: g'ildiraklar markazlari bo'yicha uzunlik o'qi (eng katta tarqalish) ──
  const mid = wheels.reduce((v, w) => v.add(w.center), new Vector3()).multiplyScalar(1 / 4);
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const w of wheels) {
    const dx = w.center.x - mid.x;
    const dz = w.center.z - mid.z;
    sxx += dx * dx;
    szz += dz * dz;
    sxz += dx * dz;
  }
  const angle = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const fwd = new Vector3(Math.cos(angle), 0, Math.sin(angle));
  // Old tomon: old oyna orqa oynadan katta — oyna uchburchaklarining maydon bo'yicha normallari yig'indisi oldinga qaraydi.
  // Noto'g'ri chiqsa — spec.flip
  const glassDir = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  for (const [mi, s] of body) {
    if (!isGlass(matName(mi))) continue;
    const v = (k: number) => new Vector3(s.pos[k * 3], s.pos[k * 3 + 1], s.pos[k * 3 + 2]);
    for (let k = 0; k < s.idx.length; k += 3) {
      const a = v(s.idx[k]);
      ab.copy(v(s.idx[k + 1])).sub(a);
      ac.copy(v(s.idx[k + 2])).sub(a);
      glassDir.add(ab.cross(ac));
    }
  }
  const glassFwd = glassDir.dot(fwd);
  if (glassFwd < 0) fwd.negate();
  if (spec.flip) fwd.negate();
  const left = new Vector3(fwd.z, 0, -fwd.x);
  const ground = Math.min(...wheels.map((w) => w.box.min.y));
  const toCar = (x: number, y: number, z: number) => {
    const dx = x - mid.x;
    const dz = z - mid.z;
    return [dx * left.x + dz * left.z, y - ground, dx * fwd.x + dz * fwd.z];
  };

  // ── Yozish ──
  const w = new Writer();
  const materialMap = new Map<number, number>();
  const imageMap = new Map<number, number>();
  const material = (mi: number | undefined) => {
    const key = mi ?? -1;
    if (materialMap.has(key)) return materialMap.get(key)!;
    const src = mi !== undefined && mi >= 0 ? gltf.materials[mi] : {};
    const pbr = src.pbrMetallicRoughness ?? {};
    const name = isGlass(src.name ?? '') ? 'glass' : (src.name ?? 'material').replace(/mitsubishi/i, 'body');
    const out: Record<string, unknown> = {
      name,
      pbrMetallicRoughness: { baseColorFactor: pbr.baseColorFactor ?? [1, 1, 1, 1], metallicFactor: 0.2, roughnessFactor: 0.5 },
    };
    if (pbr.baseColorTexture) {
      const img = gltf.textures[pbr.baseColorTexture.index].source;
      if (!imageMap.has(img)) {
        const view = w.view(compressImage(source.image(img), `${spec.id}-${img}`, spec.textureSize));
        w.json.images.push({ bufferView: view, mimeType: 'image/jpeg' });
        w.json.textures.push({ sampler: 0, source: w.json.images.length - 1 });
        imageMap.set(img, w.json.textures.length - 1);
      }
      (out.pbrMetallicRoughness as Record<string, unknown>).baseColorTexture = { index: imageMap.get(img) };
    }
    w.json.materials.push(out);
    materialMap.set(key, w.json.materials.length - 1);
    return w.json.materials.length - 1;
  };

  let written = 0;
  /** Material bo'yicha to'plamlar → soddalashtirilgan primitivlar (mashina koordinatalarida) */
  const node = (name: string, soups: Soups, budget: number) => {
    const ratio = Math.min(1, budget / Math.max(1, soupTris(soups)));
    const prims: object[] = [];
    for (const [mi, raw] of soups) {
      if (!raw.idx.length) continue;
      const s = simplify(raw, ratio);
      if (!s.idx.length) continue;
      const positions: number[] = [];
      for (let k = 0; k < s.pos.length; k += 3) positions.push(...toCar(s.pos[k], s.pos[k + 1], s.pos[k + 2]));
      // Normallar yozilmaydi (hajm ~40% kichik) — o'yin ularni yuklashda hisoblaydi (carGeometry bake)
      const attributes: Record<string, number> = { POSITION: w.accessor(positions, 'VEC3') };
      if (s.uv) attributes.TEXCOORD_0 = w.accessor(s.uv, 'VEC2');
      prims.push({ attributes, indices: w.accessor(s.idx, 'SCALAR', true), material: material(mi < 0 ? undefined : mi) });
      written += s.idx.length / 3;
    }
    w.json.meshes.push({ name, primitives: prims });
    w.json.nodes.push({ name, mesh: w.json.meshes.length - 1 });
    return w.json.nodes.length - 1;
  };
  /** Faqat joyi kerak bo'lgan g'ildirak (o'yin geometriyani old-chapdan oladi): chegara qutisi — 12 uchburchak */
  const marker = (name: string, box: Box3) => {
    const lo = toCar(box.min.x, box.min.y, box.min.z);
    const hi = toCar(box.max.x, box.max.y, box.max.z);
    const [x0, x1] = [Math.min(lo[0], hi[0]), Math.max(lo[0], hi[0])];
    const [z0, z1] = [Math.min(lo[2], hi[2]), Math.max(lo[2], hi[2])];
    const [y0, y1] = [lo[1], hi[1]];
    const v = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
    const idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
    w.json.meshes.push({ name, primitives: [{ attributes: { POSITION: w.accessor(v, 'VEC3') }, indices: w.accessor(idx, 'SCALAR', true), material: material(undefined) }] });
    w.json.nodes.push({ name, mesh: w.json.meshes.length - 1 });
    return w.json.nodes.length - 1;
  };
  const sourceTris = soupTris(body) + wheels.reduce((n, wh) => n + soupTris(wh.soups), 0);
  const roots = [node('body', body, BODY_TRIS)];
  for (const wheel of wheels) {
    const [x, , z] = toCar(wheel.center.x, wheel.center.y, wheel.center.z);
    const name = `wheel${z > 0 ? 'Front' : 'Back'}${x > 0 ? 'Left' : 'Right'}`;
    roots.push(name === 'wheelFrontLeft' ? node(name, wheel.soups, WHEEL_TRIS) : marker(name, wheel.box));
  }
  const names = roots.slice(1).map((r) => (w.json.nodes[r] as { name: string }).name);
  if (new Set(names).size !== 4) throw new Error(`${spec.id}: g'ildirak joylari aniqlanmadi (${names.join(', ')})`);
  w.json.scenes.push({ nodes: roots });

  const file = join(MODEL_DIR, `${spec.id}.glb`);
  w.save(file);
  const size = readFileSync(file).length;
  console.log(
    `${spec.id.padEnd(10)} ${(size / 1024).toFixed(0).padStart(5)} KB  uchburchak: ${sourceTris} → ${written}, tekstura: ${imageMap.size}, ` +
      `oyna: ${glassFwd > 0 ? 'old' : 'orqa'} tomonga (${Math.abs(glassFwd).toFixed(3)})`,
  );
}

// Faqat berilgan id'lar (argumentlar) yoki manba fayli mavjud barcha mashinalar
await MeshoptSimplifier.ready;
const only = process.argv.slice(2);
const sources = new Map<string, Source>();
for (const spec of CARS) {
  if (only.length && !only.includes(spec.id)) continue;
  if (!existsSync(join(SRC_DIR, spec.src))) {
    console.log(`${spec.id.padEnd(10)} o'tkazib yuborildi: ${spec.src} yo'q (model-src/)`);
    continue;
  }
  if (!sources.has(spec.src)) sources.set(spec.src, new Source(spec.src));
  importCar(spec, sources.get(spec.src)!);
}
