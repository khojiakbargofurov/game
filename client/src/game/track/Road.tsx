import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color } from 'three';
import { ROUTE_STEP, type Palette, type Track } from '@game/shared';
import { usePalette, useTrack } from '../../store/raceSettings';

const SHOULDER = 0.9;
const LIFT = 0.05;

/**
 * Yo'l lentasi: marshrut namunalari bo'ylab (har 2 m) kesim — chekka, yo'l, yo'l, chekka.
 * Faqat vizual; fizika relyefda (yo'l ostidagi relyef allaqachon tekislangan).
 * Ko'prik uchastkasida chizilmaydi — u yerda ko'prik taxtalari bor.
 */
function buildRoadGeometry({ ROUTE, BRIDGE, roadHalfWidth, zoneWeights }: Track, COLORS: Palette) {
  const { xs, ys, zs, txs, tzs, count } = ROUTE;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const road = { forest: new Color(COLORS.roadForest), canyon: new Color(COLORS.roadCanyon), ruins: new Color(COLORS.roadRuins) };
  const edge = new Color(COLORS.roadEdge);
  const c = new Color();

  let prevRow = -1;
  for (let i = 0; i < count; i++) {
    const s = i * ROUTE_STEP;
    const onBridge = !!BRIDGE && s > BRIDGE.start - 1 && s < BRIDGE.end + 1;
    if (onBridge) {
      prevRow = -1;
      continue;
    }
    const hw = roadHalfWidth(s);
    const w = zoneWeights(s);
    c.setRGB(
      road.forest.r * w.forest + road.canyon.r * w.canyon + road.ruins.r * w.ruins,
      road.forest.g * w.forest + road.canyon.g * w.canyon + road.ruins.g * w.ruins,
      road.forest.b * w.forest + road.canyon.b * w.canyon + road.ruins.b * w.ruins,
    );
    // Chap vektor: (tz, 0, -tx)
    const lx = tzs[i];
    const lz = -txs[i];
    const row = positions.length / 3;
    for (const [off, drop, col] of [
      [hw + SHOULDER, -0.08, edge],
      [hw, 0, c],
      [-hw, 0, c],
      [-hw - SHOULDER, -0.08, edge],
    ] as const) {
      positions.push(xs[i] + lx * off, ys[i] + LIFT + drop, zs[i] + lz * off);
      colors.push(col.r, col.g, col.b);
    }
    if (prevRow >= 0) {
      for (let k = 0; k < 3; k++) {
        const a = prevRow + k;
        const b = row + k;
        indices.push(a, a + 1, b, a + 1, b + 1, b); // normal tepaga
      }
    }
    prevRow = row;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * F1 halqasi: asfalt, ikki chetida oq chiziq, burilishlarda qizil-oq kerblar (har 2 m da navbatma-navbat).
 * Indekssiz — har bo'lak o'z rangida (kerb chiziqlari keskin).
 */
function buildCircuitGeometry({ ROUTE, roadHalfWidth }: Track, COLORS: Palette) {
  const { xs, ys, zs, txs, tzs, count } = ROUTE;
  const positions: number[] = [];
  const colors: number[] = [];
  const asphalt = new Color(COLORS.roadCircuit);
  const line = new Color(COLORS.kerbWhite);
  const red = new Color(COLORS.kerbRed);
  const white = new Color(COLORS.kerbWhite);
  const KERB = 1.3;
  const LINE = 0.3;

  /** `i` namunadagi burilish radiusi (±5 namuna oralig'ida yo'nalish o'zgarishi bo'yicha) */
  const radiusAt = (i: number) => {
    const a = Math.max(0, i - 5);
    const b = Math.min(count - 1, i + 5);
    const da = Math.atan2(txs[b], tzs[b]) - Math.atan2(txs[a], tzs[a]);
    const d = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
    return ((b - a) * ROUTE_STEP) / Math.max(d, 1e-6);
  };
  const point = (i: number, off: number, up: number) => [xs[i] + tzs[i] * off, ys[i] + LIFT + up, zs[i] - txs[i] * off];
  /** i → i+1 oralig'ida `from`..`to` yon ofsetlar orasidagi to'rtburchak */
  const quad = (i: number, from: number, to: number, upFrom: number, upTo: number, col: Color) => {
    const a = point(i, from, upFrom);
    const b = point(i, to, upTo);
    const c = point(i + 1, from, upFrom);
    const d = point(i + 1, to, upTo);
    // Normal tepaga: ofset o'sishi chap tomonga, s o'sishi oldinga
    for (const v of from < to ? [a, c, b, b, c, d] : [a, b, c, b, d, c]) {
      positions.push(v[0], v[1], v[2]);
      colors.push(col.r, col.g, col.b);
    }
  };

  for (let i = 0; i < count - 1; i++) {
    const hw = roadHalfWidth(i * ROUTE_STEP);
    quad(i, -hw + LINE, hw - LINE, 0, 0, asphalt);
    quad(i, hw - LINE, hw, 0, 0, line);
    quad(i, -hw, -hw + LINE, 0, 0, line);
    if (radiusAt(i) < 150) {
      const col = i % 2 === 0 ? red : white;
      quad(i, hw, hw + KERB, 0.03, -0.05, col);
      quad(i, -hw - KERB, -hw, -0.05, 0.03, col);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geo.computeVertexNormals();
  return geo;
}

export function Road() {
  const track = useTrack();
  const palette = usePalette();
  const geometry = useMemo(
    () => (track.zoneAt(0) === 'circuit' ? buildCircuitGeometry(track, palette) : buildRoadGeometry(track, palette)),
    [track, palette],
  );
  return (
    <mesh geometry={geometry} receiveShadow>
      {/* polygonOffset — relyef bilan z-fighting bo'lmasligi uchun */}
      <meshStandardMaterial vertexColors roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}
