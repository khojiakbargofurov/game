import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

/** Katta 3-2-1-GO! Countdown tugash vaqti store'da (performance.now() shkalasida) */
export function Countdown() {
  const phase = useGameStore((s) => s.phase);
  const endsAt = useGameStore((s) => s.countdownEndsAt);
  const startedAt = useGameStore((s) => s.startedAt);
  const [now, setNow] = useState(performance.now());

  const showGo = phase === 'racing' && startedAt !== null && now - startedAt < 800;
  const active = phase === 'countdown' || showGo;

  useEffect(() => {
    if (!active) return;
    let raf = requestAnimationFrame(function tick() {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;
  const left = Math.ceil((endsAt - now) / 1000);
  const label = phase === 'countdown' ? String(Math.max(1, left)) : 'GO!';
  return (
    // key — har raqam o'zgarganda animatsiya qayta boshlanadi
    <div className="countdown" key={label}>
      {label}
    </div>
  );
}
