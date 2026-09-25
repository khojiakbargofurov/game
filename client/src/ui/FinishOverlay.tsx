import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ROOM } from '@game/shared';
import { backToMenu, loadName, resetRoom, startSolo } from '../net/session';
import { SELF_ID, botRuntime, useBots } from '../store/bots';
import { useGameStore } from '../store/gameStore';
import { useGarage } from '../store/garage';
import { useNetStore, usePlace } from '../store/netStore';
import { formatTime } from './formatTime';

const blurThen = (fn: () => void) => () => {
  (document.activeElement as HTMLElement | null)?.blur(); // Space/Enter tugmani qayta bosmasin
  fn();
};

/** Natijalar qatori (onlayn ham, yakka ham) */
interface Row {
  key: string;
  place: number;
  name: string;
  color: string;
  time: string;
  /** Onlayn: server tasdiqlagan tangalar */
  coins?: number;
  me: boolean;
}

/** Tangalar sanog'i 0 dan maqsadgacha "yugurib" chiqadi */
function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      setV(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/**
 * Natijalar ekrani (Asphalt uslubi): katta o'rin sarlavhasi, qiya qatorlar ketma-ket kirib keladi,
 * o'z qatorimiz ajralib turadi, pastda tanga mukofoti va tugmalar
 */
function ResultsView({
  title,
  time,
  rows,
  earned,
  bonus,
  children,
}: {
  title: string;
  time?: string;
  rows?: Row[];
  earned: number;
  bonus?: number;
  children: ReactNode;
}) {
  const wallet = useGarage((s) => s.wallet);
  const shown = useCountUp(earned + (bonus ?? 0));
  const showCoins = rows?.some((r) => r.coins !== undefined);
  return (
    <div className="hub hub-results">
      <div className="hub-res">
        <header className="hub-res-head">
          <small className="hub-kicker">Poyga yakunlandi</small>
          <h1 className="hub-res-title">{title}</h1>
          {time && <div className="hub-res-time">⏱ {time}</div>}
        </header>

        {rows && (
          <ol className="hub-res-rows">
            {rows.map((r, i) => (
              <li
                key={r.key}
                className={`${r.me ? 'me' : ''}${r.place <= 3 ? ` p${r.place}` : ''}`}
                style={{ '--pc': r.color, animationDelay: `${0.15 + i * 0.07}s` } as CSSProperties}
              >
                <span className="hub-res-place">{r.place}</span>
                <span className="hub-res-name">{r.name}</span>
                <span className="hub-res-rtime">{r.time}</span>
                {showCoins && <span className="hub-res-coins">🪙 {r.coins ?? 0}</span>}
              </li>
            ))}
          </ol>
        )}

        <div className="hub-res-reward">
          <span className="hub-res-plus">+{shown}</span>
          <span>
            tanga garajga
            {bonus ? ` (shundan ${bonus} — o'rin bonusi)` : ''}
            <small>jami 🪙 {wallet}</small>
          </span>
        </div>

        <div className="hub-res-actions">{children}</div>
      </div>
    </div>
  );
}

/** Onlayn natijalar (server yuborgan) */
function ResultsTable() {
  const results = useNetStore((s) => s.results)!;
  const selfId = useNetStore((s) => s.selfId);
  const isHost = useNetStore((s) => s.room?.players.some((p) => p.id === s.selfId && p.isHost) ?? false);
  const error = useNetStore((s) => s.error);
  const mine = results.find((r) => r.playerId === selfId);

  const rows: Row[] = results.map((r) => ({
    key: r.playerId,
    place: r.place,
    name: r.name,
    color: r.color,
    time: r.timeMs !== null ? formatTime(r.timeMs) : `DNF · ${r.checkpoints}🚩`,
    coins: r.coins,
    me: r.playerId === selfId,
  }));

  return (
    <ResultsView
      title={mine ? (mine.timeMs !== null ? `${mine.place}-o'rin` : 'DNF') : 'Natijalar'}
      time={mine?.timeMs != null ? formatTime(mine.timeMs) : undefined}
      rows={rows}
      earned={mine?.coins ?? 0}
    >
      {error && <p className="hub-note error">{error}</p>}
      <button className="hub-btn" onClick={blurThen(backToMenu)}>
        Xonadan chiqish
      </button>
      {isHost ? (
        <>
          <button className="hub-btn" onClick={blurThen(() => resetRoom(false))}>
            Lobbyga qaytish
          </button>
          <button className="hub-go" onClick={blurThen(() => resetRoom(true))}>
            <span>Qayta ▶</span>
          </button>
        </>
      ) : (
        <span className="hub-hint">Xona egasi qayta boshlashini kuting…</span>
      )}
    </ResultsView>
  );
}

/** Yakka rejim, botlar bilan: jonli natijalar (marraga yetmagan botlar — "poygada…") */
function SoloResults({ time, coins }: { time: number; coins: number }) {
  const bots = useBots((s) => s.bots);
  const standings = useBots((s) => s.standings);
  const finish = useBots((s) => s.finish);
  // Botlar marraga yetgan sari vaqtlar paydo bo'ladi — jadval yarim soniyada yangilanadi
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const rows: Row[] = standings.map((id, i) => {
    if (id === SELF_ID) {
      return { key: id, place: i + 1, name: loadName().trim() || 'Siz', color: ROOM.PLAYER_COLORS[0], time: formatTime(time), me: true };
    }
    const b = bots.find((x) => x.id === id)!;
    const t = botRuntime.get(id)?.finishMs ?? null;
    return { key: id, place: i + 1, name: b.name, color: b.color, time: t !== null ? formatTime(t) : 'poygada…', me: false };
  });

  return (
    <ResultsView
      title={finish ? `${finish.place}-o'rin` : 'Marra!'}
      time={formatTime(time)}
      rows={rows}
      earned={coins}
      bonus={finish?.bonus}
    >
      <SoloActions />
    </ResultsView>
  );
}

function SoloActions() {
  return (
    <>
      <button className="hub-btn" onClick={blurThen(backToMenu)}>
        Menyu
      </button>
      <button className="hub-go" onClick={blurThen(startSolo)}>
        <span>Qayta ▶</span>
      </button>
    </>
  );
}

/** Onlayn: o'zim marraga yetdim, boshqalar hali poygada */
function WaitingForOthers({ time }: { time: number }) {
  const place = usePlace();
  return (
    <div className="finish-banner">
      <strong>🏁 Marra! {place > 0 && `${place}-o'rin`}</strong>
      <span>{formatTime(time)}</span>
      <small>Boshqalar marraga yetishi kutilmoqda…</small>
    </div>
  );
}

/**
 * Marradan keyingi ekran.
 * Yakka rejim: vaqt + "Qayta o'ynash" (botlar bilan — natijalar jadvali). Onlayn: natijalar jadvali (server poygani tugatganda),
 * undan oldin — "boshqalar kutilmoqda" banneri (o'yinchi haydashda davom etishi mumkin).
 */
export function FinishOverlay() {
  const phase = useGameStore((s) => s.phase);
  const startedAt = useGameStore((s) => s.startedAt);
  const finishedAt = useGameStore((s) => s.finishedAt);
  const coins = useGameStore((s) => s.coins);
  const mode = useNetStore((s) => s.mode);
  const results = useNetStore((s) => s.results);
  const hasBots = useBots((s) => s.bots.length > 0);

  if (mode === 'online') {
    if (results) return <ResultsTable />;
    if (phase === 'finished' && startedAt && finishedAt) return <WaitingForOthers time={finishedAt - startedAt} />;
    return null;
  }

  if (phase !== 'finished' || !startedAt || !finishedAt) return null;
  if (hasBots) return <SoloResults time={finishedAt - startedAt} coins={coins} />;
  return (
    <ResultsView title="Marra!" time={formatTime(finishedAt - startedAt)} earned={coins}>
      <SoloActions />
    </ResultsView>
  );
}
