import { useMemo } from 'react';
import { BufferAttribute, Box3, Matrix4, MeshStandardMaterial, Vector3, type BufferGeometry, type Mesh, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGLTF } from '@react-three/drei';
import { CAR } from '@game/shared';

/**
 * Mashina modeli — Kenney Racing Kit `raceCarRed.glb` (client/public/model/).
 * Yuklangandan keyin bo'laklar birlashtiriladi (kam draw call):
 *  - paint:  korpusning `red` materialli qismi — o'yinchi rangiga bo'yaladi
 *  - detail: korpusning qolgan qismlari (shina rangli detallar, oyna, kulrang) — vertex rang
 *  - wheel:  bitta g'ildirak (shina + disk), markazi koordinata boshida, o'qi X bo'ylab, disk +X tomonda
 * Model fizikaga moslanadi: g'ildiraklar orasi (old-orqa) = CAR.WHEEL_POSITIONS, g'ildirak radiusi = CAR.WHEEL_RADIUS.
 * Fizika (collider, g'ildirak ulanish nuqtalari) o'zgarmaydi — bu faqat vizual.
 */

const MODEL_URL = `${import.meta.env.BASE_URL}model/raceCarRed.glb`;
const PAINT_MATERIAL = 'red';

/** Tinch holatda g'ildirak markazi shassiga nisbatan (RemoteCars dagi taxmin bilan bir xil) */
export const WHEEL_REST_Y = CAR.WHEEL_POSITIONS[0][1] - CAR.SUSPENSION_REST_LENGTH * 0.55;

export interface CarModel {
  paint: BufferGeometry;
  detail: BufferGeometry;
  wheel: BufferGeometry;
  /** Vizual g'ildiraklarning X masofasi (model proporsiyasi bo'yicha; fizika nuqtalaridan torroq) */
  wheelX: number;
}

/** Mesh qaysi qismga tegishli: 'body' yoki 'wheelFrontLeft' va h.k. (eng yaqin nomli ota-node) */
function partName(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (/^(body|wheel[A-Za-z]+)$/.test(p.name)) return p.name;
  return '';
}

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
  const detail: BufferGeometry[] = [];
  const wheel: BufferGeometry[] = [];
  for (const m of meshes) {
    const part = partName(m);
    if (part === 'body') {
      const isPaint = (m.material as MeshStandardMaterial).name === PAINT_MATERIAL;
      (isPaint ? paint : detail).push(bake(m, bodyFit));
    } else if (part === 'wheelFrontLeft') {
      wheel.push(bake(m, wheelFit));
    }
  }
  if (!paint.length || !detail.length || !wheel.length) throw new Error(`Mashina modeli kutilgan tuzilmada emas: ${MODEL_URL}`);

  return {
    paint: merge(paint),
    detail: merge(detail),
    wheel: merge(wheel),
    wheelX: (Math.abs(fl.center.x - fr.center.x) / 2) * scale,
  };
}

const cache = new WeakMap<Object3D, CarModel>();

/** Mashina modeli (Suspense bilan yuklanadi; barcha mashinalar bitta geometriyani bo'lishadi) */
export function useCarModel(): CarModel {
  const { scene } = useGLTF(MODEL_URL);
  return useMemo(() => {
    let model = cache.get(scene);
    if (!model) cache.set(scene, (model = buildCarModel(scene)));
    return model;
  }, [scene]);
}

useGLTF.preload(MODEL_URL);

export const detailMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true });
export const wheelMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
