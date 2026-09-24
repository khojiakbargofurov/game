import { backToMenu, resetRoom, startSolo } from '../net/session';
import { useGameStore } from '../store/gameStore';
import { useGarage } from '../store/garage';
import { useNetStore, usePlace } from '../store/netStore';
import { formatTime } from './formatTime';

const blurThen = (fn: () => void) => () => {
  (document.activeElement as HTMLElement | null)?.blur(); // Space/Enter tugmani qayta bosmasin
  fn();
};

const PLACE_ICON = ['🥇', '🥈', '🥉'];

/** Onlayn natijalar jadvali (server yuborgan) */
function ResultsTable() {
  const results = useNetStore((s) => s.results)!;
  const selfId = useNetStore((s) => s.selfId);
  const isHost = useNetStore((s) => s.room?.players.some((p) => p.id === s.selfId && p.isHost) ?? false);
  const error = useNetStore((s) => s.error);
  const wallet = useGarage((s) => s.wallet);
  const mine = results.find((r) => r.playerId === selfId);

  return (
    <div className="overlay">
      <div className="panel results">
        <h1>🏁 Natijalar</h1>
        <table>
          <thead>
            <tr>
              <th>O'rin</th>
              <th>O'yinchi</th>
              <th>Vaqt</th>
              <th>🪙</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.playerId} className={r.playerId === selfId ? 'me' : undefined}>
                <td>{PLACE_ICON[r.place - 1] ?? r.place}</td>
                <td className="pcell">
                  <span className="dot" style={{ background: r.color }} />
                  {r.name}
                </td>
                <td className="num">{r.timeMs !== null ? formatTime(r.timeMs) : `DNF · ${r.checkpoints}🚩`}</td>
                <td className="num">{r.coins}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {mine && (
          <p className="note">
            +{mine.coins} tanga garajga (jami 🪙 {wallet})
          </p>
        )}
        {isHost ? (
          <>
            <button className="primary" onClick={blurThen(() => resetRoom(true))}>
              Qayta o'ynash
            </button>
            <button onClick={blurThen(() => resetRoom(false))}>Lobbyga qaytish</button>
          </>
        ) : (
          <p className="note">Xona egasi qayta boshlashini kuting…</p>
        )}
        <button onClick={blurThen(backToMenu)}>Xonadan chiqish</button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
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
 * Yakka rejim: vaqt + "Qayta o'ynash". Onlayn: natijalar jadvali (server poygani tugatganda),
 * undan oldin — "boshqalar kutilmoqda" banneri (o'yinchi haydashda davom etishi mumkin).
 */
export function FinishOverlay() {
  const phase = useGameStore((s) => s.phase);
  const startedAt = useGameStore((s) => s.startedAt);
  const finishedAt = useGameStore((s) => s.finishedAt);
  const coins = useGameStore((s) => s.coins);
  const mode = useNetStore((s) => s.mode);
  const results = useNetStore((s) => s.results);
  const wallet = useGarage((s) => s.wallet);

  if (mode === 'online') {
    if (results) return <ResultsTable />;
    if (phase === 'finished' && startedAt && finishedAt) return <WaitingForOthers time={finishedAt - startedAt} />;
    return null;
  }

  if (phase !== 'finished' || !startedAt || !finishedAt) return null;
  return (
    <div className="overlay">
      <div className="panel">
        <h1>🏁 Marra!</h1>
        <p className="big">{formatTime(finishedAt - startedAt)}</p>
        <p>
          Tangalar: {coins} → garajga qo'shildi (jami 🪙 {wallet})
        </p>
        <button className="primary" onClick={blurThen(startSolo)}>
          Qayta o'ynash
        </button>
        <button onClick={blurThen(backToMenu)}>Menyu</button>
      </div>
    </div>
  );
}
