import { useEffect, useRef } from 'react';
import { useRapier, type RapierRigidBody } from '@react-three/rapier';
import { createVehicleController, type VehicleController } from './vehicleSetup';

/**
 * Vehicle controller'ni React hayot sikliga bog'laydi: chassis rigid body tayyor bo'lganda
 * (birinchi fizika qadamida) yaratiladi va unmount'da o'chiriladi.
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
    if (!ref.current && chassis) ref.current = createVehicleController(world, chassis);
    return ref.current;
  };

  return { controller: ref, ensure };
}
