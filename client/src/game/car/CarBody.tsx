import { CAR, NO_LOOK, type CarId, type CarLook } from '@game/shared';
import { WHEEL_REST_Y, bodyMaterial, useCarModel } from './carGeometry';
import { cosmeticMaterial, neonMaterial, useSpoilerGeometry } from './tuningParts';

/** Neon tekisligi yerdan shuncha balandda (g'ildirak pastidan) */
const NEON_Y = WHEEL_REST_Y - CAR.WHEEL_RADIUS + 0.06;

/**
 * Mashina korpusi (g'ildiraksiz), mashina oldi = +Z. Model: CARS ro'yxatidan (carGeometry.ts).
 * Tuningsiz — 1 ta draw call (ranglar vertex rangda); bo'yoq tanlansa korpus ikkiga bo'linadi.
 * Spoyler va neon — vizual tuning (look).
 */
export function CarBody({ car, look = NO_LOOK }: { car: CarId; look?: CarLook }) {
  const model = useCarModel(car);
  const paint = cosmeticMaterial('paint', look.paint);
  const spoiler = useSpoilerGeometry(model, look.spoiler);
  const neon = neonMaterial(look.neon);
  const { min, max } = model.bounds;
  return (
    <>
      {paint ? (
        <>
          <mesh geometry={model.bodyRest} material={bodyMaterial} castShadow receiveShadow />
          <mesh geometry={model.paint} material={paint} castShadow receiveShadow />
        </>
      ) : (
        <mesh geometry={model.body} material={bodyMaterial} castShadow receiveShadow />
      )}
      {spoiler && (
        <mesh geometry={spoiler} material={paint ?? cosmeticMaterial('spoiler', look.spoiler)} castShadow />
      )}
      {neon && (
        <mesh
          position={[0, NEON_Y, (min.z + max.z) / 2]}
          rotation-x={-Math.PI / 2}
          scale={[(max.x - min.x) * 1.5, (max.z - min.z) * 1.25, 1]}
          material={neon}
          renderOrder={1}
        >
          <planeGeometry />
        </mesh>
      )}
    </>
  );
}
