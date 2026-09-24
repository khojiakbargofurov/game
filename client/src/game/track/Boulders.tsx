import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { usePalette, useTrack } from '../../store/raceSettings';
import { carTarget } from '../carTarget';

const POOL_PER_SPAWNER = 2;
const RADIUS = 1.3;
const MASS = 400;
/** O'yinchi shu masofadan yaqin bo'lsagina toshlar tushadi */
const ACTIVE_DISTANCE = 110;
const INTERVAL = 3.2; // s
const LIFETIME = 9; // s
const HIDDEN_Y = -500;

interface Slot {
  spawner: number;
  bornAt: number;
}

/**
 * Kanyon devoridan yo'lga dumalab tushadigan toshlar (dinamik fizika).
 * Har bir manba uchun kichik "pool": tosh vaqti tugagach yashiriladi va qayta ishlatiladi.
 * Eslatma: toshlar har bir klientda mahalliy — tarmoq orqali sinxronlanmaydi.
 */
export function Boulders() {
  const { BOULDER_SPAWNERS, roadHalfWidth, routeAt, terrainHeight } = useTrack();
  const rockColor = usePalette().canyonB;
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const slots = useRef<Slot[]>(
    BOULDER_SPAWNERS.flatMap((_, spawner) =>
      Array.from({ length: POOL_PER_SPAWNER }, () => ({ spawner, bornAt: -Infinity })),
    ),
  );
  const nextSpawn = useRef(BOULDER_SPAWNERS.map((_, i) => i * 1.1));

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const car = carTarget.position;

    // Muddati o'tgan toshlarni yashirish
    slots.current.forEach((slot, i) => {
      const rb = bodies.current[i];
      if (rb && now - slot.bornAt > LIFETIME && rb.isEnabled()) {
        rb.setLinvel({ x: 0, y: 0, z: 0 }, false);
        rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
        rb.setEnabled(false);
        rb.setTranslation({ x: i * 8, y: HIDDEN_Y, z: 0 }, false);
      }
    });

    BOULDER_SPAWNERS.forEach((spawner, si) => {
      if (now < nextSpawn.current[si]) return;
      const f = routeAt(spawner.s);
      if (Math.hypot(car.x - f.x, car.z - f.z) > ACTIVE_DISTANCE) return;

      const idx = slots.current.findIndex((sl) => sl.spawner === si && now - sl.bornAt > LIFETIME);
      const rb = bodies.current[idx];
      if (idx < 0 || !rb) return;
      nextSpawn.current[si] = now + INTERVAL + Math.random() * 1.5;

      // Kanyon devori ustidan, yo'lga qarab itariladi
      const along = spawner.s + (Math.random() - 0.5) * 14;
      const g = routeAt(along);
      const off = spawner.side * (roadHalfWidth(along) + 12);
      const x = g.x + g.tz * off;
      const z = g.z - g.tx * off;
      const push = -spawner.side * (5 + Math.random() * 3);
      rb.setEnabled(true);
      rb.setTranslation({ x, y: terrainHeight(x, z) + RADIUS + 0.5, z }, true);
      rb.setLinvel({ x: g.tz * push, y: 0, z: -g.tx * push }, true);
      rb.setAngvel({ x: Math.random() * 2, y: 0, z: Math.random() * 2 }, true);
      slots.current[idx].bornAt = now;
    });
  });

  return (
    <>
      {slots.current.map((_, i) => (
        <RigidBody
          key={i}
          ref={(rb) => {
            bodies.current[i] = rb;
            // Darhol (birinchi fizika qadamidan oldin) o'chiriladi. Aks holda 400 kg'lik toshlar bir-biriga kirib
            // "portlardi" va o'chirilgandan keyin ham qolgan katta tezliklari Rapier solveri orqali o'yinchi
            // mashinasini asta-sekin qiyshaytirib, ag'darardi (Tog' dovonida tik turgan mashina ham og'ardi).
            if (rb && rb.isEnabled() && slots.current[i].bornAt === -Infinity) rb.setEnabled(false);
          }}
          colliders={false}
          // Yashirin joylar bir-biridan uzoqda — toshlar hech qachon bir-birining ichida yaratilmaydi
          position={[i * 8, HIDDEN_Y, 0]}
          canSleep={false}
        >
          <BallCollider args={[RADIUS]} mass={MASS} friction={0.9} restitution={0.2} />
          <mesh scale={[RADIUS, RADIUS * 0.9, RADIUS]} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={rockColor} flatShading roughness={1} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}
