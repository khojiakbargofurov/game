import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type InstancedMesh,
} from 'three';
import { ROAD_END_EXTENSION, ROUTE_STEP, createRng, type Palette, type Track } from '@game/shared';
import { activeTrack, useActiveSettings, usePalette, useTrack } from '../../store/raceSettings';
import { carTarget } from '../carTarget';
import { withCarEnv } from '../car/carEnv';

/** Asfalt yonidagi qattiq yelka va relyefga ulanadigan tashqi shag'al tasmasi */
const SHOULDER = 0.95;
const VERGE = 0.7;
const LIFT = 0.05;
/** Chiziqlar asfaltdan shuncha baland (polygonOffset bilan birga — miltillamasin) */
const LINE_LIFT = 0.015;
/** Chekka chiziq: yo'l chetidan ichkarida, kengligi */
const EDGE_LINE_INSET = 0.45;
const EDGE_LINE_WIDTH = 0.2;
const CENTER_LINE_WIDTH = 0.18;
/** Markaziy uzuq chiziq: har 6 namunadan (12 m) 3 tasi (6 m) chiziladi; tor yo'lda chizilmaydi */
const DASH_PERIOD = 6;
const DASH_ON = 3;
const CENTER_MIN_HALF_WIDTH = 4.2;
/** Bordyur (kerb) shu egrilikdan (1/m) keskin burilishlarda qo'yiladi (radius < ~90 m) */
const KERB_CURVATURE = 1 / 90;
/** Bordyur burilishdan oldin/keyin shuncha namunaga cho'ziladi */
const KERB_PAD = 3;
/** Asfalt teksturasi shuncha metrda bir takrorlanadi */
const TEX_METERS = 6;
/** Yo'l sirtining g'adir-budurligi: yomg'irda ho'l asfalt yaltiraydi */
const ROUGHNESS = { clear: 0.92, rain: 0.28, snow: 0.95 } as const;
const CITY_CENTER = new Color('#f4c84d');
const SKID = new Color('#15171b');

/** Asfalt donadorligi: agregat, eski yamoqlar, choklar va mayda yoriqlar (asosiy rangni vertex rang beradi) */
let asphaltTexture: CanvasTexture | null = null;
function asphalt() {
  if (asphaltTexture) return asphaltTexture;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  // Deterministik "tasodif" — har yuklanishda bir xil naqsh
  let seed = 1234567;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    const grain = rand();
    const v = 188 + grain * 48 - (rand() < 0.035 ? 48 : 0) + (rand() < 0.018 ? 28 : 0);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Yo'l bo'ylab shina ko'p yurgan ikkita xira tasma
  const wear = ctx.createLinearGradient(0, 0, size, 0);
  wear.addColorStop(0, 'rgba(255,255,255,0)');
  wear.addColorStop(0.26, 'rgba(255,255,255,0.035)');
  wear.addColorStop(0.39, 'rgba(255,255,255,0)');
  wear.addColorStop(0.61, 'rgba(255,255,255,0)');
  wear.addColorStop(0.74, 'rgba(255,255,255,0.035)');
  wear.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = wear;
  ctx.fillRect(0, 0, size, size);
  // Yamoqlar: tekis to'rtburchak emas, biroz notekis kontur
  for (let k = 0; k < 4; k++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 14 + rand() * 28;
    const h = 10 + rand() * 22;
    ctx.fillStyle = `rgba(25,27,30,${0.08 + rand() * 0.07})`;
    ctx.beginPath();
    ctx.moveTo(x + 2, y);
    ctx.lineTo(x + w - 3, y + 1);
    ctx.lineTo(x + w, y + h - 3);
    ctx.lineTo(x + 1, y + h);
    ctx.closePath();
    ctx.fill();
  }
  // Yupqa yoriqlar va ko'ndalang eski chok
  ctx.strokeStyle = 'rgba(16,18,20,0.34)';
  ctx.lineWidth = 0.75;
  for (let k = 0; k < 5; k++) {
    let x = rand() * size;
    let y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) ctx.lineTo((x += (rand() - 0.5) * 13), (y += 4 + rand() * 9));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(20,22,24,0.16)';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.52);
  ctx.lineTo(size, size * 0.5);
  ctx.stroke();
  asphaltTexture = new CanvasTexture(c);
  asphaltTexture.wrapS = asphaltTexture.wrapT = RepeatWrapping;
  asphaltTexture.colorSpace = SRGBColorSpace;
  asphaltTexture.anisotropy = 8;
  return asphaltTexture;
}

/** Uchburchaklar yig'uvchi: pozitsiya, rang, uv; har to'rtburchak alohida uchlar bilan (keskin rang chegaralari) */
class Mesher {
  positions: number[] = [];
  colors: number[] = [];
  uvs: number[] = [];
  /** a, b — oldingi qator (chap, o'ng), c, d — keyingi qator; normal tepaga */
  quad(a: number[], b: number[], c: number[], d: number[], col: Color) {
    for (const p of [a, b, c, b, d, c]) {
      this.positions.push(p[0], p[1], p[2]);
      this.colors.push(col.r, col.g, col.b);
      this.uvs.push(p[3], p[4]);
    }
  }
  build() {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    geo.computeVertexNormals();
    return geo;
  }
}

/**
 * Asfalt yo'l: marshrut namunalari bo'ylab (har 2 m) — asfalt lentasi, yelka (burilishlarda qizil-oq bordyur),
 * alohida qatlamda oq chekka chiziqlar va markaziy uzuq chiziq.
 * Faqat vizual; fizika relyefda (yo'l ostidagi relyef allaqachon tekislangan).
 * Ko'prik uchastkasida chizilmaydi — u yerda ko'prik taxtalari bor.
 */
function buildRoadGeometry({ ROUTE, BRIDGE, roadHalfWidth, zoneWeights }: Track, C: Palette) {
  const { xs, ys, zs, txs, tzs, count } = ROUTE;
  const extensionSteps = ROUTE.closed ? 0 : Math.ceil(ROAD_END_EXTENSION / ROUTE_STEP);
  const first = -extensionSteps;
  const last = count - 1 + extensionSteps;
  const xAt = (i: number) =>
    i < 0 ? xs[0] + txs[0] * i * ROUTE_STEP : i >= count ? xs[count - 1] + txs[count - 1] * (i - count + 1) * ROUTE_STEP : xs[i];
  const zAt = (i: number) =>
    i < 0 ? zs[0] + tzs[0] * i * ROUTE_STEP : i >= count ? zs[count - 1] + tzs[count - 1] * (i - count + 1) * ROUTE_STEP : zs[i];
  const yAt = (i: number) =>
    i < 0 ? ys[0] + (ys[1] - ys[0]) * i : i >= count ? ys[count - 1] + (ys[count - 1] - ys[count - 2]) * (i - count + 1) : ys[i];
  const txAt = (i: number) => (i < 0 ? txs[0] : i >= count ? txs[count - 1] : txs[i]);
  const tzAt = (i: number) => (i < 0 ? tzs[0] : i >= count ? tzs[count - 1] : tzs[i]);
  const zone = {
    forest: new Color(C.asphaltForest),
    canyon: new Color(C.asphaltCanyon),
    ruins: new Color(C.asphaltRuins),
    alpine: new Color(C.asphaltAlpine),
    city: new Color(C.asphaltCity),
  };
  const ZONES = ['forest', 'canyon', 'ruins', 'alpine', 'city'] as const;
  const edge = new Color(C.roadEdge);
  const verge = edge.clone().multiplyScalar(0.72);
  const kerb = [new Color(C.kerbRed), new Color(C.kerbWhite)];
  const line = new Color(C.roadLine);

  // Egrilik: qo'shni urinmalar orasidagi burchak / qadam; bordyur — keskin burilish atrofida
  const sharp = new Uint8Array(count);
  for (let i = 0; i < count - 1; i++) {
    const cross = txs[i] * tzs[i + 1] - tzs[i] * txs[i + 1];
    const dot = txs[i] * txs[i + 1] + tzs[i] * tzs[i + 1];
    if (Math.abs(Math.atan2(cross, dot)) / ROUTE_STEP > KERB_CURVATURE) {
      for (let j = Math.max(0, i - KERB_PAD); j <= Math.min(count - 1, i + KERB_PAD); j++) sharp[j] = 1;
    }
  }
  // Keskin burilish/chorraha oldida 3 ta ko'ndalang zebra tasmasi (har biri 2 m, orasida 2 m).
  const crossing = new Uint8Array(count);
  if (ROUTE.closed) {
    const loopCount = count - 1;
    for (let i = 0; i < loopCount; i++) {
      const before = sharp[(i - 1 + loopCount) % loopCount];
      if (!sharp[i] || before) continue;
      for (const back of [3, 5, 7]) crossing[(i - back + loopCount) % loopCount] = 1;
    }
    crossing[count - 1] = crossing[0];
  }

  const surface = new Mesher();
  const shoulders = new Mesher();
  const lines = new Mesher();
  const skids = new Mesher();
  const c = new Color();
  /** Namunadagi nuqta: yo'l o'qidan `off` m chapga (manfiy — o'ngga), `dy` balandlik, uv */
  const at = (i: number, off: number, dy: number, s: number): number[] => [
    xAt(i) + tzAt(i) * off,
    yAt(i) + LIFT + dy,
    zAt(i) - txAt(i) * off,
    off / TEX_METERS,
    s / TEX_METERS,
  ];

  let prev: number | null = null;
  for (let i = first; i <= last; i++) {
    const s = i * ROUTE_STEP;
    if (BRIDGE && s > BRIDGE.start - 1 && s < BRIDGE.end + 1) {
      prev = null;
      continue;
    }
    if (prev !== null) {
      const ps = prev * ROUTE_STEP;
      const hw0 = roadHalfWidth(ps);
      const hw1 = roadHalfWidth(s);
      const w = zoneWeights(s);
      c.setRGB(0, 0, 0);
      for (const k of ZONES) {
        c.r += zone[k].r * w[k];
        c.g += zone[k].g * w[k];
        c.b += zone[k].b * w[k];
      }
      // Asfalt
      surface.quad(at(prev, hw0, 0, ps), at(prev, -hw0, 0, ps), at(i, hw1, 0, s), at(i, -hw1, 0, s), c);
      const city = w.city > 0.8;
      // Yelkalar: burilishda — biroz ko'tarilgan qizil-oq bordyur (har 4 m rang almashadi), aks holda — qattiq chekka.
      // Tashqi xira tasma asfaltni relyefga yumshoq ulaydi va yo'l chetini uzoqdan ham aniq ko'rsatadi.
      // Shaharda tashqi shag'al tasmasi yo'q: uning o'rniga City.tsx dagi ko'tarilgan trotuar keladi.
      const isKerb = !city && i >= 0 && i < count && prev >= 0 && prev < count && sharp[i] && sharp[prev];
      const shoulderCol = isKerb ? kerb[Math.floor(i / 2) % 2] : edge;
      const rise = isKerb ? 0.04 : 0;
      const shoulderWidth = city ? 0.85 : SHOULDER;
      for (const side of [1, -1]) {
        const inner0 = at(prev, side * hw0, rise, ps);
        const inner1 = at(i, side * hw1, rise, s);
        const outer0 = at(prev, side * (hw0 + shoulderWidth), -0.08, ps);
        const outer1 = at(i, side * (hw1 + shoulderWidth), -0.08, s);
        const verge0 = at(prev, side * (hw0 + shoulderWidth + VERGE), -0.13, ps);
        const verge1 = at(i, side * (hw1 + shoulderWidth + VERGE), -0.13, s);
        if (side > 0) {
          shoulders.quad(outer0, inner0, outer1, inner1, shoulderCol);
          if (!city) shoulders.quad(verge0, outer0, verge1, outer1, verge);
        } else {
          shoulders.quad(inner0, outer0, inner1, outer1, shoulderCol);
          if (!city) shoulders.quad(outer0, verge0, outer1, verge1, verge);
        }
      }
      // Chekka chiziqlar (uzluksiz)
      for (const side of [1, -1]) {
        const o0 = hw0 - EDGE_LINE_INSET;
        const o1 = hw1 - EDGE_LINE_INSET;
        const a = at(prev, side * o0, LINE_LIFT, ps);
        const b = at(prev, side * (o0 - EDGE_LINE_WIDTH), LINE_LIFT, ps);
        const d = at(i, side * o1, LINE_LIFT, s);
        const e = at(i, side * (o1 - EDGE_LINE_WIDTH), LINE_LIFT, s);
        if (side > 0) lines.quad(a, b, d, e, line);
        else lines.quad(b, a, e, d, line);
      }
      // Shahar ko'chalarida juft sariq uzluksiz chiziq; qolgan yo'llarda oq uzuq markaz chizig'i.
      // Zona o'tishida oddiy oq chiziq qoladi — sariq/oq rang bir segment ichida aralashmaydi.
      const dash = ((prev % DASH_PERIOD) + DASH_PERIOD) % DASH_PERIOD;
      if (Math.min(hw0, hw1) > CENTER_MIN_HALF_WIDTH && (city || dash < DASH_ON)) {
        if (city) {
          const gap = 0.16;
          for (const side of [1, -1]) {
            const center = side * (gap + CENTER_LINE_WIDTH / 2);
            lines.quad(
              at(prev, center + CENTER_LINE_WIDTH / 2, LINE_LIFT, ps),
              at(prev, center - CENTER_LINE_WIDTH / 2, LINE_LIFT, ps),
              at(i, center + CENTER_LINE_WIDTH / 2, LINE_LIFT, s),
              at(i, center - CENTER_LINE_WIDTH / 2, LINE_LIFT, s),
              CITY_CENTER,
            );
          }
          // Tokio prospekti — har yo'nalishda ikkita polosa. Markazdan tashqari oq uzuq ajratgichlar.
          if (dash < DASH_ON) {
            const laneWidth = 0.13;
            for (const side of [1, -1]) {
              const o0 = side * hw0 * 0.5;
              const o1 = side * hw1 * 0.5;
              lines.quad(
                at(prev, o0 + laneWidth / 2, LINE_LIFT, ps),
                at(prev, o0 - laneWidth / 2, LINE_LIFT, ps),
                at(i, o1 + laneWidth / 2, LINE_LIFT, s),
                at(i, o1 - laneWidth / 2, LINE_LIFT, s),
                line,
              );
            }
          }
        } else {
          const h = CENTER_LINE_WIDTH / 2;
          lines.quad(at(prev, h, LINE_LIFT, ps), at(prev, -h, LINE_LIFT, ps), at(i, h, LINE_LIFT, s), at(i, -h, LINE_LIFT, s), line);
        }
      }
      // Har keskin shahar burilishiga kirishda zebra: tungi yo'lda burilish/chorraha aniq ko'rinadi.
      if (city && i >= 0 && i < count && crossing[i]) {
        const crossHalf = Math.min(hw0, hw1) - 0.8;
        lines.quad(
          at(prev, crossHalf, LINE_LIFT * 1.2, ps),
          at(prev, -crossHalf, LINE_LIFT * 1.2, ps),
          at(i, crossHalf, LINE_LIFT * 1.2, s),
          at(i, -crossHalf, LINE_LIFT * 1.2, s),
          line,
        );
      }
      // Keskin burilishlarda ikkita juda xira shina izi. Uzluksiz emas — har 20 m da tanaffus qiladi.
      if (isKerb && Math.floor(i / 10) % 3 !== 2) {
        const tire = 0.12;
        for (const off of [-0.78, 0.78]) {
          skids.quad(
            at(prev, off + tire, LINE_LIFT * 0.55, ps),
            at(prev, off - tire, LINE_LIFT * 0.55, ps),
            at(i, off + tire, LINE_LIFT * 0.55, s),
            at(i, off - tire, LINE_LIFT * 0.55, s),
            SKID,
          );
        }
      }
    }
    prev = i;
  }
  return { surface: surface.build(), shoulders: shoulders.build(), lines: lines.build(), skids: skids.build() };
}

interface Puddle {
  x: number;
  y: number;
  z: number;
  yaw: number;
  sx: number;
  sz: number;
}

const puddleGeometry = new CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const puddleMaterial = withCarEnv(
  new MeshStandardMaterial({
    color: '#7896a9',
    roughness: 0.06,
    metalness: 0.18,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8,
  }),
  1.3,
);

function RainPuddles({ track }: { track: Track }) {
  const ref = useRef<InstancedMesh>(null);
  const puddles = useMemo(() => {
    const rng = createRng(track.def.seed + 404);
    const out: Puddle[] = [];
    for (let s = 24; s < track.ROUTE_LENGTH - 8; s += 24 + rng() * 24) {
      if (track.BRIDGE && s > track.BRIDGE.start - 3 && s < track.BRIDGE.end + 3) continue;
      const f = track.routeAt(s);
      const hw = track.roadHalfWidth(s);
      const lateral = (rng() * 2 - 1) * Math.max(1, hw - 1.4);
      out.push({
        x: f.x + f.tz * lateral,
        y: f.y + LIFT + 0.022,
        z: f.z - f.tx * lateral,
        yaw: Math.atan2(f.tx, f.tz) + (rng() - 0.5) * 0.45,
        sx: 0.45 + rng() * 1.35,
        sz: 1.2 + rng() * 3.4,
      });
    }
    return out;
  }, [track]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    puddles.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z);
      o.rotation.set(0, p.yaw, 0);
      o.scale.set(p.sx, 1, p.sz);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [puddles]);
  return <instancedMesh ref={ref} args={[puddleGeometry, puddleMaterial, puddles.length]} renderOrder={3} />;
}

const TRACK_STAMPS = 180;
const tireTrackGeometry = new PlaneGeometry(0.3, 1.05).rotateX(-Math.PI / 2);
const tireTrackMaterial = new MeshStandardMaterial({
  color: '#56606a',
  roughness: 1,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -10,
  polygonOffsetUnits: -10,
});

/** Qorda o'yinchi orqa g'ildiraklaridan qoladigan silliq, aylanma buferli haqiqiy izlar. */
function SnowTireTracks() {
  const ref = useRef<InstancedMesh>(null);
  const cursor = useRef(0);
  const last = useRef(new Vector3(Number.NaN, 0, 0));
  const respawns = useRef(carTarget.respawns);
  const forward = useMemo(() => new Vector3(), []);
  const left = useMemo(() => new Vector3(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    const o = new Object3D();
    o.scale.setScalar(0);
    o.updateMatrix();
    for (let i = 0; i < TRACK_STAMPS * 2; i++) mesh.setMatrixAt(i, o.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || Math.abs(carTarget.speed) < 2) return;
    if (respawns.current !== carTarget.respawns) {
      respawns.current = carTarget.respawns;
      last.current.set(Number.NaN, 0, 0);
    }
    if (Number.isFinite(last.current.x) && last.current.distanceToSquared(carTarget.position) < 0.72 * 0.72) return;
    last.current.copy(carTarget.position);
    forward.set(0, 0, 1).applyQuaternion(carTarget.quaternion).setY(0).normalize();
    left.set(1, 0, 0).applyQuaternion(carTarget.quaternion).setY(0).normalize();
    const track = activeTrack();
    const backX = carTarget.position.x - forward.x * 1.28;
    const backZ = carTarget.position.z - forward.z * 1.28;
    const near = track.nearestOnRoute(backX, backZ, undefined, carTarget.position.y);
    if (near.dist > track.roadHalfWidth(near.s) + 1.2) return;
    const yaw = Math.atan2(forward.x, forward.z);
    const o = new Object3D();
    for (const side of [-0.82, 0.82]) {
      const i = cursor.current++ % (TRACK_STAMPS * 2);
      o.position.set(backX + left.x * side, near.roadY + LIFT + 0.035, backZ + left.z * side);
      o.rotation.set(0, yaw, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[tireTrackGeometry, tireTrackMaterial, TRACK_STAMPS * 2]} frustumCulled={false} renderOrder={4} />;
}

export function Road() {
  const track = useTrack();
  // Plitkali trassada (Gran Pri) yo'l — kit modellari (KitTrack)
  return track.TILE_SIZE ? null : <RoadMesh track={track} />;
}

function RoadMesh({ track }: { track: Track }) {
  const palette = usePalette();
  const { weather } = useActiveSettings();
  const night = !!track.def.env?.night;
  const { surface, shoulders, lines, skids } = useMemo(() => buildRoadGeometry(track, palette), [track, palette]);
  const map = asphalt();
  // Tungi shahar asfalti biroz nam — fara va chiroqlarni aks ettiradi
  const roughness = night ? Math.min(ROUGHNESS[weather], 0.5) : ROUGHNESS[weather];
  return (
    <>
      <mesh geometry={surface} receiveShadow>
        {/* polygonOffset — relyef bilan z-fighting bo'lmasligi uchun */}
        <meshStandardMaterial
          vertexColors
          map={map}
          roughness={roughness}
          metalness={weather === 'rain' ? 0.12 : 0.02}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      {weather === 'snow' && (
        <mesh geometry={surface} receiveShadow renderOrder={2}>
          <meshStandardMaterial
            color="#e8edf1"
            roughness={0.98}
            transparent
            opacity={0.68}
            polygonOffset
            polygonOffsetFactor={-7}
            polygonOffsetUnits={-7}
          />
        </mesh>
      )}
      <mesh geometry={shoulders} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={skids} receiveShadow renderOrder={1}>
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={weather === 'snow' ? 0.1 : 0.24}
          roughness={0.72}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-5}
          polygonOffsetUnits={-5}
        />
      </mesh>
      <mesh geometry={lines} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={weather === 'rain' ? 0.38 : 0.72}
          metalness={weather === 'rain' ? 0.04 : 0}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
      {weather === 'rain' && <RainPuddles track={track} />}
      {weather === 'snow' && <SnowTireTracks />}
    </>
  );
}
