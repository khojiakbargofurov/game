import { forwardRef } from 'react';
import type { Group } from 'three';
import type { CarId } from '@game/shared';
import { useCarModel } from './carGeometry';
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
  // Disk alohida bo'lmagan modelda (teksturali) disk rangi qo'llanmaydi
  const rimMaterial = model.rim ? cosmeticMaterial('rim', rim) : undefined;
  const rotation = right ? Math.PI : 0;
  return (
    <group ref={ref}>
      <group name="spin">
        {rimMaterial ? (
          <>
            <mesh geometry={model.tire} material={model.wheelMaterial} rotation-y={rotation} castShadow />
            <mesh geometry={model.rim!} material={rimMaterial} rotation-y={rotation} castShadow />
          </>
        ) : (
          <mesh geometry={model.wheel} material={model.wheelMaterial} rotation-y={rotation} castShadow />
        )}
      </group>
    </group>
  );
});
