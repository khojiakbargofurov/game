import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color } from 'three';
import { BRIDGE, COLORS, ROUTE, ROUTE_STEP, roadHalfWidth, zoneWeights } from '@game/shared';

const SHOULDER = 0.9;
const LIFT = 0.05;

/**
 * Yo'l lentasi: marshrut namunalari bo'ylab (har 2 m) kesim — chekka, yo'l, yo'l, chekka.
 * Faqat vizual; fizika relyefda (yo'l ostidagi relyef allaqachon tekislangan).
 * Ko'prik uchastkasida chizilmaydi — u yerda ko'prik taxtalari bor.
 */
function buildRoadGeometry() {
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
    const onBridge = s > BRIDGE.start - 1 && s < BRIDGE.end + 1;
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

export function Road() {
  const geometry = useMemo(buildRoadGeometry, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      {/* polygonOffset — relyef bilan z-fighting bo'lmasligi uchun */}
      <meshStandardMaterial vertexColors roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}
