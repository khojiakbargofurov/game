/**
 * Yuklanish vaqtini o'lchash: relyef namunalash, manzara, Rapier trimesh collider.
 *   npm run profile:load -w client
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { PlaneGeometry } from 'three';
import { DEFAULT_TRACK, WORLD, getTrack, isTrackId, type TerrainSample } from '@game/shared';
import { generatePlacements } from '../src/game/scenery/placement';

const time = async <T>(label: string, fn: () => T | Promise<T>) => {
  const t0 = performance.now();
  const r = await fn();
  console.log(`${label.padEnd(34)} ${(performance.now() - t0).toFixed(0).padStart(6)} ms`);
  return r;
};

const arg = process.argv[2];
const track = getTrack(isTrackId(arg) ? arg : DEFAULT_TRACK);
const { sampleTerrain } = track;

await time('Rapier WASM init', () => RAPIER.init());

const geo = await time('Relyef: 63k nuqta sampleTerrain', () => {
  const g = new PlaneGeometry(WORLD.TERRAIN_SIZE, WORLD.TERRAIN_SIZE, WORLD.TERRAIN_SEGMENTS, WORLD.TERRAIN_SEGMENTS);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const t: TerrainSample = { height: 0, s: 0, dist: 0, roadY: 0, halfWidth: 0, forest: 0, canyon: 0, ruins: 0 };
  for (let i = 0; i < pos.count; i++) pos.setY(i, sampleTerrain(pos.getX(i), pos.getZ(i), t).height);
  return g;
});

await time('Manzara joylashuvi', () => generatePlacements(track));

await time('Rapier trimesh collider (125k tri)', () => {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(geo.attributes.position.array as Float32Array, geo.index!.array as Uint32Array),
  );
  world.step();
});
