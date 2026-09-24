import { forwardRef } from 'react';
import type { Group } from 'three';
import type { CarId } from '@game/shared';
import { useCarModel, wheelMaterial } from './carGeometry';

/**
 * G'ildirak vizuali (shina + disk — bitta mesh). Tashqi group — pozitsiya + rul (Y),
 * ichki `spin` group — aylanish (X). Car komponenti har kadrda ularni vehicle controllerdan yangilaydi.
 * `right` — o'ng tomondagi g'ildirak: disk tashqariga (-X) qarashi uchun 180° buriladi.
 */
export const Wheel = forwardRef<Group, { car: CarId; right?: boolean }>(function Wheel({ car, right = false }, ref) {
  const { wheel } = useCarModel(car);
  return (
    <group ref={ref}>
      <group name="spin">
        <mesh geometry={wheel} material={wheelMaterial} rotation-y={right ? Math.PI : 0} castShadow />
      </group>
    </group>
  );
});
