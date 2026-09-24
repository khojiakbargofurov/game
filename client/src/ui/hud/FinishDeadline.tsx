import { useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useNetStore } from '../../store/netStore';
import { useAnimationFrame } from './useAnimationFrame';

/**
 * Onlayn: kimdir marraga yetgach, hali poygadagilarga qolgan vaqt ko'rsatiladi
 * (aks holda poyga "birdan" tugagandek tuyuladi).
 */
export function FinishDeadline() {
  const deadline = useNetStore((s) => s.finishDeadline);
  const phase = useGameStore((s) => s.phase);
  const text = useRef<HTMLSpanElement>(null);

  useAnimationFrame(() => {
    if (!deadline || !text.current) return;
    text.current.textContent = String(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
  });

  if (!deadline || phase !== 'racing') return null;
  return (
    <div className="deadline">
      ⏱ Kimdir marraga yetdi! Poyga <span ref={text} /> s dan keyin tugaydi
    </div>
  );
}
