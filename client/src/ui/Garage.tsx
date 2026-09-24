import { useState } from 'react';
import { MAX_UPGRADE_LEVEL, TUNES, UPGRADES } from '@game/shared';
import { nextCost, useGarage } from '../store/garage';

const ICON = { engine: '⚙️', grip: '🛞', boost: '⚡', steering: '🎯', brakes: '🛑', weight: '🪶', nitro: '🔥' } as const;

type Tab = 'parts' | 'tune';
const TABS: { id: Tab; label: string }[] = [
  { id: 'parts', label: 'Qismlar' },
  { id: 'tune', label: 'Sozlash' },
];

/** Qismlar: tangalar evaziga upgrade'lar */
function Parts() {
  const wallet = useGarage((s) => s.wallet);
  const levels = useGarage((s) => s.levels);
  const buy = useGarage((s) => s.buy);
  return (
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
  );
}

/** Sozlash: bepul slayderlar (balans, suspensiya, drift) */
function Tune() {
  const tune = useGarage((s) => s.tune);
  const setTune = useGarage((s) => s.setTune);
  return (
    <div className="tunes">
      {TUNES.map((t) => (
        <label key={t.id} className="tune">
          <strong>{t.label}</strong>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.1}
            value={tune[t.id]}
            onChange={(e) => setTune(t.id, Number(e.target.value))}
            onDoubleClick={() => setTune(t.id, 0)}
          />
          <span className="tune-ends">
            <span>{t.min}</span>
            <span>{t.max}</span>
          </span>
        </label>
      ))}
      <p className="note">Bepul. Ikki marta bosish — zavod sozlamasi. Tezlik balansi maksimal tezlikni +5% gacha oshiradi, lekin tutish kamayadi.</p>
    </div>
  );
}

/** Garaj: poygalarda yig'ilgan tangalar evaziga qismlar va sozlash (brauzerda saqlanadi) */
export function Garage({ onClose }: { onClose: () => void }) {
  const wallet = useGarage((s) => s.wallet);
  const [tab, setTab] = useState<Tab>('parts');

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel garage" onClick={(e) => e.stopPropagation()}>
        <h2>🔧 Garaj</h2>
        <p className="wallet">
          🪙 <strong>{wallet}</strong> tanga
        </p>
        <div className="segmented" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab}
              className={t.id === tab ? 'active' : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'parts' && <Parts />}
        {tab === 'tune' && <Tune />}
        <p className="note">
          Tangalar poyga tugagach qo'shiladi. Onlayn'da upgrade va sozlashni xona egasi o'chirib qo'yishi mumkin.
        </p>
        <button onClick={onClose}>Yopish</button>
      </div>
    </div>
  );
}
