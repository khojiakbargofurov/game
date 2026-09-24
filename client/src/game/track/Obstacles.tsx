import { useMemo } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { COLORS, type Track } from '@game/shared';
import { usePalette, useTrack } from '../../store/raceSettings';

interface Lying {
  position: [number, number, number];
  yaw: number;
  length: number;
}

/**
 * Yo'lga ko'ndalang yotgan to'siq: yo'l chetidan (`side` tomondan) ichkariga `length` metr kiradi.
 * Group'ning lokal +X o'qi = yo'lning chap tomoni.
 */
function placeAcross({ roadHalfWidth, trackPoint }: Track, s: number, side: number, length: number, radius: number): Lying {
  const hw = roadHalfWidth(s);
  const center = side * (hw + 2 - length / 2);
  const p = trackPoint(s, center, radius - 0.1);
  return { position: p.position, yaw: p.yaw, length };
}

/** Yiqilgan daraxt: tana + ildiz + yo'l chetidagi shox-barglar */
function Log({ position, yaw, length, side }: Lying & { side: number }) {
  const leaves = usePalette().leaves;
  const r = 0.45;
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, yaw, 0]}>
      <CylinderCollider args={[length / 2, r]} rotation={[0, 0, Math.PI / 2]} />
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.85, r, length, 7]} />
        <meshStandardMaterial color={COLORS.trunk} flatShading />
      </mesh>
      {/* Ildiz — yo'ldan tashqarida */}
      <mesh position={[side * (length / 2 + 0.2), 0.1, 0]} rotation={[0.4, 0, 0.3]} castShadow>
        <dodecahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial color={COLORS.woodDark} flatShading />
      </mesh>
      {/* Uchidagi barglar — yo'l ichida, ko'rinib turadigan ogohlantirish */}
      <mesh position={[-side * (length / 2 - 0.4), 0.5, 0]} rotation={[0, 0, side * 1.2]} castShadow>
        <coneGeometry args={[1.1, 2.2, 6]} />
        <meshStandardMaterial color={leaves} flatShading />
      </mesh>
    </RigidBody>
  );
}

/** Yiqilgan ustun: 3 ta bir-biridan biroz siljigan tosh "baraban" */
function FallenPillar({ position, yaw, length }: Lying) {
  const r = 0.7;
  const drum = length / 3;
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, yaw, 0]}>
      <CylinderCollider args={[length / 2, r]} rotation={[0, 0, Math.PI / 2]} />
      {[0, 1, 2].map((k) => (
        <mesh
          key={k}
          position={[-length / 2 + drum * (k + 0.5), 0, (k - 1) * 0.12]}
          rotation={[0.2 * k, 0.05 * (k - 1), Math.PI / 2]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[r, r, drum * 0.96, 8]} />
          <meshStandardMaterial color={COLORS.ruins} flatShading />
        </mesh>
      ))}
    </RigidBody>
  );
}

export function Obstacles() {
  const track = useTrack();
  const { logs, pillars } = useMemo(
    () => ({
      logs: track.LOGS.map((l) => ({ ...placeAcross(track, l.s, l.side, l.length, 0.45), side: l.side })),
      pillars: track.FALLEN_PILLARS.map((p) => placeAcross(track, p.s, p.side, p.length, 0.7)),
    }),
    [track],
  );
  return (
    <>
      {logs.map((l, i) => (
        <Log key={i} {...l} />
      ))}
      {pillars.map((p, i) => (
        <FallenPillar key={i} {...p} />
      ))}
    </>
  );
}
