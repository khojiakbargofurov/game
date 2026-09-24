import { useState } from 'react';
import {
  CARS,
  COSMETICS,
  COSMETIC_CATEGORIES,
  MAX_UPGRADE_LEVEL,
  TUNES,
  UPGRADES,
  cosmeticKey,
  type CosmeticCategory,
  type CosmeticItem,
} from '@game/shared';
import { nextCost, useGarage } from '../store/garage';
import { useCarChoice } from '../store/carChoice';
import { CarIcon } from './CarIcon';

const ICON = { engine: '⚙️', grip: '🛞', boost: '⚡', steering: '🎯', brakes: '🛑', weight: '🪶', nitro: '🔥' } as const;

type Tab = 'parts' | 'tune' | 'look';
const TABS: { id: Tab; label: string }[] = [
  { id: 'parts', label: 'Qismlar' },
  { id: 'tune', label: 'Sozlash' },
  { id: 'look', label: "Ko'rinish" },
];

const CATEGORY_LABEL: Record<CosmeticCategory, string> = {
  paint: "Bo'yoq",
  rim: 'Disklar',
  spoiler: 'Spoyler',
  neon: 'Neon',
};
/** "Zavod" tugmasi yorlig'i: bo'yoq/disk — asl rang, spoyler/neon — yo'q */
const NONE_LABEL: Record<CosmeticCategory, string> = { paint: 'Zavod', rim: 'Zavod', spoiler: "Yo'q", neon: "Yo'q" };

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

/** Ko'rinish: bo'yoq, disk, spoyler, neon — bir marta sotib olinadi, keyin istalgancha kiyiladi */
function Look() {
  const wallet = useGarage((s) => s.wallet);
  const owned = useGarage((s) => s.owned);
  const look = useGarage((s) => s.look);
  const buyOrEquip = useGarage((s) => s.buyOrEquip);
  const unequip = useGarage((s) => s.unequip);
  const car = useCarChoice((s) => s.car);
  const def = CARS.find((c) => c.id === car)!;

  return (
    <div className="looks">
      <div className="look-preview">
        <CarIcon color={def.color} shape={def.icon} look={look} />
      </div>
      {COSMETIC_CATEGORIES.map((cat) => (
        <section key={cat} className="look-cat">
          <strong>
            {CATEGORY_LABEL[cat]}
            {cat === 'rim' && def.fixedRims && <small className="look-hint"> — {def.label}ga ta'sir qilmaydi</small>}
          </strong>
          <div className="swatches" role="radiogroup" aria-label={CATEGORY_LABEL[cat]}>
            <button
              role="radio"
              aria-checked={look[cat] === null}
              className={look[cat] === null ? 'active' : undefined}
              onClick={() => unequip(cat)}
            >
              <i className="swatch none" />
              <span>{NONE_LABEL[cat]}</span>
            </button>
            {(COSMETICS[cat] as readonly CosmeticItem[]).map((item) => {
              const has = owned.includes(cosmeticKey(cat, item.id));
              const on = look[cat] === item.id;
              return (
                <button
                  key={item.id}
                  role="radio"
                  aria-checked={on}
                  className={on ? 'active' : undefined}
                  disabled={!has && wallet < item.cost}
                  onClick={() => buyOrEquip(cat, item.id)}
                  title={has ? item.label : `${item.label} — 🪙 ${item.cost}`}
                >
                  <i className={`swatch${item.metallic ? ' metal' : ''}`} style={{ background: item.color }} />
                  <span>{has ? item.label : `🪙 ${item.cost}`}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="note">Bosing — sotib olinadi va darhol kiyiladi. Onlayn'da boshqa o'yinchilar ham ko'radi.</p>
    </div>
  );
}

/** Garaj: poygalarda yig'ilgan tangalar evaziga qismlar, sozlash va ko'rinish (brauzerda saqlanadi) */
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
        {tab === 'look' && <Look />}
        <p className="note">
          Tangalar poyga tugagach qo'shiladi. Onlayn'da upgrade va sozlashni xona egasi o'chirib qo'yishi mumkin.
        </p>
        <button onClick={onClose}>Yopish</button>
      </div>
    </div>
  );
}
