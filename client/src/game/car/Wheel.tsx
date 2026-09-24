import { forwardRef } from 'react';
import type { Group } from 'three';
import type { CarId } from '@game/shared';
import { useCarModel, wheelMaterial } from './carGeometry';
import { cosmeticMaterial } from './tuningParts';

/**
 * G'ildirak vizuali (shina + disk — bitta mesh; disk rangi tanlansa — ikkita). Tashqi group — pozitsiya + rul (Y),
 * ichki `spin` group — aylanish (X). Car komponenti har kadrda ularni vehicle controllerdan yangilaydi.
 * `right` — o'ng tomondagi g'ildirak: disk tashqariga (-X) qarashi uchun 180° buriladi.
 */
export const Wheel = forwardRef<Group, { car: CarId; right?: boolean; rim?: string | null }>(function Wheel(
  { car, right = false, rim = null },
  ref,
) {
  const model = useCarModel(car);
  const rimMaterial = cosmeticMaterial('rim', rim);
  const rotation = right ? Math.PI : 0;
  return (
    <group ref={ref}>
      <group name="spin">
        {rimMaterial ? (
          <>
            <mesh geometry={model.tire} material={wheelMaterial} rotation-y={rotation} castShadow />
            <mesh geometry={model.rim} material={rimMaterial} rotation-y={rotation} castShadow />
          </>
        ) : (
          <mesh geometry={model.wheel} material={wheelMaterial} rotation-y={rotation} castShadow />
        )}
      </group>
    </group>
  );
});
