import { useRef } from 'react';
import { CHECKPOINTS } from '@game/shared';
import { useGameStore } from '../../store/gameStore';
import { computeGuidance } from './guidance';
import { useAnimationFrame } from './useAnimationFrame';

/** Tepa markazda: keyingi checkpointga strelka, masofa va ogohlantirishlar */
export function DirectionArrow() {
  const next = useGameStore((s) => s.nextCheckpoint);
  const phase = useGameStore((s) => s.phase);
  const arrow = useRef<SVGSVGElement>(null);
  const dist = useRef<HTMLSpanElement>(null);
  const warn = useRef<HTMLDivElement>(null);
  const angle = useRef(0);

  useAnimationFrame(() => {
    const g = computeGuidance(useGameStore.getState().nextCheckpoint);
    if (!g || !arrow.current || !dist.current || !warn.current) return;
    // Burchakni silliqlash (eng qisqa yo'l bo'yicha)
    const diff = Math.atan2(Math.sin(g.angle - angle.current), Math.cos(g.angle - angle.current));
    angle.current += diff * 0.2;
    arrow.current.style.transform = `rotate(${angle.current}rad)`;
    dist.current.textContent = `${Math.max(0, Math.round(g.distance))} m`;
    const msg = g.missed ? "Checkpoint o'tkazib yuborildi — orqaga!" : g.wrongWay ? "Teskari yo'nalish!" : '';
    warn.current.textContent = msg;
    warn.current.hidden = !msg;
  });

  if (phase === 'finished' || next >= CHECKPOINTS.length) return null;
  const isFinish = CHECKPOINTS[next]?.isFinish;
  return (
    <div className="guidance">
      <svg ref={arrow} className="guide-arrow" viewBox="-20 -20 40 40" aria-hidden>
        <path d="M0 -17 L13 9 L0 3 L-13 9 Z" />
      </svg>
      <div className="guide-label">
        {isFinish ? '🏁 Marra' : `🚩 ${next + 1}/${CHECKPOINTS.length - 1}`} · <span ref={dist}>—</span>
      </div>
      <div ref={warn} className="guide-warn" hidden />
    </div>
  );
}
