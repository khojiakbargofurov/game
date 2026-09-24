import { useEffect, useState } from 'react';
import { COINS } from '@game/shared';
import { useGameStore } from '../store/gameStore';
import { useNetStore, usePlace } from '../store/netStore';
import { formatTime } from './formatTime';

/** Joriy poyga vaqti — o'zi ~20 Hz yangilanadi */
function useRaceTime() {
  const startedAt = useGameStore((s) => s.startedAt);
  const finishedAt = useGameStore((s) => s.finishedAt);
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    if (!startedAt || finishedAt) return;
    const id = setInterval(() => setNow(performance.now()), 50);
    return () => clearInterval(id);
  }, [startedAt, finishedAt]);
  if (!startedAt) return 0;
  return Math.max(0, (finishedAt ?? now) - startedAt);
}

/** HUD chap-tepa paneli: o'rin (onlayn), vaqt, tangalar (checkpointlar — yo'nalish ko'rsatkichida) */
export function RaceStatus() {
  const time = useRaceTime();
  const coins = useGameStore((s) => s.coins);
  const online = useNetStore((s) => s.mode === 'online');
  const total = useNetStore((s) => s.room?.players.length ?? 1);
  const place = usePlace();

  return (
    <div className="race-status">
      {online && place > 0 && (
        <div className="stat-place">
          {place}
          <small>/{total}</small>
        </div>
      )}
      <div className="stat-time">{formatTime(time)}</div>
      <div>
        🪙 {coins}/{COINS.length}
      </div>
    </div>
  );
}
