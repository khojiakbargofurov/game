import { CAR, NO_LOOK, type CarId, type CarLook } from '@game/shared';
import { WHEEL_REST_Y, useCarModel } from './carGeometry';
import { cosmeticMaterial, neonMaterial, paintedTextureMaterial } from './tuningParts';

/** Neon tekisligi yerdan shuncha balandda (g'ildirak pastidan) */
const NEON_Y = WHEEL_REST_Y - CAR.WHEEL_RADIUS + 0.06;

/**
 * Mashina korpusi (g'ildiraksiz), mashina oldi = +Z. Model: CARS ro'yxatidan (carGeometry.ts).
 * Tuningsiz — 1 ta draw call (ranglar vertex rangda); bo'yoq tanlansa korpus ikkiga bo'linadi.
 * Teksturali modelda bo'yoq — qayta bo'yalgan tekstura (korpus bo'linmaydi).
 * Neon — vizual tuning (look).
 */
export function CarBody({ car, look = NO_LOOK }: { car: CarId; look?: CarLook }) {
  const model = useCarModel(car);
  const paint = model.texture ? undefined : cosmeticMaterial('paint', look.paint);
  const painted = model.texture ? paintedTextureMaterial(model, look.paint) : undefined;
  const neon = neonMaterial(look.neon);
  const { min, max } = model.bounds;
  const neonY = NEON_Y - model.wheelDrop;
  return (
    <>
      {paint ? (
        <>
          <mesh geometry={model.bodyRest} material={model.bodyMaterial} castShadow receiveShadow />
          <mesh geometry={model.paint} material={paint} castShadow receiveShadow />
        </>
      ) : (
        <mesh geometry={model.body} material={painted ?? model.bodyMaterial} castShadow receiveShadow />
      )}
      {neon && (
        <mesh
          position={[0, neonY, (min.z + max.z) / 2]}
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
