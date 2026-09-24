import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { COLORS } from '@game/shared';
import { detailMaterial, useCarModel } from './carGeometry';

/**
 * Mashina korpusi (g'ildiraksiz), mashina oldi = +Z. Model: raceCarRed.glb (carGeometry.ts).
 * 2 ta draw call: o'yinchi rangidagi korpus va qolgan detallar.
 */
export function CarBody({ color = COLORS.car }: { color?: string }) {
  const model = useCarModel();
  const paint = useMemo(() => new MeshStandardMaterial({ color, flatShading: true }), [color]);
  useEffect(() => () => paint.dispose(), [paint]);
  return (
    <group>
      <mesh geometry={model.paint} material={paint} castShadow />
      <mesh geometry={model.detail} material={detailMaterial} castShadow receiveShadow />
    </group>
  );
}
