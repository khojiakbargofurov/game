import type { CarId } from '@game/shared';
import { bodyMaterial, useCarModel } from './carGeometry';

/**
 * Mashina korpusi (g'ildiraksiz), mashina oldi = +Z. Model: CARS ro'yxatidan (carGeometry.ts).
 * 1 ta draw call — ranglar vertex rangda.
 */
export function CarBody({ car }: { car: CarId }) {
  const { body } = useCarModel(car);
  return <mesh geometry={body} material={bodyMaterial} castShadow receiveShadow />;
}
