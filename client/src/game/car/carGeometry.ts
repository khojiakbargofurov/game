import { useMemo } from 'react';
import {
  BufferAttribute,
  Box3,
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

/**
 * Mashina modellari (client/public/model/, ro'yxat: CARS): Kenney Racing Kit baggilari va teksturali modellar.
 * Teksturali modelda (masalan, superkar) rang teksturadan olinadi — uv saqlanadi, bo'yoq tuningi teksturani
 * qayta bo'yaydi (tuningParts.ts).
 * Yuklangandan keyin bo'laklar birlashtiriladi (kam draw call):
 *  - body:  butun korpus — material ranglari vertex rangga o'tkaziladi (1 draw call)
 *  - wheel: bitta g'ildirak (shina + disk), markazi koordinata boshida, o'qi X bo'ylab, disk +X tomonda
 * Vizual tuning uchun ular yana ikkiga bo'lingan: korpus = bodyRest + paint (bo'yoq), g'ildirak = tire + rim (disk).
 * Tuning yo'q bo'lsa birlashgan variant chiziladi (kam draw call).
 * Model fizikaga moslanadi: g'ildiraklar orasi (old-orqa) = CAR.WHEEL_POSITIONS, g'ildirak radiusi = CAR.WHEEL_RADIUS.
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
  /** G'ildirakning shina va disk qismlari; disk alohida bo'lmasa (teksturali model) — null */
  tire: BufferGeometry;
  rim: BufferGeometry | null;
  /** Korpus va g'ildirak materiallari (Kenney — umumiy vertex-rangli, teksturali — o'z materiali) */
  bodyMaterial: MeshStandardMaterial;
  wheelMaterial: MeshStandardMaterial;
  /** Teksturali model: asl rang teksturasi (bo'yoq tuningi uni qayta bo'yaydi) */
  texture: Texture | null;
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

/**
 * Dunyo koordinatalariga o'tkazilgan, indekssiz, material rangidagi vertex rangli nusxa.
 * `keepUv` — teksturali model: uv saqlanadi (teksturasiz qismlarga nol uv, rangni vertex rang beradi).
 */
function bake(mesh: Mesh, extra: Matrix4, keepUv: boolean) {
  let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(extra);
  // Ba'zi modellarda (masalan, obj2gltf eksporti) normallar yo'q — yorug'liksiz qop-qora chiqardi.
  // Indekslangan holda hisoblanadi: umumiy uchlarda silliq soyalanish
  if (!g.attributes.normal) g.computeVertexNormals();
  if (g.index) g = g.toNonIndexed();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && !(keepUv && name === 'uv')) g.deleteAttribute(name);
  }
  const count = g.attributes.position.count;
  if (keepUv && !g.attributes.uv) g.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2));
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

function buildCarModel(scene: Object3D, realWheels: boolean): CarModel {
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
  // G'ildirak radiusi: Kenney'da fizikadagiga cho'ziladi, realWheels'da modeldagi proporsiyada qoladi
  const wheelScale = realWheels ? scale : CAR.WHEEL_RADIUS / (fl.size.y / 2);
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

  // Teksturali model: bitta tekstura (atlas), g'ildirak ham shu teksturada — disk alohida bo'yalmaydi
  const texture = meshes.map(textureOf).find((t) => t) ?? null;
  const textured = texture !== null;

  const paint: BufferGeometry[] = [];
  const bodyRest: BufferGeometry[] = [];
  const rim: BufferGeometry[] = [];
  const tire: BufferGeometry[] = [];
  for (const m of meshes) {
    const part = partName(m);
    if (part === 'body') (isFixed(m) ? bodyRest : paint).push(bake(m, bodyFit, textured));
    else if (part === 'wheelFrontLeft') (isFixed(m) || textured ? tire : rim).push(bake(m, wheelFit, textured));
  }
  if (!paint.length || !bodyRest.length || !tire.length || (!textured && !rim.length)) {
    throw new Error('Mashina modeli kutilgan tuzilmada emas');
  }
  const body = merge([...bodyRest, ...paint]);
  body.computeBoundingBox();

  return {
    body,
    wheel: merge([...tire, ...rim]),
    paint: merge(paint),
    bodyRest: merge(bodyRest),
    tire: merge(tire),
    rim: rim.length ? merge(rim) : null,
    bodyMaterial: textured ? texturedMaterial(texture) : bodyMaterial,
    wheelMaterial: textured ? texturedMaterial(texture) : wheelMaterial,
    texture,
    wheelDrop,
    bounds: body.boundingBox!.clone(),
    wheelX: (Math.abs(fl.center.x - fr.center.x) / 2) * scale,
  };
}

const cache = new WeakMap<Object3D, CarModel>();

/** Mashina modeli (Suspense bilan yuklanadi; bir xil mashinalar bitta geometriyani bo'lishadi) */
export function useCarModel(car: CarId): CarModel {
  const { scene } = useGLTF(modelUrl(car));
  return useMemo(() => {
    let model = cache.get(scene);
    if (!model) cache.set(scene, (model = buildCarModel(scene, !!carDef(car).realWheels)));
    return model;
  }, [scene, car]);
}

// Hammasi kichik (Kenney ~100 KB, superkar ~0.5 MB) — boshqa o'yinchilar mashinasi ham kutilmasdan chiqadi
for (const c of CARS) useGLTF.preload(modelUrl(c.id));

export const bodyMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true });
export const wheelMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });

/** Teksturali model materiali: tekstura × vertex rang (oyna qismlari — qora vertex rang) */
export function texturedMaterial(map: Texture, metallic = false) {
  return new MeshStandardMaterial({
    map,
    vertexColors: true,
    metalness: metallic ? 0.75 : 0.3,
    roughness: metallic ? 0.28 : 0.45,
  });
}
