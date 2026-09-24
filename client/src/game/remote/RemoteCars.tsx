import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { Quaternion, Vector3, type Group } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { CAR, NET, type PlayerInfo } from '@game/shared';
import { serverNow } from '../../net/serverClock';
import { remoteBuffers } from '../../net/snapshotBuffer';
import { useNetStore } from '../../store/netStore';
import { CarBody } from '../car/CarBody';
import { Wheel } from '../car/Wheel';
import { WHEEL_REST_Y, useCarModel } from '../car/carGeometry';
import { NameTag } from './NameTag';

const [HX, HY, HZ] = CAR.CHASSIS_HALF_EXTENTS;
const HIDDEN = { x: 0, y: -500, z: 0 };

/**
 * Boshqa o'yinchining mashinasi: snapshot buferidan ~100 ms kechikish bilan interpolyatsiya.
 * Kinematik rigid body — o'z mashinamiz unga urilishi mumkin (u esa bizni itaradi, lekin fizikasi yo'q).
 */
function RemoteCar({ player }: { player: PlayerInfo }) {
  const { wheelX, wheelDrop } = useCarModel(player.car);
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<Group>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const pos = useRef(new Vector3());
  const quat = useRef(new Quaternion());
  const spin = useRef(0);

  useFrame((_, dt) => {
    const buffer = remoteBuffers.get(player.id);
    const rb = body.current;
    const has = !!buffer && buffer.sample(serverNow() - NET.INTERP_DELAY_MS, pos.current, quat.current);
    if (visual.current) visual.current.visible = has;
    if (!rb) return;
    if (!has) {
      // Ma'lumot yo'q (masalan, qayta start paytida) — collider ko'rinmas holda yo'lda qolib ketmasin
      rb.setNextKinematicTranslation(HIDDEN);
      return;
    }
    rb.setNextKinematicTranslation(pos.current);
    rb.setNextKinematicRotation(quat.current);

    // G'ildiraklar tezlikka mos aylanadi
    spin.current += (buffer!.speed() / CAR.WHEEL_RADIUS) * dt;
    for (const w of wheels.current) if (w) w.children[0].rotation.x = spin.current;
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[0, -500, 0]}>
      <CuboidCollider args={[HX, HY, HZ]} />
      <group ref={visual} visible={false}>
        <CarBody car={player.car} look={player.look} />
        {CAR.WHEEL_POSITIONS.map(([x, , z], i) => (
          <group key={i} position={[Math.sign(x) * wheelX, WHEEL_REST_Y - wheelDrop, z]}>
            <Wheel car={player.car} rim={player.look.rim} right={x < 0} ref={(el) => void (wheels.current[i] = el)} />
          </group>
        ))}
        <NameTag name={player.name} color={player.color} />
      </group>
    </RigidBody>
  );
}

/** Xonadagi boshqa barcha o'yinchilar (o'zimizdan tashqari) */
export function RemoteCars() {
  // useShallow — filter har safar yangi massiv qaytaradi, faqat tarkib o'zgarsa re-render
  const others = useNetStore(
    useShallow((s) =>
      s.mode === 'online' && s.screen === 'race' && s.room ? s.room.players.filter((p) => p.id !== s.selfId) : EMPTY,
    ),
  );
  return (
    <>
      {others.map((p) => (
        <Suspense key={p.id} fallback={null}>
          <RemoteCar player={p} />
        </Suspense>
      ))}
    </>
  );
}

const EMPTY: PlayerInfo[] = [];
