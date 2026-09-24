import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useNetStore, usePlace } from '../store/netStore';
import { useTrack } from '../store/raceSettings';
import { formatTime } from './formatTime';
import { SELF_ID, useBots } from '../store/bots';

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

/** HUD chap-tepa paneli: o'rin (onlayn yoki botlar bilan), vaqt, tangalar (checkpointlar — yo'nalish ko'rsatkichida) */
export function RaceStatus() {
  const { COINS, CHECKPOINTS, LAPS } = useTrack();
  const next = useGameStore((s) => s.nextCheckpoint);
  // Joriy aylana: navbatdagi checkpoint qaysi aylanaga tegishli (marradan keyin — oxirgisi)
  const lap = Math.min(LAPS, (CHECKPOINTS[next]?.lap ?? LAPS - 1) + 1);
  const time = useRaceTime();
  const coins = useGameStore((s) => s.coins);
  const online = useNetStore((s) => s.mode === 'online');
  const roomSize = useNetStore((s) => s.room?.players.length ?? 1);
  const onlinePlace = usePlace();
  // Yakka rejim: botlar bilan o'rin
  const botCount = useBots((s) => s.bots.length);
  const soloPlace = useBots((s) => s.standings.indexOf(SELF_ID) + 1);
  const place = online ? onlinePlace : soloPlace;
  const total = online ? roomSize : botCount + 1;

  return (
    <div className="race-status">
      {(online || botCount > 0) && place > 0 && (
        <div className="stat-place">
          {place}
          <small>/{total}</small>
        </div>
      )}
      <div className="stat-time">{formatTime(time)}</div>
      {LAPS > 1 && (
        <div className="stat-lap">
          Aylana {lap}/{LAPS}
        </div>
      )}
      <div>
        🪙 {coins}/{COINS.length}
      </div>
    </div>
  );
}
