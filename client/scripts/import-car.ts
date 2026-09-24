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
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
}

const PACK = 'generic_passenger_car_pack.glb';
const CARS: CarSpec[] = [
  { id: 'rally', src: 'evo_rally_car.glb', skip: /^fire$/, glass: /^windows$/ },
  { id: 'sedan', src: PACK, body: 'Sedan Body', glass: /^Glass/ },
  { id: 'compact', src: PACK, body: 'Compact Body', glass: /^Glass/ },
  { id: 'coupe', src: PACK, body: 'Coupe Body', glass: /^Glass/, flip: true },
  { id: 'hatchback', src: PACK, body: 'Hatchback Body', glass: /^Glass/ },
  { id: 'minivan', src: PACK, body: 'minivan body', glass: /^Glass/ },
  { id: 'offroad', src: PACK, body: 'Offroad Body', glass: /^Glass/, flip: true },
  { id: 'pickup', src: PACK, body: 'Pickup Body', glass: /^Glass/ },
  { id: 'sport', src: PACK, body: 'Sport body', glass: /^Glass/ },
  { id: 'suv', src: PACK, body: 'SUV Body', glass: /^Glass/ },
  { id: 'wagon', src: PACK, body: 'Wagon Body', glass: /^Glass/ },
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
function compressImage(data: Buffer, name: string): Buffer {
  const src = join(tmp, `${name}.src`);
  const out = join(tmp, `${name}.jpg`);
  writeFileSync(src, data);
  execFileSync('sips', ['-Z', String(TEXTURE_SIZE), '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', src, '--out', out], { stdio: 'ignore' });
  return readFileSync(out);
}

// ───────────── Bitta mashina ─────────────

function importCar(spec: CarSpec, source: Source) {
  const { gltf } = source;
  const meshNodes = gltf.nodes.map((_, i) => i).filter((i) => gltf.nodes[i].mesh !== undefined);
  const isWheel = (i: number) => [i, ...source.ancestors(i)].some((k) => /wheel/i.test(gltf.nodes[k].name ?? ''));
  const skipped = (i: number) =>
    !!spec.skip && gltf.meshes[gltf.nodes[i].mesh!].primitives.every((p) => spec.skip!.test(gltf.materials[p.material ?? 0]?.name ?? ''));

  // Kuzov meshlari
  const bodyNode = spec.body ? gltf.nodes.findIndex((n) => n.name === spec.body) : -1;
  if (spec.body && bodyNode < 0) throw new Error(`${spec.id}: '${spec.body}' topilmadi`);
  const body = meshNodes.filter((i) => !isWheel(i) && !skipped(i) && (bodyNode < 0 || source.ancestors(i).includes(bodyNode)));
  const bodyBox = new Box3();
  body.forEach((i) => bodyBox.union(source.meshBox(i)));
  const bodyCenter = bodyBox.getCenter(new Vector3());
  const bodySize = bodyBox.getSize(new Vector3());

  // G'ildiraklar: g'ildirak tugunlari (guruh bo'yicha), kuzov markaziga yaqinlari
  const groups = new Map<number, number[]>();
  for (const i of meshNodes.filter((k) => isWheel(k) && !skipped(k))) {
    // Guruh — eng yuqoridagi 'wheel' tuguni (g'ildirak qopqog'i kabi ichki meshlar ham shu g'ildirakka tegishli)
    const g = [i, ...source.ancestors(i)].reverse().find((k) => /wheel/i.test(gltf.nodes[k].name ?? ''))!;
    groups.set(g, [...(groups.get(g) ?? []), i]);
  }
  const reach = Math.max(bodySize.x, bodySize.z) * 0.6;
  const wheels = [...groups.values()]
    .map((meshes) => {
      const box = new Box3();
      meshes.forEach((i) => box.union(source.meshBox(i)));
      return { meshes, box, center: box.getCenter(new Vector3()) };
    })
    .filter((w) => Math.hypot(w.center.x - bodyCenter.x, w.center.z - bodyCenter.z) < reach)
    .sort((a, b) => Math.hypot(a.center.x - bodyCenter.x, a.center.z - bodyCenter.z) - Math.hypot(b.center.x - bodyCenter.x, b.center.z - bodyCenter.z))
    .slice(0, 4);
  if (wheels.length !== 4) throw new Error(`${spec.id}: 4 ta g'ildirak topilmadi (${wheels.length})`);

  // Mashina o'qlari: g'ildiraklar markazlari bo'yicha uzunlik o'qi (eng katta tarqalish)
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
  for (const i of body) {
    const m = source.world(i);
    for (const p of gltf.meshes[gltf.nodes[i].mesh!].primitives) {
      if (!spec.glass.test(gltf.materials[p.material ?? 0]?.name ?? '')) continue;
      const pos = source.read(p.attributes.POSITION);
      const v = (k: number) => new Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).applyMatrix4(m);
      const idx = p.indices !== undefined ? source.read(p.indices) : Array.from({ length: pos.length / 3 }, (_, k) => k);
      for (let k = 0; k < idx.length; k += 3) {
        const a = v(idx[k]);
        ab.copy(v(idx[k + 1])).sub(a);
        ac.copy(v(idx[k + 2])).sub(a);
        glassDir.add(ab.cross(ac).multiplyScalar(m.determinant() < 0 ? -1 : 1));
      }
    }
  }
  const glassFwd = glassDir.dot(fwd);
  if (glassFwd < 0) fwd.negate();
  if (spec.flip) fwd.negate();
  const left = new Vector3(fwd.z, 0, -fwd.x);
  const ground = Math.min(...wheels.map((w) => w.box.min.y));

  const toCar = (p: Vector3) => {
    const d = p.clone().sub(mid);
    return [d.dot(left), p.y - ground, d.dot(fwd)];
  };

  // Yozish
  const w = new Writer();
  const materialMap = new Map<number, number>();
  const imageMap = new Map<number, number>();
  const material = (mi: number | undefined) => {
    const key = mi ?? -1;
    if (materialMap.has(key)) return materialMap.get(key)!;
    const src = mi !== undefined ? gltf.materials[mi] : {};
    const pbr = src.pbrMetallicRoughness ?? {};
    const name = spec.glass.test(src.name ?? '') ? 'glass' : (src.name ?? 'material').replace(/mitsubishi/i, 'body');
    const out: Record<string, unknown> = {
      name,
      pbrMetallicRoughness: { baseColorFactor: pbr.baseColorFactor ?? [1, 1, 1, 1], metallicFactor: 0.2, roughnessFactor: 0.5 },
    };
    if (pbr.baseColorTexture) {
      const img = gltf.textures[pbr.baseColorTexture.index].source;
      if (!imageMap.has(img)) {
        const view = w.view(compressImage(source.image(img), `${spec.id}-${img}`));
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

  const primitivesOf = (nodes: number[]) => {
    const prims: object[] = [];
    for (const i of nodes) {
      const m = source.world(i);
      for (const p of gltf.meshes[gltf.nodes[i].mesh!].primitives) {
        if (spec.skip?.test(gltf.materials[p.material ?? 0]?.name ?? '')) continue;
        const pos = source.read(p.attributes.POSITION);
        const positions: number[] = [];
        for (let k = 0; k < pos.length; k += 3) positions.push(...toCar(new Vector3(pos[k], pos[k + 1], pos[k + 2]).applyMatrix4(m)));
        const attributes: Record<string, number> = { POSITION: w.accessor(positions, 'VEC3') };
        // Normallar yozilmaydi (hajm ~40% kichik) — o'yin ularni yuklashda hisoblaydi (carGeometry bake)
        if (p.attributes.TEXCOORD_0 !== undefined) attributes.TEXCOORD_0 = w.accessor(source.read(p.attributes.TEXCOORD_0), 'VEC2');
        // Aylantirish oynaviy bo'lsa (det < 0) uchburchaklar tartibi teskari bo'ladi
        let idx = p.indices !== undefined ? source.read(p.indices) : Array.from({ length: pos.length / 3 }, (_, k) => k);
        if (m.determinant() < 0) {
          const flipped: number[] = [];
          for (let k = 0; k < idx.length; k += 3) flipped.push(idx[k], idx[k + 2], idx[k + 1]);
          idx = flipped;
        }
        prims.push({ attributes, indices: w.accessor(idx, 'SCALAR', true), material: material(p.material) });
      }
    }
    return prims;
  };

  const node = (name: string, meshNodesList: number[]) => {
    w.json.meshes.push({ name, primitives: primitivesOf(meshNodesList) });
    w.json.nodes.push({ name, mesh: w.json.meshes.length - 1 });
    return w.json.nodes.length - 1;
  };
  /** Faqat joyi kerak bo'lgan g'ildirak (o'yin geometriyani old-chapdan oladi): chegara qutisi — 12 uchburchak */
  const marker = (name: string, box: Box3) => {
    const lo = toCar(box.min);
    const hi = toCar(box.max);
    const [x0, x1] = [Math.min(lo[0], hi[0]), Math.max(lo[0], hi[0])];
    const [z0, z1] = [Math.min(lo[2], hi[2]), Math.max(lo[2], hi[2])];
    const [y0, y1] = [lo[1], hi[1]];
    const v = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
    const idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
    w.json.meshes.push({ name, primitives: [{ attributes: { POSITION: w.accessor(v, 'VEC3') }, indices: w.accessor(idx, 'SCALAR', true), material: material(undefined) }] });
    w.json.nodes.push({ name, mesh: w.json.meshes.length - 1 });
    return w.json.nodes.length - 1;
  };
  const roots = [node('body', body)];
  for (const wheel of wheels) {
    const [x, , z] = toCar(wheel.center);
    const name = `wheel${z > 0 ? 'Front' : 'Back'}${x > 0 ? 'Left' : 'Right'}`;
    roots.push(name === 'wheelFrontLeft' ? node(name, wheel.meshes) : marker(name, wheel.box));
  }
  const names = roots.slice(1).map((r) => (w.json.nodes[r] as { name: string }).name);
  if (new Set(names).size !== 4) throw new Error(`${spec.id}: g'ildirak joylari aniqlanmadi (${names.join(', ')})`);
  w.json.scenes.push({ nodes: roots });

  const file = join(MODEL_DIR, `${spec.id}.glb`);
  w.save(file);
  const size = readFileSync(file).length;
  const tris = body.length;
  console.log(
    `${spec.id.padEnd(10)} ${(size / 1024).toFixed(0).padStart(5)} KB  kuzov meshlari: ${tris}, tekstura: ${imageMap.size}, ` +
      `oyna normallari: ${glassFwd > 0 ? 'old' : 'orqa'} tomonga (${Math.abs(glassFwd).toFixed(3)})`,
  );
}

const sources = new Map<string, Source>();
for (const spec of CARS) {
  if (!sources.has(spec.src)) sources.set(spec.src, new Source(spec.src));
  importCar(spec, sources.get(spec.src)!);
}
