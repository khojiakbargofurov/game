import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { CuboidCollider, RigidBody, TrimeshCollider } from '@react-three/rapier';
import {
  BufferAttribute,
  Box3,
  Color,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Mesh,
  type Object3D,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tileVertex, type Palette, type PropDef, type Track } from '@game/shared';
import { usePalette, useTrack } from '../../store/raceSettings';

/**
 * Plitkali trassa (Kenney Racing Kit, client/public/kit/): yo'l plitkalari va jihozlar (tribunalar, pit binolari,
 * chodirlar, daraxtlar...). Rangli qismlar ikkita birlashtirilgan geometriyaga (yo'l + jihozlar), teksturali qismlar
 * (logotip, shaxmat bayroq) — tekstura bo'yicha alohida geometriyaga yig'iladi. Yer sathidagi yo'l faqat vizual —
 * fizika tekis relyefda; ko'tarilgan plitkalar (rampa, ko'prik) — trimesh collider; qattiq jihozlarga quti collider.
 * Plitka chetidagi o't va daraxt barglari — fasl palitrasidan.
 */

const kitUrl = (model: string) => `${import.meta.env.BASE_URL}kit/${model}.glb`;

/** Jihozlar masshtabi: kit birligi → metr (mashinaga nisbatan to'g'ri o'lcham; yo'l plitkasi kattaroq — TILE_SIZE) */
const PROP_SCALE = 12;

/** Model qismlari: rangli (vertex rang) va teksturali (material nomi bo'yicha: 'tankco', 'checkers') */
interface Baked {
  plain: BufferGeometry | null;
  textured: { key: string; geometry: BufferGeometry; map: Texture }[];
  /** Model chegaralari (kit birliklarida) */
  box: Box3;
}

/** Material rangini fasl palitrasi bilan almashtirish (bo'lmasa — undefined) */
type Tint = (material: string) => Color | undefined;

function bakeModel(scene: Object3D, tint: Tint): Baked {
  scene.updateMatrixWorld(true);
  const plain: BufferGeometry[] = [];
  const textured: Baked['textured'] = [];
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as MeshStandardMaterial;
    let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    const keep = mat.map ? ['position', 'normal', 'uv'] : ['position', 'normal'];
    for (const name of Object.keys(g.attributes)) if (!keep.includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (mat.map) {
      textured.push({ key: mat.name, geometry: g, map: mat.map });
      return;
    }
    // Kenney ranglari aslida sRGB qiymatlar (glTF ularni chiziqli deb o'qiydi — asfalt och kulrang chiqardi)
    const c = tint(mat.name) ?? mat.color.clone().convertSRGBToLinear();
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new BufferAttribute(colors, 3));
    plain.push(g);
  });
  const all = [...plain, ...textured.map((t) => t.geometry)];
  const box = new Box3();
  for (const g of all) {
    g.computeBoundingBox();
    box.union(g.boundingBox!);
  }
  return { plain: plain.length ? mergeGeometries(plain) : null, textured, box };
}

/** Joylashtirilgan qismlar yig'indisi: rangli va har tekstura uchun alohida ro'yxat */
class Layer {
  plain: BufferGeometry[] = [];
  textured = new Map<string, { map: Texture; parts: BufferGeometry[] }>();

  /** Modelning barcha qismlarini nusxalab, `place` bilan joyiga qo'yib qo'shish */
  add(baked: Baked, place: (g: BufferGeometry) => BufferGeometry) {
    if (baked.plain) this.plain.push(place(baked.plain.clone()));
    for (const t of baked.textured) {
      let entry = this.textured.get(t.key);
      if (!entry) this.textured.set(t.key, (entry = { map: t.map, parts: [] }));
      entry.parts.push(place(t.geometry.clone()));
    }
  }
}

interface Solid {
  position: [number, number, number];
  yaw: number;
  half: [number, number, number];
}

const tmp = new Vector3();

function build(track: Track, models: Map<string, Baked>) {
  const T = track.TILE_SIZE;
  const roadY = track.def.tiles!.y;
  const road = new Layer();
  const elevated: BufferGeometry[] = [];
  const props = new Layer();
  const solids: Solid[] = [];
  const m = new Matrix4();

  // ── Yo'l plitkalari (joylashuv formulasi — shared tileVertex, headless simulyatsiya bilan bir xil) ──
  const v: number[] = [0, 0, 0];
  for (const p of track.TILES) {
    road.add(models.get(p.model)!, (g) => {
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        tileVertex(p, T, roadY, pos.getX(i), pos.getY(i), pos.getZ(i), v);
        pos.setXYZ(i, v[0], v[1], v[2]);
      }
      g.computeVertexNormals();
      if (p.elevated) elevated.push(g);
      return g;
    });
  }

  // ── Jihozlar ──
  const placed: { x: number; z: number; r: number; solid: boolean }[] = [];
  const near = { s: 0, dist: 0, lateral: 0, roadY: 0 };
  const byPriority = [...(track.def.props ?? [])].sort((a, b) => Number(!!b.solid) - Number(!!a.solid));
  for (const p of byPriority) {
    const baked = models.get(p.model)!;
    const S = PROP_SCALE * (p.scale ?? 1);
    const { min, max } = baked.box;
    const cx = (min.x + max.x) / 2;
    const cz = (min.z + max.z) / 2;
    const radius = (Math.hypot(max.x - min.x, max.z - min.z) / 2) * S;

    const target = track.trackPoint(p.s, p.lateral);
    const [x, , z] = target.position;
    const frame = track.routeAt(p.s);
    let yaw: number;
    if (p.face === 'along') yaw = Math.atan2(frame.tx, frame.tz);
    else if (p.face === 'road') {
      // Old tomon (+z) yo'lga: chap vektor (tz, −tx), yo'l — lateral'ga teskari tomonda
      const side = Math.sign(p.lateral) || 1;
      yaw = Math.atan2(-side * frame.tz, side * frame.tx);
    } else yaw = 0;
    yaw += p.yaw ?? 0;

    // Yo'lga (yoki boshqa trassa qismiga) tushib qolgan jihoz tashlab yuboriladi; yo'l ustidagi ko'priklar bundan mustasno
    const spansRoad = p.face === 'along' && p.lateral === 0;
    if (!spansRoad) {
      const n = track.nearestOnRoute(x, z, near);
      if (n.dist < track.roadHalfWidth(n.s) + 3 + radius * 0.7) continue;
      // Qattiq jihoz (bino, tribuna, to'siq) bilan ustma-ust tushsa tashlanadi. Qatorlar (tribunalar, to'siqlar)
      // yonma-yon turishi uchun radiuslar yig'indisining faqat bir qismi hisobga olinadi
      const k = p.solid ? 0.6 : 0.5;
      if (placed.some((q) => q.solid && Math.hypot(q.x - x, q.z - z) < (q.r + radius) * k)) continue;
    }
    placed.push({ x, z, r: radius, solid: !!p.solid });

    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    // Footprint markazi nishonga tushsin: model boshi = nishon − R(yaw)·(cx, cz)·S
    const ox = x - (cx * c + cz * s) * S;
    const oz = z - (-cx * s + cz * c) * S;
    const y = spansRoad ? roadY : track.terrainHeight(x, z);
    m.makeRotationY(yaw).premultiply(new Matrix4().makeTranslation(ox, y, oz)).multiply(new Matrix4().makeScale(S, S, S));
    props.add(baked, (g) => g.applyMatrix4(m));

    if (p.solid) {
      tmp.set(x, y + ((max.y - min.y) * S) / 2, z);
      solids.push({
        position: [tmp.x, tmp.y, tmp.z],
        yaw,
        half: [((max.x - min.x) * S) / 2, ((max.y - min.y) * S) / 2, ((max.z - min.z) * S) / 2],
      });
    }
  }

  const merge = (list: BufferGeometry[]) => {
    if (!list.length) return null;
    const g = mergeGeometries(list)!;
    g.computeBoundingSphere();
    return g;
  };
  // Teksturali qatlamlar: yo'l va jihozlardan bitta tekstura bo'yicha birlashtiriladi
  const textured = new Map<string, { map: Texture; parts: BufferGeometry[] }>();
  for (const layer of [road, props]) {
    for (const [key, t] of layer.textured) {
      const entry = textured.get(key) ?? { map: t.map, parts: [] };
      entry.parts.push(...t.parts);
      textured.set(key, entry);
    }
  }
  // Ko'tarilgan plitkalar collideri: uchlar va (indekssiz) uchburchaklar
  const deck = merge(elevated);
  const collider = deck
    ? {
        vertices: deck.attributes.position.array as Float32Array,
        indices: Uint32Array.from({ length: deck.attributes.position.count }, (_, i) => i),
      }
    : null;
  return {
    road: merge(road.plain),
    props: merge(props.plain),
    textured: [...textured].map(([key, t]) => ({ key, geometry: merge(t.parts)!, map: t.map })),
    solids,
    collider,
  };
}

const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true });
const texturedMaterials = new Map<Texture, MeshStandardMaterial>();
const texturedMaterial = (map: Texture) => {
  let m = texturedMaterials.get(map);
  if (!m) texturedMaterials.set(map, (m = new MeshStandardMaterial({ map, flatShading: true })));
  return m;
};

function modelNames(track: Track) {
  return [...new Set([...track.TILES.map((p) => p.model), ...(track.def.props ?? []).map((p: PropDef) => p.model)])];
}

/**
 * Fasl ranglari: yo'l plitkalari chetidagi o't — relyef o'ti, daraxt barglari — barglar rangi (kuzda sariq, qishda qorli).
 * Kenney 'grass' materialini boshqa joyda ham ishlatadi (yashil chodirlar) — ular o'zgarmaydi.
 */
function seasonTint(model: string, palette: Palette): Tint {
  const color = model.startsWith('tree') ? new Color(palette.leaves) : model.startsWith('road') ? new Color(palette.grass) : null;
  return (material) => (color && material === 'grass' ? color : undefined);
}

function KitScene({ track }: { track: Track }) {
  const palette = usePalette();
  const names = useMemo(() => modelNames(track), [track]);
  const gltfs = useGLTF(names.map(kitUrl));
  const { road, props, textured, solids, collider } = useMemo(() => {
    const models = new Map(names.map((n, i) => [n, bakeModel(gltfs[i].scene, seasonTint(n, palette))]));
    return build(track, models);
  }, [track, names, gltfs, palette]);

  return (
    <>
      {road && <mesh geometry={road} material={material} receiveShadow />}
      {props && <mesh geometry={props} material={material} castShadow receiveShadow />}
      {textured.map((t) => (
        <mesh key={t.key} geometry={t.geometry} material={texturedMaterial(t.map)} castShadow receiveShadow />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {collider && <TrimeshCollider args={[collider.vertices, collider.indices]} friction={1} />}
        {solids.map((b, i) => (
          <group key={i} position={b.position} rotation={[0, b.yaw, 0]}>
            <CuboidCollider args={b.half} />
          </group>
        ))}
      </RigidBody>
    </>
  );
}

/** Faqat plitkali trassada (Gran Pri) chiziladi */
export function KitTrack() {
  const track = useTrack();
  if (!track.TILE_SIZE) return null;
  return <KitScene track={track} />;
}
