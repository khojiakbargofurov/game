import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { BOOST_RESPAWN_MS, COLORS } from '@game/shared';
import { useTrack } from '../../store/raceSettings';
import { pickups } from '../../store/pickups';

/** Boost-kristallar: aylanadi, olingach BOOST_RESPAWN_MS davomida yashirinadi */
export function Boosts() {
  const refs = useRef<(Group | null)[]>([]);
  const { BOOSTS } = useTrack();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const now = performance.now();
    BOOSTS.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const taken = pickups.boostTakenAt[i];
      g.visible = !taken || now - taken > BOOST_RESPAWN_MS;
      g.rotation.y = t * 1.8;
      g.position.y = b.position[1] + Math.sin(t * 2.2 + i) * 0.25;
    });
  });

  return (
    <>
      {BOOSTS.map((b, i) => (
        <group key={b.id} ref={(el) => void (refs.current[i] = el)} position={b.position}>
          <mesh scale={[0.7, 1.2, 0.7]} castShadow>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={COLORS.crystal} emissive={COLORS.crystal} emissiveIntensity={1.2} flatShading transparent opacity={0.9} />
          </mesh>
          {/* Yerdagi yorug' halqa */}
          <mesh position={[0, -1.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.2, 1.6, 12]} />
            <meshBasicMaterial color={COLORS.crystal} transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </>
  );
}
