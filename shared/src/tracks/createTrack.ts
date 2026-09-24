import { WORLD } from '../config';
import { fbm2D } from '../noise';
import { buildRoute, nearestOnRouteOf, routeFrameAt, yawOf, type NearestResult, type RouteFrame } from '../route';
import type { Checkpoint, Pickup, TerrainSample, Track, TrackDef, ZoneName, ZoneWeights } from './types';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Zonalar orasidagi silliq o'tish uzunligi (m) */
const ZONE_BLEND = 30;
const HALF_WIDTH: Record<ZoneName, number> = { forest: 7, canyon: 5, ruins: 6, circuit: 8 };

/** Trassa ta'rifidan to'liq trassa: marshrut, zonalar, relyef, checkpointlar, tangalar */
export function createTrack(def: TrackDef): Track {
  const loop = !!def.laps;
  const ROUTE = buildRoute(def.control, loop);
  const ROUTE_LENGTH = ROUTE.length;
  const LAPS = def.laps ?? 1;
  const LINE_S = def.startLine ?? 20;
  const totalS = (localS: number, ref: number) =>
    loop ? localS + Math.round((ref - localS) / ROUTE_LENGTH) * ROUTE_LENGTH : localS;
  const { bridge: BRIDGE, tunnel: TUNNEL, narrow: NARROW, lake: LAKE } = def;

  const routeAt = (s: number, out?: RouteFrame) => routeFrameAt(ROUTE, s, out);
  const nearestOnRoute = (x: number, z: number, out?: NearestResult) => nearestOnRouteOf(ROUTE, x, z, out);

  // ─── Zonalar ───
  /** Zonalar orasida silliq o'tish uchun og'irliklar (yig'indisi = 1) */
  function zoneWeights(s: number, out: ZoneWeights = { forest: 0, canyon: 0, ruins: 0, circuit: 0 }): ZoneWeights {
    out.forest = out.canyon = out.ruins = out.circuit = 0;
    const b = ZONE_BLEND / 2;
    let enter = 1; // shu zonaga kirish koeffitsiyenti (oldingi chegaradan o'tganlik)
    for (let k = 0; k < def.zones.length; k++) {
      const z = def.zones[k];
      const leave = k === def.zones.length - 1 ? 0 : smoothstep(z.end - b, z.end + b, s);
      out[z.type] += enter - leave;
      enter = leave;
    }
    return out;
  }

  function zoneAt(s: number): ZoneName {
    for (const z of def.zones) if (s < z.end) return z.type;
    return def.zones[def.zones.length - 1].type;
  }

  // ─── Yo'l kengligi va maxsus uchastkalar ───
  const tmpW: ZoneWeights = { forest: 0, canyon: 0, ruins: 0, circuit: 0 };

  /** Yo'lning yarim kengligi `s` nuqtada */
  function roadHalfWidth(s: number): number {
    const w = zoneWeights(s, tmpW);
    let hw =
      w.forest * HALF_WIDTH.forest + w.canyon * HALF_WIDTH.canyon + w.ruins * HALF_WIDTH.ruins + w.circuit * HALF_WIDTH.circuit;
    // Ko'prik va tor yo'lakda yo'l torayadi (10 m davomida silliq)
    if (BRIDGE) {
      const k = smoothstep(BRIDGE.start - 12, BRIDGE.start - 2, s) * (1 - smoothstep(BRIDGE.end + 2, BRIDGE.end + 12, s));
      hw += (BRIDGE.halfWidth - hw) * k;
    }
    if (NARROW) {
      const k = smoothstep(NARROW.start - 10, NARROW.start, s) * (1 - smoothstep(NARROW.end, NARROW.end + 10, s));
      hw += (NARROW.halfWidth - hw) * k;
    }
    return hw;
  }

  /** Jarlik chuqurligi koeffitsiyenti (0..1): ko'prik ostida 1 */
  const gorgeFactor = (s: number) =>
    BRIDGE ? smoothstep(BRIDGE.start, BRIDGE.start + 8, s) * (1 - smoothstep(BRIDGE.end - 8, BRIDGE.end, s)) : 0;

  /** Tunnel ustidagi tog' balandligi koeffitsiyenti (0..1) */
  const tunnelFactor = (s: number) =>
    TUNNEL ? smoothstep(TUNNEL.start - 25, TUNNEL.start, s) * (1 - smoothstep(TUNNEL.end, TUNNEL.end + 25, s)) : 0;

  const frame: RouteFrame = { s: 0, x: 0, y: 0, z: 0, tx: 0, tz: 1 };
  function trackPoint(s: number, lateral = 0, up = 0) {
    const f = routeAt(s, frame);
    return {
      position: [f.x + f.tz * lateral, f.y + up, f.z - f.tx * lateral] as [number, number, number],
      yaw: yawOf(f.tx, f.tz),
    };
  }

  // ─── Relyef ───
  const near: NearestResult = { s: 0, dist: 0, lateral: 0, roadY: 0 };
  const seed = WORLD.SEED + def.seed;

  /**
   * Relyef: marshrut atrofida yo'l tekislanadi, uzoqlashgan sari zona xarakteri kuchayadi:
   *  - o'rmon: yumshoq tepaliklar
   *  - kanyon: yo'l ikki tomonida tik qoya devorlar (tunnel ustida yanada baland)
   *  - xarobalar: past do'ngliklar bilan plato
   * Ko'prik ostida jarlik o'yiladi, ko'l atrofida relyef suv ostiga botadi.
   */
  function sampleTerrain(
    x: number,
    z: number,
    out: TerrainSample = { height: 0, s: 0, dist: 0, roadY: 0, halfWidth: 0, forest: 0, canyon: 0, ruins: 0, circuit: 0 },
  ): TerrainSample {
    const n = nearestOnRoute(x, z, near);
    const hw = roadHalfWidth(n.s);
    const w = zoneWeights(n.s, out);
    const d = n.dist;
    const road = n.roadY;

    const hills = fbm2D(x / 90, z / 90, seed, 4); // ~0..1
    const detail = fbm2D(x / 18, z / 18, seed + 99, 2);

    let h = road;
    if (w.forest > 0) {
      const far = smoothstep(hw + 3, hw + 45, d);
      h += w.forest * ((hills - 0.35) * WORLD.TERRAIN_HEIGHT + (detail - 0.5) * 1.5) * far;
    }
    if (w.canyon > 0) {
      const wall = smoothstep(hw + 2, hw + 14, d);
      const height = WORLD.CANYON_WALL + (hills - 0.5) * 10 + (detail - 0.5) * 4 + 12 * tunnelFactor(n.s);
      h += w.canyon * height * wall;
    }
    if (w.ruins > 0) {
      const far = smoothstep(hw + 4, hw + 40, d);
      h += w.ruins * ((hills - 0.5) * 6 + (detail - 0.5)) * far;
    }
    if (w.circuit > 0) {
      // Keng tekis xavfsizlik zonasi (run-off), uzoqda — past do'ngliklar
      const far = smoothstep(hw + 30, hw + 90, d);
      h += w.circuit * ((hills - 0.4) * 8 + (detail - 0.5)) * far;
    }
    if (BRIDGE) h -= BRIDGE.gorgeDepth * gorgeFactor(n.s);
    if (LAKE) {
      // Qirg'oq yo'ldan kamida 6 m uzoqda boshlanadi — yo'l o'zi hech qachon botmaydi
      const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
      const k = (1 - smoothstep(LAKE.radius - 30, LAKE.radius, dl)) * smoothstep(hw + 6, hw + 20, d);
      h += (LAKE.y - LAKE.depth - h) * k;
    }

    out.height = h;
    out.s = n.s;
    out.dist = d;
    out.roadY = road;
    out.halfWidth = hw;
    return out;
  }

  const tmp: TerrainSample = { height: 0, s: 0, dist: 0, roadY: 0, halfWidth: 0, forest: 0, canyon: 0, ruins: 0, circuit: 0 };
  const terrainHeight = (x: number, z: number) => sampleTerrain(x, z, tmp).height;

  // ─── Start, checkpointlar, tangalar, boostlar ───
  // Halqada: yakka start — chiziqdan 12 m orqada, panjara — chiziq ortida 2 qator × 4 (F1 kabi)
  const START = loop ? trackPoint(LINE_S - 12, 0, 1.2) : trackPoint(8, 0, 1.2);

  function gridSpawn(slot: number) {
    const row = Math.floor(slot / 2);
    const lateral = slot % 2 === 0 ? 2.2 : -2.2;
    return loop ? trackPoint(LINE_S - 8 - row * 7, lateral, 1.2) : trackPoint(26 - row * 6, lateral, 1.2);
  }

  const checkpoint = (s: number, total: number, lap: number, isLapLine: boolean, isFinish: boolean): Checkpoint => {
    const p = trackPoint(s, 0, 0);
    return { index: 0, s, totalS: total, lap, isLapLine, position: p.position, yaw: p.yaw, radius: roadHalfWidth(s) + 3, isFinish };
  };
  const CHECKPOINTS: Checkpoint[] = [];
  if (loop) {
    // Har aylana: oraliq checkpointlar, so'ng start/marra chizig'i (oxirgi aylanada — marra)
    for (let lap = 0; lap < LAPS; lap++) {
      for (const s of def.checkpoints) CHECKPOINTS.push(checkpoint(s, lap * ROUTE_LENGTH + s, lap, false, false));
      CHECKPOINTS.push(checkpoint(LINE_S, (lap + 1) * ROUTE_LENGTH + LINE_S, lap, true, lap === LAPS - 1));
    }
  } else {
    for (const s of def.checkpoints) CHECKPOINTS.push(checkpoint(s, s, 0, false, false));
    CHECKPOINTS.push(checkpoint(ROUTE_LENGTH - 10, ROUTE_LENGTH - 10, 0, true, true));
  }
  CHECKPOINTS.forEach((cp, i) => (cp.index = i));

  /** Tangalar: har 45 m da 4 talik guruh, turli naqshlarda (markaz / chap / o'ng / zigzag) */
  const COINS: Pickup[] = [];
  for (let g = 35, group = 0; g < ROUTE_LENGTH - 25; g += 45, group++) {
    const hw = roadHalfWidth(g);
    const pattern = group % 4;
    for (let k = 0; k < 4; k++) {
      const lateral =
        pattern === 0 ? 0 : pattern === 1 ? hw * 0.45 : pattern === 2 ? -hw * 0.45 : (k % 2 ? 1 : -1) * hw * 0.35;
      COINS.push({ id: COINS.length, position: trackPoint(g + k * 5, lateral, 1.1).position });
    }
  }

  /** Boost-kristallar (olingandan keyin BOOST_RESPAWN_MS dan so'ng qayta paydo bo'ladi) */
  const BOOSTS: Pickup[] = def.boosts.map((s, id) => ({ id, position: trackPoint(s, 0, 1.3).position }));

  return {
    id: def.id,
    def,
    ROUTE,
    ROUTE_LENGTH,
    LAPS,
    LINE_S,
    totalS,
    routeAt,
    nearestOnRoute,
    zoneWeights,
    zoneAt,
    BRIDGE,
    TUNNEL,
    NARROW,
    LAKE,
    roadHalfWidth,
    gorgeFactor,
    tunnelFactor,
    trackPoint,
    START,
    gridSpawn,
    CHECKPOINTS,
    COINS,
    BOOSTS,
    RAMPS: def.ramps,
    LOGS: def.logs,
    FALLEN_PILLARS: def.fallenPillars,
    ARCHES: def.arches,
    BOULDER_SPAWNERS: def.boulderSpawners,
    GRANDSTANDS: def.grandstands ?? [],
    sampleTerrain,
    terrainHeight,
  };
}
