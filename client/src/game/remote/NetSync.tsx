import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { NET, type NetState } from '@game/shared';
import { socket } from '../../net/socket';
import { useGameStore } from '../../store/gameStore';
import { useNetStore } from '../../store/netStore';
import { carTarget } from '../carTarget';

const SEND_INTERVAL = 1 / NET.TICK_RATE;
const round = (n: number) => Math.round(n * 1000) / 1000; // paket hajmini kichraytirish

/**
 * Onlayn poygada o'z mashina holatini serverga TICK_RATE (20 Hz) chastotada yuborish
 * va server anti-cheat tuzatishlarini qabul qilish.
 */
export function NetSync() {
  const acc = useRef(0);
  const sentRespawns = useRef(carTarget.respawns);

  useEffect(() => {
    const onCorrection = (state: NetState) => {
      carTarget.pendingCorrection = state;
    };
    socket.on('player:correction', onCorrection);
    return () => void socket.off('player:correction', onCorrection);
  }, []);

  useFrame((_, dt) => {
    const { mode, screen } = useNetStore.getState();
    if (mode !== 'online' || screen !== 'race' || useGameStore.getState().phase === 'ready') return;
    acc.current += dt;
    if (acc.current < SEND_INTERVAL) return;
    acc.current %= SEND_INTERVAL;

    const { position: p, quaternion: q, velocity: v } = carTarget;
    const respawn = carTarget.respawns !== sentRespawns.current;
    sentRespawns.current = carTarget.respawns;
    socket.volatile.emit('player:state', {
      position: [round(p.x), round(p.y), round(p.z)],
      rotation: [round(q.x), round(q.y), round(q.z), round(q.w)],
      velocity: [round(v.x), round(v.y), round(v.z)],
      ...(respawn ? { respawn: true } : {}),
    });
  });

  return null;
}
