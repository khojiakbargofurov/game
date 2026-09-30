import { createRng, type TerrainSample, type Track } from '@game/shared';

export type Kind = 'pine' | 'broadleaf' | 'rock' | 'redRock' | 'shrub' | 'reed';

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
  const t: TerrainSample = { height: 0, s: 0, dist: 0, roadY: 0, halfWidth: 0, forest: 0, canyon: 0, ruins: 0, circuit: 0, alpine: 0, city: 0 };

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
    if (t.forest > 0.5) {
      // Tog'da qarag'ay va tosh, ko'l bo'yida esa bargli daraxt va past butalar ko'proq.
      // Yo'lga yaqin past o'simliklar bir xil baland daraxtlar qatorini buzib, manzarani tabiiyroq qiladi.
      const nearRoad = clearance < 24;
      if (nearRoad && r < 0.2) kind = 'shrub';
      else if (track.id === 'lake') kind = r < 0.55 ? 'pine' : r < 0.87 ? 'broadleaf' : r < 0.96 ? 'shrub' : 'rock';
      else if (track.id === 'mountain') kind = r < 0.72 ? 'pine' : r < 0.84 ? 'broadleaf' : r < 0.94 ? 'shrub' : 'rock';
      else kind = r < 0.72 ? 'pine' : r < 0.89 ? 'broadleaf' : r < 0.96 ? 'shrub' : 'rock';
    }
    else if (t.canyon > 0.5) {
      // Kanyonda asosan qoyalar; daraxtlar faqat devor tepasida, siyrak
      const onTop = t.height - t.roadY > 12;
      kind = r < 0.55 ? 'redRock' : onTop && r < 0.68 ? 'pine' : clearance < 25 && r < 0.76 ? 'shrub' : null;
    } else if (t.circuit > 0.5) {
      // F1 halqasi: keng xavfsizlik zonasi (run-off) bo'sh, daraxtlar faqat uzoqda va siyrak.
      // Plitkali trassada yaqin atrof (paddok, tribunalar, kit daraxtlari) — KitTrack'da
      if (clearance < (track.TILE_SIZE ? 110 : 45)) continue;
      kind = r < 0.3 ? 'broadleaf' : r < 0.5 ? 'pine' : null;
    } else if (t.city > 0.5) {
      continue; // shaharda — binolar (City.tsx)
    } else if (t.alpine > 0.5) {
      // Alp: pastda qarag'ay o'rmoni, yuqorida siyrak qoyalar, qor chizig'idan tepada — faqat qoyalar
      if (t.height > 90) kind = r < 0.25 ? 'rock' : null;
      else kind = r < 0.6 ? 'pine' : r < 0.78 ? 'rock' : null;
    } else kind = r < 0.25 ? 'broadleaf' : r < 0.45 ? 'rock' : r < 0.52 ? 'pine' : null;
    if (!kind) continue;

    const isRock = kind === 'rock' || kind === 'redRock';
    const isShrub = kind === 'shrub';
    out.push({
      kind,
      x,
      y: t.height,
      z,
      scale: isRock ? 0.7 + rng() * 2.2 : isShrub ? 0.45 + rng() * 0.75 : 0.8 + rng() * 0.8,
      rotation: rng() * Math.PI * 2,
      solid: !isShrub && clearance < SOLID_DISTANCE,
      tint: rng(),
      lod: rng(),
    });
  }

  // Ko'l suvining tekis doirasi quruqlikka keskin ulanib qolmasin: qirg'oq bo'ylab siyrak qamish halqasi.
  if (LAKE) {
    for (let i = 0; i < 220; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = LAKE.radius - 2 + rng() * 12;
      const x = LAKE.x + Math.cos(angle) * radius;
      const z = LAKE.z + Math.sin(angle) * radius;
      sampleTerrain(x, z, t);
      if (t.dist - t.halfWidth < 5) continue;
      out.push({
        kind: 'reed',
        x,
        y: Math.max(t.height, LAKE.y - 0.12),
        z,
        scale: 0.65 + rng() * 0.9,
        rotation: rng() * Math.PI * 2,
        solid: false,
        tint: rng(),
        lod: rng(),
      });
    }
  }
  return out;
}
