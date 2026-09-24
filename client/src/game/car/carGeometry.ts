import { useMemo } from 'react';
import { BufferAttribute, Box3, Matrix4, MeshStandardMaterial, Vector3, type BufferGeometry, type Mesh, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGLTF } from '@react-three/drei';
import { CAR, CARS, type CarId } from '@game/shared';

/**
 * Mashina modellari — Kenney Racing Kit (client/public/model/, ro'yxat: CARS).
 * Yuklangandan keyin bo'laklar birlashtiriladi (kam draw call):
 *  - body:  butun korpus — material ranglari vertex rangga o'tkaziladi (1 draw call)
 *  - wheel: bitta g'ildirak (shina + disk), markazi koordinata boshida, o'qi X bo'ylab, disk +X tomonda
 * Vizual tuning uchun ular yana ikkiga bo'lingan: korpus = bodyRest + paint (bo'yoq), g'ildirak = tire + rim (disk).
 * Tuning yo'q bo'lsa birlashgan variant chiziladi (kam draw call).
 * Model fizikaga moslanadi: g'ildiraklar orasi (old-orqa) = CAR.WHEEL_POSITIONS, g'ildirak radiusi = CAR.WHEEL_RADIUS.
 * Fizika (collider, g'ildirak ulanish nuqtalari) o'zgarmaydi — bu faqat vizual.
 */

const modelUrl = (car: CarId) => `${import.meta.env.BASE_URL}model/${CARS.find((c) => c.id === car)!.model}`;

/** Tinch holatda g'ildirak markazi shassiga nisbatan (RemoteCars dagi taxmin bilan bir xil) */
export const WHEEL_REST_Y = CAR.WHEEL_POSITIONS[0][1] - CAR.SUSPENSION_REST_LENGTH * 0.55;

export interface CarModel {
  body: BufferGeometry;
  wheel: BufferGeometry;
  /** Korpusning bo'yoq qismi va qolgani (shina, oyna) */
  paint: BufferGeometry;
  bodyRest: BufferGeometry;
  /** G'ildirakning shina va disk qismlari */
  tire: BufferGeometry;
  rim: BufferGeometry;
  /** Korpus chegaralari (mashina lokal koordinatalarida) — spoyler va neon joylashuvi uchun */
  bounds: Box3;
  /** Vizual g'ildiraklarning X masofasi (model proporsiyasi bo'yicha; fizika nuqtalaridan torroq) */
  wheelX: number;
}

/** Mesh qaysi qismga tegishli: 'body' yoki 'wheelFrontLeft' va h.k. (eng yaqin nomli ota-node) */
function partName(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (/^(body|wheel[A-Za-z]+)$/.test(p.name)) return p.name;
  return '';
}

/** Bo'yalmaydigan materiallar (qolgani — korpus bo'yog'i yoki g'ildirak diski) */
const FIXED_MATERIALS = ['carTire', 'glass'];
const isFixed = (m: Mesh) => FIXED_MATERIALS.includes((m.material as MeshStandardMaterial).name);

/** Dunyo koordinatalariga o'tkazilgan, indekssiz, material rangidagi vertex rangli nusxa */
function bake(mesh: Mesh, extra: Matrix4) {
  let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(extra);
  if (g.index) g = g.toNonIndexed();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  const c = (mesh.material as MeshStandardMaterial).color;
  const count = g.attributes.position.count;
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
  // Model o'qlari markazini fizika g'ildiraklari markaziga (tinch holatda) ko'chirish
  const modelMid = new Vector3((fl.center.x + fr.center.x) / 2, fl.center.y, (fl.center.z + rl.center.z) / 2);
  const physMid = new Vector3(0, WHEEL_REST_Y, (physFrontZ + physBackZ) / 2);
  const bodyFit = new Matrix4()
    .makeTranslation(physMid.x, physMid.y, physMid.z)
    .multiply(new Matrix4().makeScale(scale, scale, scale))
    .multiply(new Matrix4().makeTranslation(-modelMid.x, -modelMid.y, -modelMid.z));

  // G'ildirak: old-chap g'ildirak markazga keltiriladi va radiusi fizikadagiga moslanadi
  const wheelScale = CAR.WHEEL_RADIUS / (fl.size.y / 2);
  const wheelFit = new Matrix4()
    .makeScale(wheelScale, wheelScale, wheelScale)
    .multiply(new Matrix4().makeTranslation(-fl.center.x, -fl.center.y, -fl.center.z));

  const paint: BufferGeometry[] = [];
  const bodyRest: BufferGeometry[] = [];
  const rim: BufferGeometry[] = [];
  const tire: BufferGeometry[] = [];
  for (const m of meshes) {
    const part = partName(m);
    if (part === 'body') (isFixed(m) ? bodyRest : paint).push(bake(m, bodyFit));
    else if (part === 'wheelFrontLeft') (isFixed(m) ? tire : rim).push(bake(m, wheelFit));
  }
  if (!paint.length || !bodyRest.length || !rim.length || !tire.length) {
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
    rim: merge(rim),
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
    if (!model) cache.set(scene, (model = buildCarModel(scene)));
    return model;
  }, [scene]);
}

// Hammasi kichik (~100 KB) — boshqa o'yinchilar mashinasi ham kutilmasdan chiqadi
for (const c of CARS) useGLTF.preload(modelUrl(c.id));

export const bodyMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true });
export const wheelMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
