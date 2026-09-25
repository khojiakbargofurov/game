import { useMemo } from 'react';
import { ConvexHullCollider, RigidBody } from '@react-three/rapier';
import { BufferAttribute, BufferGeometry } from 'three';
import { COLORS, type Ramp } from '@game/shared';
import { useTrack } from '../../store/raceSettings';
import { roadPitch, roadQuaternion } from './trackGeometry';

/** Uchburchak prizma (pona): old tomoni yerda, orqa tomoni `height` balandlikda */
function wedgeVertices({ width, length, height }: Ramp) {
  const w = width / 2;
  const l = length / 2;
  // Kirish qismi yerga biroz botirilgan — g'ildirak ilinib qolmasligi uchun
  return new Float32Array([
    -w, -0.05, -l,   w, -0.05, -l,
    -w, -0.3, l,     w, -0.3, l,
    -w, height, l,   w, height, l,
  ]);
}

function wedgeGeometry(verts: Float32Array) {
  // Low-poly: har bir yuz alohida (flat shading)
  const faces = [
    [0, 4, 1], [1, 4, 5], // qiya yuza
    [2, 3, 4], [3, 5, 4], // orqa devor
    [0, 2, 4], [1, 5, 3], // yon tomonlar
    [0, 1, 2], [1, 3, 2], // ost
  ];
  const pos: number[] = [];
  for (const f of faces) for (const i of f) pos.push(verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2]);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.computeVertexNormals();
  return geo;
}

const ZONE_COLOR = {
  forest: COLORS.wood,
  canyon: COLORS.canyonC,
  ruins: COLORS.ruins,
  circuit: COLORS.ruins,
  alpine: COLORS.alpineRock,
  city: COLORS.sidewalk,
} as const;

/** Sakrash rampalari — yo'l yo'nalishi va qiyaligiga moslab joylashtiriladi */
export function Ramps() {
  const { RAMPS, trackPoint, zoneAt } = useTrack();
  const ramps = useMemo(
    () =>
      RAMPS.map((r) => {
        const p = trackPoint(r.s, r.lateral);
        const verts = wedgeVertices(r);
        return {
          position: p.position,
          quaternion: roadQuaternion(p.yaw, roadPitch(r.s, r.length / 2)),
          verts,
          geometry: wedgeGeometry(verts),
          color: ZONE_COLOR[zoneAt(r.s)],
          ramp: r,
          slope: Math.atan2(r.height, r.length),
          slopeLength: Math.hypot(r.height, r.length),
        };
      }),
    [RAMPS, trackPoint, zoneAt],
  );

  return (
    <>
      {ramps.map((r, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={r.position} quaternion={r.quaternion}>
          <ConvexHullCollider args={[r.verts]} friction={1} />
          <mesh geometry={r.geometry} castShadow receiveShadow>
            <meshStandardMaterial color={r.color} flatShading />
          </mesh>
          {/* Ogohlantiruvchi chiziqlar qiya yuza ustida */}
          {[-1.5, 1.5].map((x) => (
            <mesh key={x} position={[x, r.ramp.height / 2 + 0.03, 0]} rotation={[-r.slope, 0, 0]}>
              <boxGeometry args={[0.45, 0.02, r.slopeLength]} />
              <meshStandardMaterial color={COLORS.gold} />
            </mesh>
          ))}
        </RigidBody>
      ))}
    </>
  );
}
