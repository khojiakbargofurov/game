import { createRng, type TerrainSample, type Track } from '@game/shared';

export type Kind = 'pine' | 'broadleaf' | 'rock' | 'redRock';

export interface Placement {
  kind: Kind;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  /** Yo'lga yaqin — fizik collider beriladi */
  solid: boolean;
  /** Rang variatsiyasi uchun 0..1 */
  tint: number;
  /** Sifat darajasi bo'yicha saralash uchun 0..1: `lod < sceneryDensity` bo'lsa ko'rsatiladi */
  lod: number;
}

/** Shu masofadan yaqin obyektlarga collider beriladi (uzoqdagilar faqat vizual) */
const SOLID_DISTANCE = 30;

/**
 * Manzara joylashuvi (deterministik): marshrut bo'ylab tasodifiy `s` va yon ofset tanlanadi,
 * so'ng o'sha nuqtaning zonasiga qarab daraxt yoki qoya qo'yiladi.
 * Yo'l, ko'prik jarligi va tunnel ichiga tushgan nuqtalar tashlab yuboriladi.
 */
export function generatePlacements(track: Track): Placement[] {
  const { BRIDGE, TUNNEL, LAKE, ROUTE_LENGTH, roadHalfWidth, sampleTerrain, trackPoint } = track;
  const rng = createRng(2024);
  const out: Placement[] = [];
  const t: TerrainSample = { height: 0, s: 0, dist: 0, roadY: 0, halfWidth: 0, forest: 0, canyon: 0, ruins: 0, circuit: 0 };

  for (let attempt = 0; attempt < 5200; attempt++) {
    const s = rng() * ROUTE_LENGTH;
    // Yo'lga yaqin joylar zichroq: masofa kvadratik taqsimlangan
    const far = 5 + rng() ** 1.6 * 170;
    const side = rng() < 0.5 ? 1 : -1;
    const [x, , z] = trackPoint(s, side * (roadHalfWidth(s) + far)).position;
    sampleTerrain(x, z, t);

    const clearance = t.dist - t.halfWidth;
    if (clearance < 4) continue; // yo'l ustida emas
    if (BRIDGE && t.s > BRIDGE.start - 15 && t.s < BRIDGE.end + 15 && clearance < 60) continue; // jarlik
    if (TUNNEL && t.s > TUNNEL.start - 5 && t.s < TUNNEL.end + 5 && clearance < 14) continue; // tunnel
    if (LAKE && t.height < LAKE.y + 0.4) continue; // suv ostida

    const r = rng();
    let kind: Kind | null = null;
    if (t.forest > 0.5) kind = r < 0.78 ? 'pine' : r < 0.93 ? 'broadleaf' : 'rock';
    else if (t.canyon > 0.5) {
      // Kanyonda asosan qoyalar; daraxtlar faqat devor tepasida, siyrak
      const onTop = t.height - t.roadY > 12;
      kind = r < 0.55 ? 'redRock' : onTop && r < 0.7 ? 'broadleaf' : null;
    } else if (t.circuit > 0.5) {
      // F1 halqasi: keng xavfsizlik zonasi (run-off) bo'sh, daraxtlar faqat uzoqda va siyrak
      if (clearance < 45) continue;
      kind = r < 0.3 ? 'broadleaf' : r < 0.5 ? 'pine' : null;
    } else kind = r < 0.25 ? 'broadleaf' : r < 0.45 ? 'rock' : r < 0.52 ? 'pine' : null;
    if (!kind) continue;

    const isRock = kind === 'rock' || kind === 'redRock';
    out.push({
      kind,
      x,
      y: t.height,
      z,
      scale: isRock ? 0.7 + rng() * 2.2 : 0.8 + rng() * 0.8,
      rotation: rng() * Math.PI * 2,
      solid: clearance < SOLID_DISTANCE,
      tint: rng(),
      lod: rng(),
    });
  }
  return out;
}
