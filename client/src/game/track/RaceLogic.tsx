import { useFrame } from '@react-three/fiber';
import { BOOST_RADIUS, BOOST_RESPAWN_MS, COIN_RADIUS } from '@game/shared';
import { reportCheckpoint, reportCoin } from '../../net/session';
import { useGameStore } from '../../store/gameStore';
import { useNetStore } from '../../store/netStore';
import { pickups } from '../../store/pickups';
import { carTarget } from '../carTarget';
import { activeTrack } from '../../store/raceSettings';
import { ownCarStats, useGarage } from '../../store/garage';

const COIN_R2 = COIN_RADIUS * COIN_RADIUS;
const BOOST_R2 = BOOST_RADIUS * BOOST_RADIUS;

const dist2 = (p: readonly number[], x: number, y: number, z: number) =>
  (p[0] - x) ** 2 + (p[1] - y) ** 2 + (p[2] - z) ** 2;

/**
 * Poyga logikasi (har kadrda): countdown tugashi, checkpointlar, tanga va boost yig'ish.
 *  - yakka rejim: checkpoint/marra shu yerda tasdiqlanadi;
 *  - onlayn: checkpoint serverga yuboriladi, tasdiq `race:checkpointAck` orqali keladi (session.ts);
 *    tangalar darhol ko'rsatiladi, server alohida tekshirib natijaga qo'shadi.
 */
export function RaceLogic() {
  useFrame(() => {
    const game = useGameStore.getState();
    const { screen, mode } = useNetStore.getState();
    if (screen !== 'race') return;
    const now = performance.now();

    if (game.phase === 'countdown') {
      if (now >= game.countdownEndsAt) game.startRace(game.countdownEndsAt);
      return;
    }
    if (game.phase !== 'racing' && game.phase !== 'finished') return;
    const { x, y, z } = carTarget.position;
    const { CHECKPOINTS, COINS, BOOSTS } = activeTrack();

    // Checkpoint: faqat navbatdagisi, gorizontal radius ichida
    const cp = CHECKPOINTS[game.nextCheckpoint];
    if (game.phase === 'racing' && cp) {
      const dx = cp.position[0] - x;
      const dz = cp.position[2] - z;
      if (dx * dx + dz * dz < cp.radius * cp.radius && Math.abs(cp.position[1] - y) < 8) {
        if (mode === 'online') reportCheckpoint(cp.index);
        else {
          game.passCheckpoint(cp.index, {
            position: [cp.position[0], cp.position[1] + 1.2, cp.position[2]],
            yaw: cp.yaw,
          });
          if (cp.isFinish) {
            game.finish(now);
            // Yakka rejim: yig'ilgan tangalar garaj hamyoniga
            useGarage.getState().deposit(useGameStore.getState().coins);
          }
        }
      }
    }

    // Tangalar
    for (let i = 0; i < COINS.length; i++) {
      if (!pickups.coins[i] && dist2(COINS[i].position, x, y, z) < COIN_R2) {
        pickups.coins[i] = 1;
        game.addCoin();
        if (mode === 'online') reportCoin(i);
      }
    }

    // Boost-kristallar
    for (let i = 0; i < BOOSTS.length; i++) {
      const taken = pickups.boostTakenAt[i];
      const available = !taken || now - taken > BOOST_RESPAWN_MS;
      if (available && dist2(BOOSTS[i].position, x, y, z) < BOOST_R2) {
        pickups.boostTakenAt[i] = now;
        game.startBoost(now + ownCarStats().boostDurationMs);
      }
    }
  });
  return null;
}
