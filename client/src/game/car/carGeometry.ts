import { useMemo } from 'react';
import {
  BufferAttribute,
  Box3,
  CanvasTexture,
  ClampToEdgeWrapping,
  SRGBColorSpace,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Mesh,
  type Object3D,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGLTF } from '@react-three/drei';
import { CAR, CARS, type CarId } from '@game/shared';
import { useCarChoice } from '../../store/carChoice';
import { withCarEnv } from './carEnv';

/**
 * Mashina modellari (client/public/model/, ro'yxat: CARS) — teksturali (rang teksturadan, uv saqlanadi; bir nechta
 * tekstura bo'lsa — atlasga yig'iladi; bo'yoq tuningi teksturani qayta bo'yaydi — tuningParts.ts).
 * Yuklangandan keyin bo'laklar birlashtiriladi (kam draw call):
 *  - body:  butun korpus (1 draw call)
 *  - wheel: bitta g'ildirak, markazi koordinata boshida, o'qi X bo'ylab, disk +X tomonda
 * Teksturasiz (vertex rangli) model ham ishlaydi — unda bo'yoq uchun korpus bodyRest + paint ga bo'linadi.
 * Model fizikaga moslanadi: g'ildiraklar orasi (old-orqa) = CAR.WHEEL_POSITIONS; g'ildiraklar asl proporsiyada,
 * kichik g'ildirak yerga tegishi uchun mashina wheelDrop ga pastlashtiriladi.
 * Fizika (collider, g'ildirak ulanish nuqtalari) o'zgarmaydi — bu faqat vizual.
 */

const carDef = (car: CarId) => CARS.find((c) => c.id === car)!;
const modelUrl = (car: CarId) => `${import.meta.env.BASE_URL}model/${carDef(car).model}`;

/** Tinch holatda g'ildirak markazi shassiga nisbatan (RemoteCars dagi taxmin bilan bir xil) */
export const WHEEL_REST_Y = CAR.WHEEL_POSITIONS[0][1] - CAR.SUSPENSION_REST_LENGTH * 0.55;

export interface CarModel {
  body: BufferGeometry;
  wheel: BufferGeometry;
  /** Korpusning bo'yoq qismi va qolgani (shina, oyna) */
  paint: BufferGeometry;
  bodyRest: BufferGeometry;
  /** Korpus va g'ildirak materiallari (Kenney — umumiy vertex-rangli, teksturali — o'z materiali) */
  bodyMaterial: MeshStandardMaterial;
  wheelMaterial: MeshStandardMaterial;
  /** Teksturali model: asl rang teksturasi (bir nechta bo'lsa — atlas; bo'yoq tuningi uni qayta bo'yaydi) */
  texture: Texture | null;
  /** Teksturada kuzov bo'yog'i joylashgan qism (uv: u0, v0, u1, v1) — qayta bo'yash faqat shu yerda */
  paintRect: [number, number, number, number];
  /** Vizual g'ildiraklar fizika nuqtasidan shuncha pastda (asl proporsiyadagi kichik g'ildiraklar yerga tegishi uchun) */
  wheelDrop: number;
  /** Korpus chegaralari (mashina lokal koordinatalarida) — spoyler va neon joylashuvi uchun */
  bounds: Box3;
  /** Vizual g'ildiraklarning X masofasi (model proporsiyasi bo'yicha; fizika nuqtalaridan torroq) */
  wheelX: number;
}

/**
 * Node nomidan qism: 'body' yoki 'wheelFrontLeft' va h.k. Kenney nomlari (body, wheelFrontLeft) va boshqa
 * modellardagi nomlar (…_Body, …_Glass, …_Wheel_FL) bir xil ko'rinishga keltiriladi.
 */
function canonicalPart(name: string): string {
  if (/^(body|wheel(Front|Back)(Left|Right))$/.test(name)) return name;
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  const wheel = /wheel(frontleft|frontright|backleft|backright|rearleft|rearright|fl|fr|rl|rr|bl|br)$/.exec(n);
  if (wheel) {
    const w = wheel[1];
    const front = w.startsWith('f');
    const left = w.endsWith('left') || w.endsWith('l');
    return `wheel${front ? 'Front' : 'Back'}${left ? 'Left' : 'Right'}`;
  }
  if (/(body|glass|chassis)$/.test(n)) return 'body';
  return '';
}

/** Mesh qaysi qismga tegishli (eng yaqin nomli ota-node) */
function partName(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) {
    const part = canonicalPart(p.name);
    if (part) return part;
  }
  return '';
}

/** Bo'yalmaydigan materiallar (qolgani — korpus bo'yog'i yoki g'ildirak diski) */
const FIXED_MATERIALS = ['carTire', 'glass'];
const isFixed = (m: Mesh) => FIXED_MATERIALS.includes((m.material as MeshStandardMaterial).name);
const textureOf = (m: Mesh) => (m.material as MeshStandardMaterial).map;

/** Teksturani atlasdagi katakka o'tkazish: (u, v) → (u', v'); teksturasiz qism uchun — oq katak */
type UvMap = (mesh: Mesh) => ((u: number, v: number) => [number, number]) | null;

/**
 * Dunyo koordinatalariga o'tkazilgan, indekssiz, material rangidagi vertex rangli nusxa.
 * `keepUv` — teksturali model: uv saqlanadi (teksturasiz qismlarga nol uv, rangni vertex rang beradi);
 * `uvMap` — bir nechta teksturali model: uv atlasdagi katakka o'tkaziladi.
 */
function bake(mesh: Mesh, extra: Matrix4, keepUv: boolean, uvMap?: UvMap) {
  let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(extra);
  // Ba'zi modellarda (masalan, obj2gltf eksporti) normallar yo'q — yorug'liksiz qop-qora chiqardi.
  // Indekslangan holda hisoblanadi: umumiy uchlarda silliq soyalanish
  if (!g.attributes.normal) g.computeVertexNormals();
  if (g.index) g = g.toNonIndexed();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && !(keepUv && name === 'uv')) g.deleteAttribute(name);
  }
  const count = g.attributes.position.count;
  if (keepUv && (!g.attributes.uv || !textureOf(mesh))) g.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2));
  const remap = uvMap?.(mesh);
  if (remap) {
    const uv = g.attributes.uv;
    for (let i = 0; i < count; i++) {
      const [u, v] = remap(uv.getX(i), uv.getY(i));
      uv.setXY(i, u, v);
    }
  }
  const c = (mesh.material as MeshStandardMaterial).color;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

function merge(parts: BufferGeometry[]) {
  const g = mergeGeometries(parts)!;
  g.computeBoundingSphere();
  return g;
}

function buildCarModel(scene: Object3D): CarModel {
  scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  scene.traverse((o) => void ((o as Mesh).isMesh && meshes.push(o as Mesh)));

  const box = new Box3();
  const centerOf = (name: string) => {
    box.makeEmpty();
    for (const m of meshes) if (partName(m) === name) box.expandByObject(m);
    return { center: box.getCenter(new Vector3()), size: box.getSize(new Vector3()) };
  };
  const fl = centerOf('wheelFrontLeft');
  const fr = centerOf('wheelFrontRight');
  const rl = centerOf('wheelBackLeft');

  // Masshtab: modelning old-orqa g'ildiraklar orasi fizikadagiga teng bo'lsin
  const physFrontZ = CAR.WHEEL_POSITIONS[0][2];
  const physBackZ = CAR.WHEEL_POSITIONS[2][2];
  const scale = (physFrontZ - physBackZ) / (fl.center.z - rl.center.z);
  // G'ildirak modeldagi asl proporsiyada (fizika radiusiga cho'zilmaydi)
  const wheelScale = scale;
  // Kichik g'ildirak yerga tegishi uchun butun mashina (korpus va g'ildiraklar) shuncha pastga tushiriladi
  const wheelDrop = CAR.WHEEL_RADIUS - (fl.size.y / 2) * wheelScale;
  // Model o'qlari markazini fizika g'ildiraklari markaziga (tinch holatda) ko'chirish
  const modelMid = new Vector3((fl.center.x + fr.center.x) / 2, fl.center.y, (fl.center.z + rl.center.z) / 2);
  const physMid = new Vector3(0, WHEEL_REST_Y - wheelDrop, (physFrontZ + physBackZ) / 2);
  const bodyFit = new Matrix4()
    .makeTranslation(physMid.x, physMid.y, physMid.z)
    .multiply(new Matrix4().makeScale(scale, scale, scale))
    .multiply(new Matrix4().makeTranslation(-modelMid.x, -modelMid.y, -modelMid.z));

  // G'ildirak: old-chap g'ildirak markazga keltiriladi
  const wheelFit = new Matrix4()
    .makeScale(wheelScale, wheelScale, wheelScale)
    .multiply(new Matrix4().makeTranslation(-fl.center.x, -fl.center.y, -fl.center.z));

  // Teksturali model: g'ildirak ham teksturada — disk alohida bo'yalmaydi. Bir nechta tekstura bo'lsa — atlasga
  // yig'iladi (bitta material, bitta draw call; bo'yoq tuningi ham bitta teksturada ishlaydi)
  const textures = [...new Set(meshes.map(textureOf).filter((t): t is Texture => !!t))];
  const atlas = textures.length > 1 ? buildAtlas(textures) : null;
  const texture = atlas?.texture ?? textures[0] ?? null;
  const textured = texture !== null;
  const uvMap: UvMap | undefined = atlas ? (m) => atlas.map(textureOf(m)) : undefined;
  // Kuzov bo'yog'i — eng katta bo'yaladigan meshning teksturasida
  const paintMesh = meshes
    .filter((m) => partName(m) === 'body' && !isFixed(m) && textureOf(m))
    .sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
  const paintRect = (paintMesh && atlas?.rect(textureOf(paintMesh)!)) || ([0, 0, 1, 1] as [number, number, number, number]);

  const paint: BufferGeometry[] = [];
  const bodyRest: BufferGeometry[] = [];
  const wheel: BufferGeometry[] = [];
  for (const m of meshes) {
    const part = partName(m);
    if (part === 'body') (isFixed(m) ? bodyRest : paint).push(bake(m, bodyFit, textured, uvMap));
    else if (part === 'wheelFrontLeft') wheel.push(bake(m, wheelFit, textured, uvMap));
  }
  if (!paint.length || !bodyRest.length || !wheel.length) {
    throw new Error('Mashina modeli kutilgan tuzilmada emas');
  }
  const body = merge([...bodyRest, ...paint]);
  body.computeBoundingBox();

  return {
    body,
    wheel: merge(wheel),
    paint: merge(paint),
    bodyRest: merge(bodyRest),
    bodyMaterial: textured ? texturedMaterial(texture) : bodyMaterial,
    wheelMaterial: textured ? texturedMaterial(texture) : wheelMaterial,
    texture,
    paintRect,
    wheelDrop,
    bounds: body.boundingBox!.clone(),
    wheelX: (Math.abs(fl.center.x - fr.center.x) / 2) * scale,
  };
}

/** Atlas katagi (piksel); o'lcham manba teksturalariga qarab, maksimal ATLAS_CELL */
const ATLAS_CELL = 512;
/** Atlasning maksimal o'lchami (px) — teksturasi ko'p modellarda kataklar kichrayadi */
const ATLAS_MAX = 2048;
/** Katak chetidan ichkariga (uv ulushi) — qo'shni katak rangi "oqib" kirmasligi uchun */
const ATLAS_INSET = 0.004;

/**
 * Bir nechta teksturani bitta kanvasga (g×g katak) yig'ish; oxirgi katak — oq (teksturasiz qismlar vertex rangda).
 * glTF uv'da (0, 0) — rasmning chap-tepa burchagi (flipY = false), kanvas ham shunday.
 */
function buildAtlas(textures: Texture[]) {
  const g = Math.ceil(Math.sqrt(textures.length + 1));
  const cell = Math.min(ATLAS_CELL, Math.floor(ATLAS_MAX / g), Math.max(...textures.map((t) => (t.image as { width: number }).width)));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = g * cell;
  const ctx = canvas.getContext('2d')!;
  textures.forEach((t, i) => ctx.drawImage(t.image as CanvasImageSource, (i % g) * cell, Math.floor(i / g) * cell, cell, cell));
  const white = textures.length;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect((white % g) * cell, Math.floor(white / g) * cell, cell, cell);

  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = 4;
  const cellOf = (t: Texture | null) => (t ? textures.indexOf(t) : white);
  const k = 1 - 2 * ATLAS_INSET;
  return {
    texture,
    map: (t: Texture | null) => {
      const i = cellOf(t);
      const col = i % g;
      const row = Math.floor(i / g);
      if (!t) return () => [(col + 0.5) / g, (row + 0.5) / g] as [number, number];
      return (u: number, v: number) => [(col + ATLAS_INSET + u * k) / g, (row + ATLAS_INSET + v * k) / g] as [number, number];
    },
    rect: (t: Texture): [number, number, number, number] => {
      const i = cellOf(t);
      return [(i % g) / g, Math.floor(i / g) / g, (i % g + 1) / g, (Math.floor(i / g) + 1) / g];
    },
  };
}

const cache = new WeakMap<Object3D, CarModel>();

/** Mashina modeli (Suspense bilan yuklanadi; bir xil mashinalar bitta geometriyani bo'lishadi) */
export function useCarModel(car: CarId): CarModel {
  const { scene } = useGLTF(modelUrl(car));
  return useMemo(() => {
    let model = cache.get(scene);
    if (!model) cache.set(scene, (model = buildCarModel(scene)));
    return model;
  }, [scene]);
}

/**
 * Oldindan yuklash: tanlangan mashina (menyu) — darhol; qolganlari (0.3–0.5 MB) kerak bo'lganda (boshqa o'yinchi, bot).
 * Har mashina o'z Suspense'ida chiziladi — yuklanayotgan model dunyoni to'xtatmaydi.
 */
export const preloadCar = (car: CarId) => useGLTF.preload(modelUrl(car));
preloadCar(useCarChoice.getState().car);

export const bodyMaterial = withCarEnv(new MeshStandardMaterial({ vertexColors: true, flatShading: true }), 0.5);
export const wheelMaterial = withCarEnv(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), 0.3);

/** Teksturali model materiali: tekstura × vertex rang (oyna qismlari — qora vertex rang) */
export function texturedMaterial(map: Texture, metallic = false) {
  // Atrof-muhit aksi (carEnv): lak yaltiraydi, metall bo'yoq haqiqiy metalldek; aksisiz ular qorayib chiqardi
  return withCarEnv(
    new MeshStandardMaterial({
      map,
      vertexColors: true,
      metalness: metallic ? 0.75 : 0.3,
      roughness: metallic ? 0.28 : 0.45,
    }),
    metallic ? 1 : 0.7,
  );
}
