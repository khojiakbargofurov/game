import { useEffect, useRef } from 'react';
import { useRapier, type RapierRigidBody } from '@react-three/rapier';
import { CAR } from '@game/shared';
import { createVehicleController, type VehicleController } from './vehicleSetup';

/**
 * Vehicle controller'ni React hayot sikliga bog'laydi: chassis rigid body tayyor bo'lganda yaratiladi
 * va unmount'da o'chiriladi.
 *
 * @react-three/rapier collider'ni avval standart zichlik bilan (~3 kg) yaratadi, `massProperties` esa keyinroq
 * useEffect'da qo'llanadi — controller birinchi qadamni yengil korpus bilan o'tkazmasligi uchun faqat haqiqiy
 * massa o'rnatilgandan keyin yaratiladi.
 */
export function useVehicleController() {
  const { world } = useRapier();
  const ref = useRef<VehicleController | null>(null);

  useEffect(
    () => () => {
      if (ref.current) world.removeVehicleController(ref.current);
      ref.current = null;
    },
    [world],
  );

  const ensure = (chassis: RapierRigidBody | null) => {
    if (!ref.current && chassis && chassis.mass() > CAR.MASS * 0.5) ref.current = createVehicleController(world, chassis);
    return ref.current;
  };

  return { controller: ref, ensure };
}
