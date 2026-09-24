import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';
import { COINS, COLORS } from '@game/shared';
import { pickups } from '../../store/pickups';

const o = new Object3D();

/**
 * Barcha tangalar — bitta InstancedMesh. Har kadrda aylanadi va tebranadi;
 * olingan tangalar 0 masshtab bilan yashiriladi. Yig'ish logikasi — RaceLogic'da.
 */
export function Coins() {
  const ref = useRef<InstancedMesh>(null);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < COINS.length; i++) {
      const [x, y, z] = COINS[i].position;
      o.position.set(x, y + Math.sin(t * 2 + i * 0.6) * 0.15, z);
      o.rotation.set(Math.PI / 2, 0, t * 2.5 + i * 0.3);
      o.scale.setScalar(pickups.coins[i] ? 0 : 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COINS.length]} castShadow frustumCulled={false}>
      <cylinderGeometry args={[0.55, 0.55, 0.14, 10]} />
      <meshStandardMaterial color={COLORS.gold} emissive={COLORS.gold} emissiveIntensity={0.35} metalness={0.6} roughness={0.35} flatShading />
    </instancedMesh>
  );
}
