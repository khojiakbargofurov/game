import { MAX_UPGRADE_LEVEL, UPGRADES } from '@game/shared';
import { nextCost, useGarage } from '../store/garage';

const ICON = { engine: '⚙️', grip: '🛞', boost: '⚡', steering: '🎯', brakes: '🛑', weight: '🪶', nitro: '🔥' } as const;

/** Garaj: poygalarda yig'ilgan tangalar evaziga upgrade'lar (brauzerda saqlanadi) */
export function Garage({ onClose }: { onClose: () => void }) {
  const wallet = useGarage((s) => s.wallet);
  const levels = useGarage((s) => s.levels);
  const buy = useGarage((s) => s.buy);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel garage" onClick={(e) => e.stopPropagation()}>
        <h2>🔧 Garaj</h2>
        <p className="wallet">
          🪙 <strong>{wallet}</strong> tanga
        </p>
        <ul className="upgrades">
          {UPGRADES.map((u) => {
            const level = levels[u.id];
            const cost = nextCost(level);
            return (
              <li key={u.id}>
                <span className="u-icon">{ICON[u.id]}</span>
                <div className="u-info">
                  <strong>{u.label}</strong>
                  <span>{u.hint}</span>
                  <div className="u-level" aria-label={`Daraja ${level}/${MAX_UPGRADE_LEVEL}`}>
                    {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => (
                      <i key={i} className={i < level ? 'on' : undefined} />
                    ))}
                  </div>
                </div>
                <button className="primary" disabled={cost === null || wallet < cost} onClick={() => buy(u.id)}>
                  {cost === null ? 'Maks' : `🪙 ${cost}`}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="note">Tangalar poyga tugagach qo'shiladi. Onlayn'da upgrade'larni xona egasi o'chirib qo'yishi mumkin.</p>
        <button onClick={onClose}>Yopish</button>
      </div>
    </div>
  );
}
