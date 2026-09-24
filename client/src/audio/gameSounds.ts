import { CHECKPOINTS } from '@game/shared';
import { useGameStore } from '../store/gameStore';
import { sfx } from './sfx';

/**
 * O'yin holati o'zgarishlariga effektlarni bog'lash — o'yin kodida ovoz chaqiruvlari
 * tarqalib ketmasligi uchun hammasi shu yerda (store'ga obuna).
 */
useGameStore.subscribe((s, prev) => {
  if (s.coins > prev.coins) sfx.coin();
  if (s.boostUntil > prev.boostUntil) sfx.boost();
  if (s.nextCheckpoint > prev.nextCheckpoint && s.nextCheckpoint < CHECKPOINTS.length) sfx.checkpoint();
  if (s.phase === 'finished' && prev.phase !== 'finished') sfx.finish();

  // Countdown boshlandi — 3, 2, 1, GO signallarini aniq vaqtga rejalashtiramiz
  if (s.phase === 'countdown' && (prev.phase !== 'countdown' || s.countdownEndsAt !== prev.countdownEndsAt)) {
    const left = (s.countdownEndsAt - performance.now()) / 1000;
    for (const k of [3, 2, 1]) if (left - k > -0.05) sfx.countdownBeep(left - k);
    sfx.countdownBeep(left, true);
  }
});
