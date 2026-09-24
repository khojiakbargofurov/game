import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import {
  BufferAttribute,
  Box3,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Mesh,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PropDef, Track } from '@game/shared';
import { useTrack } from '../../store/raceSettings';

/**
 * Plitkali trassa (Kenney Racing Kit, client/public/kit/): yo'l plitkalari va jihozlar (tribunalar, pit binolari,
 * chodirlar, daraxtlar...). Hammasi ikkita birlashtirilgan geometriyaga yig'iladi (yo'l + jihozlar = 2 draw call),
 * ranglar vertex rangda. Yo'l faqat vizual — fizika tekis relyefda; qattiq jihozlarga quti collider.
 */

const kitUrl = (model: string) => `${import.meta.env.BASE_URL}kit/${model}.glb`;

/** Jihozlar masshtabi: kit birligi → metr (mashinaga nisbatan to'g'ri o'lcham; yo'l plitkasi kattaroq — TILE_SIZE) */
const PROP_SCALE = 12;
/** Yo'l plitkalari: yupqa qatlam (chiziqlar asfaltdan ko'tarilib qolmasin) — 0.03 birlikdan past uchlar shu masshtabda */
const FLAT_Y_SCALE = 4;
const FLAT_Y_LIMIT = 0.03;
/**
 * Asfalt usti relyefdan shuncha balandda. Plitka qatlamlari (model birligida, tugun siljishi bilan): chetdagi o't −0.01,
 * asfalt 0, oq chiziq/bordyur +0.01 — yassilangandan keyin ±0.04 m; eng pastki qatlam ham relyefdan yuqorida bo'lsin
 */
const ROAD_LIFT = 0.09;

interface Baked {
  geometry: BufferGeometry;
  /** Model chegaralari (kit birliklarida) */
  box: Box3;
}

/** Modelning barcha meshlari — o'z koordinatalarida, vertex rangli (bir marta, keyin nusxalanadi) */
function bakeModel(scene: Object3D): Baked {
  scene.updateMatrixWorld(true);
  const parts: BufferGeometry[] = [];
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    // Kenney ranglari aslida sRGB qiymatlar (glTF ularni chiziqli deb o'qiydi — asfalt och kulrang chiqardi)
    const c = (mesh.material as MeshStandardMaterial).color.clone().convertSRGBToLinear();
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new BufferAttribute(colors, 3));
    parts.push(g);
  });
  const geometry = mergeGeometries(parts)!;
  geometry.computeBoundingBox();
  return { geometry, box: geometry.boundingBox!.clone() };
}

/** Yo'l plitkasi: balandlik bo'yicha yassilash (tekis qism yupqa, ark va ustunlar — to'liq masshtabda) */
function flatten(g: BufferGeometry, tile: number) {
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setY(i, y <= FLAT_Y_LIMIT ? (y * FLAT_Y_SCALE) / tile : y);
  }
  return g;
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
  const road: BufferGeometry[] = [];
  const props: BufferGeometry[] = [];
  const solids: Solid[] = [];
  const m = new Matrix4();

  // ── Yo'l plitkalari: model boshi + burilish, masshtab T; tekis qism asfalt usti = roadY + ROAD_LIFT ──
  for (const p of track.TILES) {
    const g = flatten(models.get(p.model)!.geometry.clone(), T);
    const base = roadY + ROAD_LIFT;
    m.makeRotationY(p.yaw).premultiply(new Matrix4().makeTranslation(p.x, base, p.z)).multiply(new Matrix4().makeScale(T, T, T));
    road.push(g.applyMatrix4(m));
  }

  // ── Jihozlar ──
  const placed: { x: number; z: number; r: number }[] = [];
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
      if (!p.solid && placed.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + radius * 0.5)) continue;
    }
    placed.push({ x, z, r: radius });

    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    // Footprint markazi nishonga tushsin: model boshi = nishon − R(yaw)·(cx, cz)·S
    const ox = x - (cx * c + cz * s) * S;
    const oz = z - (-cx * s + cz * c) * S;
    const y = spansRoad ? roadY : track.terrainHeight(x, z);
    m.makeRotationY(yaw).premultiply(new Matrix4().makeTranslation(ox, y, oz)).multiply(new Matrix4().makeScale(S, S, S));
    props.push(baked.geometry.clone().applyMatrix4(m));

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
    const g = mergeGeometries(list)!;
    g.computeBoundingSphere();
    return g;
  };
  return { road: merge(road), props: props.length ? merge(props) : null, solids };
}

const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true });

function modelNames(track: Track) {
  return [...new Set([...track.TILES.map((p) => p.model), ...(track.def.props ?? []).map((p: PropDef) => p.model)])];
}

function KitScene({ track }: { track: Track }) {
  const names = useMemo(() => modelNames(track), [track]);
  const gltfs = useGLTF(names.map(kitUrl));
  const { road, props, solids } = useMemo(() => {
    const models = new Map(names.map((n, i) => [n, bakeModel(gltfs[i].scene)]));
    return build(track, models);
  }, [track, names, gltfs]);

  return (
    <>
      <mesh geometry={road} material={material} receiveShadow />
      {props && <mesh geometry={props} material={material} castShadow receiveShadow />}
      <RigidBody type="fixed" colliders={false}>
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
