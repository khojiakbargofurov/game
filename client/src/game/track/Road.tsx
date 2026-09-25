import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, CanvasTexture, Color, RepeatWrapping, SRGBColorSpace } from 'three';
import { ROUTE_STEP, type Palette, type Track } from '@game/shared';
import { useActiveSettings, usePalette, useTrack } from '../../store/raceSettings';

const SHOULDER = 0.9;
const LIFT = 0.05;
/** Chiziqlar asfaltdan shuncha baland (polygonOffset bilan birga — miltillamasin) */
const LINE_LIFT = 0.015;
/** Chekka chiziq: yo'l chetidan ichkarida, kengligi */
const EDGE_LINE_INSET = 0.45;
const EDGE_LINE_WIDTH = 0.2;
const CENTER_LINE_WIDTH = 0.18;
/** Markaziy uzuq chiziq: har 6 namunadan (12 m) 2 tasi (4 m) chiziladi; tor yo'lda chizilmaydi */
const DASH_PERIOD = 6;
const DASH_ON = 2;
const CENTER_MIN_HALF_WIDTH = 4.2;
/** Bordyur (kerb) shu egrilikdan (1/m) keskin burilishlarda qo'yiladi (radius < ~90 m) */
const KERB_CURVATURE = 1 / 90;
/** Bordyur burilishdan oldin/keyin shuncha namunaga cho'ziladi */
const KERB_PAD = 3;
/** Asfalt teksturasi shuncha metrda bir takrorlanadi */
const TEX_METERS = 6;
/** Yo'l sirtining g'adir-budurligi: yomg'irda ho'l asfalt yaltiraydi */
const ROUGHNESS = { clear: 0.92, rain: 0.28, snow: 0.95 } as const;

/** Asfalt donadorligi: och kulrang dog'lar va mayda yoriqlar (rangni vertex rang beradi) */
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
    const v = 205 + rand() * 50 - (rand() < 0.04 ? 60 : 0);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Yamoqlar (ta'mirlangan joylar) va yoriqlar
  for (let k = 0; k < 5; k++) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.06})`;
    ctx.fillRect(rand() * size, rand() * size, 14 + rand() * 30, 10 + rand() * 24);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    let x = rand() * size;
    let y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) ctx.lineTo((x += (rand() - 0.5) * 18), (y += rand() * 10));
    ctx.stroke();
  }
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
  const zone = { forest: new Color(C.asphaltForest), canyon: new Color(C.asphaltCanyon), ruins: new Color(C.asphaltRuins) };
  const edge = new Color(C.roadEdge);
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

  const surface = new Mesher();
  const lines = new Mesher();
  const c = new Color();
  /** Namunadagi nuqta: yo'l o'qidan `off` m chapga (manfiy — o'ngga), `dy` balandlik, uv */
  const at = (i: number, off: number, dy: number, s: number): number[] => [
    xs[i] + tzs[i] * off,
    ys[i] + LIFT + dy,
    zs[i] - txs[i] * off,
    off / TEX_METERS,
    s / TEX_METERS,
  ];

  let prev = -1;
  for (let i = 0; i < count; i++) {
    const s = i * ROUTE_STEP;
    if (BRIDGE && s > BRIDGE.start - 1 && s < BRIDGE.end + 1) {
      prev = -1;
      continue;
    }
    if (prev >= 0) {
      const ps = prev * ROUTE_STEP;
      const hw0 = roadHalfWidth(ps);
      const hw1 = roadHalfWidth(s);
      const w = zoneWeights(s);
      c.setRGB(
        zone.forest.r * w.forest + zone.canyon.r * w.canyon + zone.ruins.r * w.ruins,
        zone.forest.g * w.forest + zone.canyon.g * w.canyon + zone.ruins.g * w.ruins,
        zone.forest.b * w.forest + zone.canyon.b * w.canyon + zone.ruins.b * w.ruins,
      );
      // Asfalt
      surface.quad(at(prev, hw0, 0, ps), at(prev, -hw0, 0, ps), at(i, hw1, 0, s), at(i, -hw1, 0, s), c);
      // Yelkalar: burilishda — biroz ko'tarilgan qizil-oq bordyur (har 2 m rang almashadi), aks holda — oddiy chekka
      const isKerb = sharp[i] && sharp[prev];
      const shoulderCol = isKerb ? kerb[i % 2] : edge;
      const rise = isKerb ? 0.04 : 0;
      for (const side of [1, -1]) {
        const inner0 = at(prev, side * hw0, rise, ps);
        const inner1 = at(i, side * hw1, rise, s);
        const outer0 = at(prev, side * (hw0 + SHOULDER), -0.08, ps);
        const outer1 = at(i, side * (hw1 + SHOULDER), -0.08, s);
        if (side > 0) surface.quad(outer0, inner0, outer1, inner1, shoulderCol);
        else surface.quad(inner0, outer0, inner1, outer1, shoulderCol);
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
      // Markaziy uzuq chiziq
      if (prev % DASH_PERIOD < DASH_ON && Math.min(hw0, hw1) > CENTER_MIN_HALF_WIDTH) {
        const h = CENTER_LINE_WIDTH / 2;
        lines.quad(at(prev, h, LINE_LIFT, ps), at(prev, -h, LINE_LIFT, ps), at(i, h, LINE_LIFT, s), at(i, -h, LINE_LIFT, s), line);
      }
    }
    prev = i;
  }
  return { surface: surface.build(), lines: lines.build() };
}

export function Road() {
  const track = useTrack();
  // Plitkali trassada (Gran Pri) yo'l — kit modellari (KitTrack)
  return track.TILE_SIZE ? null : <RoadMesh track={track} />;
}

function RoadMesh({ track }: { track: Track }) {
  const palette = usePalette();
  const { weather } = useActiveSettings();
  const { surface, lines } = useMemo(() => buildRoadGeometry(track, palette), [track, palette]);
  const map = asphalt();
  const roughness = ROUGHNESS[weather];
  return (
    <>
      <mesh geometry={surface} receiveShadow>
        {/* polygonOffset — relyef bilan z-fighting bo'lmasligi uchun */}
        <meshStandardMaterial
          vertexColors
          map={map}
          roughness={roughness}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh geometry={lines} receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={map}
          roughness={Math.min(0.9, roughness + 0.1)}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
    </>
  );
}
