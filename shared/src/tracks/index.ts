import { ADVENTURE } from './adventure';
import { ALPINE } from './alpine';
import { CITY } from './city';
import { CIRCUIT } from './circuit';
import { createTrack } from './createTrack';
import { LAKE } from './lake';
import { MOUNTAIN } from './mountain';
import type { Track, TrackDef } from './types';

export * from './types';
export { createTrack } from './createTrack';
export * from './tiles';

/** Menyudagi tartibda */
export const TRACK_DEFS: readonly TrackDef[] = [ADVENTURE, MOUNTAIN, LAKE, CIRCUIT, ALPINE, CITY];

export type TrackId = 'adventure' | 'mountain' | 'lake' | 'circuit' | 'alpine' | 'city';
export const DEFAULT_TRACK: TrackId = 'adventure';

export function isTrackId(v: unknown): v is TrackId {
  return TRACK_DEFS.some((t) => t.id === v);
}

const cache = new Map<string, Track>();

/** Trassa bir marta quriladi (relyef namunalari va h.k.) va keshlanadi */
export function getTrack(id: TrackId): Track {
  let t = cache.get(id);
  if (!t) cache.set(id, (t = createTrack(TRACK_DEFS.find((d) => d.id === id)!)));
  return t;
}

// Trassadan qat'i nazar umumiy konstantalar
export const COIN_RADIUS = 2.2;
export const BOOST_RADIUS = 2.6;
export const BOOST_RESPAWN_MS = 6000;
