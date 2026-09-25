import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  CARS,
  COSMETICS,
  COSMETIC_CATEGORIES,
  MAX_UPGRADE_LEVEL,
  TUNES,
  UPGRADES,
  carStats,
  cosmeticKey,
  findCosmetic,
  type CosmeticCategory,
  type CosmeticItem,
  type UpgradeId,
} from '@game/shared';
import { nextCost, useGarage, useLookPreview } from '../../store/garage';
import { useCarChoice } from '../../store/carChoice';

const ICON: Record<UpgradeId, string> = {
  engine: '⚙️',
  grip: '🛞',
  boost: '⚡',
  steering: '🎯',
  brakes: '🛑',
  weight: '🪶',
  nitro: '🔥',
};

type Tab = 'parts' | 'tune' | 'look';
const TABS: { id: Tab; icon: string; label: string; sub: string }[] = [
  { id: 'parts', icon: '🔩', label: 'Qismlar', sub: 'Kuchaytirish' },
  { id: 'tune', icon: '🎛️', label: 'Sozlash', sub: 'Bepul' },
  { id: 'look', icon: '🎨', label: "Ko'rinish", sub: "Bo'yoq · neon" },
];

const CATEGORY_LABEL: Record<CosmeticCategory, string> = { paint: "Bo'yoq", neon: 'Neon' };
/** "Zavod" tugmasi: bo'yoq — asl rang, neon — yo'q */
const NONE_LABEL: Record<CosmeticCategory, string> = { paint: 'Zavod', neon: "Yo'q" };

const MAX_TOTAL = UPGRADES.length * MAX_UPGRADE_LEVEL;

/**
 * Garaj (Asphalt uslubi): chapda bo'limlar, o'ngda buyumlar paneli, chap pastda mashina xulosasi.
 * O'rtada 3D mashina — bo'yoq/neon darhol unda ko'rinadi (sotib olinmaganlari — sinab ko'rish).
 */
export function GarageScreen() {
  const [tab, setTab] = useState<Tab>('parts');
  const levels = useGarage((s) => s.levels);
  const owned = useGarage((s) => s.owned);
  const carId = useCarChoice((s) => s.car);
  const car = CARS.find((c) => c.id === carId)!;
  const total = Object.values(levels).reduce((a, b) => a + b, 0);
  const kmh = Math.round(carStats(levels).maxSpeed * 3.6);

  return (
    <>
      <nav className="hub-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            className={`hub-tab${t.id === tab ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="hub-tab-inner">
              <span className="hub-tab-icon" aria-hidden="true">
                {t.icon}
              </span>
              <span className="hub-tile-text">
                <strong>{t.label}</strong>
                <small>
                  {t.id === 'parts' ? `${total} / ${MAX_TOTAL}` : t.id === 'look' ? `${owned.length} ta sizniki` : t.sub}
                </small>
              </span>
            </span>
          </button>
        ))}
      </nav>

      <div className="hub-garage-summary">
        <small className="hub-kicker">Garaj</small>
        <strong>{car.label}</strong>
        <div className="hub-garage-meta">
          <span>
            <b>{kmh}</b> km/soat
          </span>
          <span>
            <b>{Math.round((total / MAX_TOTAL) * 100)}%</b> kuchaytirilgan
          </span>
        </div>
        <div className="hub-bar big" aria-hidden="true">
          <i style={{ width: `${(total / MAX_TOTAL) * 100}%` }} />
        </div>
      </div>

      <aside className="hub-card hub-garage" key={tab}>
        {tab === 'parts' && <Parts />}
        {tab === 'tune' && <Tune />}
        {tab === 'look' && <Look />}
      </aside>
    </>
  );
}

/** Qismlar: har biri 5 darajali, tangaga sotib olinadi */
function Parts() {
  const wallet = useGarage((s) => s.wallet);
  const levels = useGarage((s) => s.levels);
  const buy = useGarage((s) => s.buy);
  const [flash, setFlash] = useState<UpgradeId | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onBuy = (id: UpgradeId) => {
    if (!buy(id)) return;
    setFlash(id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), 600);
  };

  return (
    <>
      <h3 className="hub-kicker">Qismlar</h3>
      <ul className="hub-upgs">
        {UPGRADES.map((u) => {
          const level = levels[u.id];
          const cost = nextCost(level);
          return (
            <li key={u.id} className={`hub-upg${flash === u.id ? ' flash' : ''}`}>
              <span className="hub-upg-icon" aria-hidden="true">
                {ICON[u.id]}
              </span>
              <div className="hub-upg-info">
                <strong>{u.label}</strong>
                <small>{u.hint}</small>
                <div className="hub-pips" aria-label={`Daraja ${level}/${MAX_UPGRADE_LEVEL}`}>
                  {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => (
                    <i key={i} className={i < level ? 'on' : i === level ? 'next' : undefined} />
                  ))}
                </div>
              </div>
              <button className="hub-buy" disabled={cost === null || wallet < cost} onClick={() => onBuy(u.id)}>
                {cost === null ? 'Maks' : `🪙 ${cost}`}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hub-note">Tangalar poyga tugagach qo'shiladi. Onlayn'da upgrade'larni xona egasi o'chirib qo'yishi mumkin.</p>
    </>
  );
}

/** Sozlash: bepul slayderlar (balans, suspensiya, drift) */
function Tune() {
  const tune = useGarage((s) => s.tune);
  const setTune = useGarage((s) => s.setTune);
  const changed = TUNES.some((t) => tune[t.id] !== 0);
  return (
    <>
      <h3 className="hub-kicker">Sozlash</h3>
      <div className="hub-tunes">
        {TUNES.map((t) => {
          const v = tune[t.id];
          return (
            <label key={t.id} className="hub-tune">
              <span className="hub-tune-head">
                <strong>{t.label}</strong>
                <b>{v === 0 ? 'Zavod' : `${v > 0 ? t.max : t.min} ${Math.round(Math.abs(v) * 100)}%`}</b>
              </span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.1}
                value={v}
                style={{ '--pos': `${((v + 1) / 2) * 100}%` } as CSSProperties}
                onChange={(e) => setTune(t.id, Number(e.target.value))}
                onDoubleClick={() => setTune(t.id, 0)}
              />
              <span className="hub-tune-ends">
                <span>{t.min}</span>
                <span>{t.max}</span>
              </span>
            </label>
          );
        })}
      </div>
      <button className="hub-btn" disabled={!changed} onClick={() => TUNES.forEach((t) => setTune(t.id, 0))}>
        ↺ Zavod sozlamasi
      </button>
      <p className="hub-note">Ikki marta bosish — bitta slayderni tiklash. Tezlik balansi maksimal tezlikni +5% gacha oshiradi, lekin tutish kamayadi.</p>
    </>
  );
}

/** Ko'rinish: sotib olinganlar darhol kiyiladi, qolganlari 3D'da sinab ko'riladi va keyin sotib olinadi */
function Look() {
  const wallet = useGarage((s) => s.wallet);
  const owned = useGarage((s) => s.owned);
  const look = useGarage((s) => s.look);
  const buyOrEquip = useGarage((s) => s.buyOrEquip);
  const unequip = useGarage((s) => s.unequip);
  const setPreview = useLookPreview((s) => s.setPreview);
  /** Sinab ko'rilayotgan (sotib olinmagan) buyum */
  const [trying, setTrying] = useState<{ cat: CosmeticCategory; item: CosmeticItem } | null>(null);

  // Bo'limdan/garajdan chiqilganda sinov ko'rinishi bekor qilinadi
  useEffect(() => () => setPreview(null), [setPreview]);

  const pick = (cat: CosmeticCategory, item: CosmeticItem | null) => {
    if (!item) {
      unequip(cat);
    } else if (owned.includes(cosmeticKey(cat, item.id))) {
      buyOrEquip(cat, item.id);
    } else {
      setTrying({ cat, item });
      setPreview({ ...look, [cat]: item.id });
      return;
    }
    setTrying(null);
    setPreview(null);
  };

  const buyTrying = () => {
    if (trying && buyOrEquip(trying.cat, trying.item.id)) {
      setTrying(null);
      setPreview(null);
    }
  };

  return (
    <>
      {COSMETIC_CATEGORIES.map((cat) => {
        const current = trying?.cat === cat ? trying.item.id : look[cat];
        return (
          <section key={cat} className="hub-look-cat">
            <h3 className="hub-kicker">
              {CATEGORY_LABEL[cat]} · <span>{findCosmetic(cat, look[cat])?.label ?? NONE_LABEL[cat]}</span>
            </h3>
            <div className="hub-swatches" role="radiogroup" aria-label={CATEGORY_LABEL[cat]}>
              <button
                role="radio"
                aria-checked={current === null}
                className={`hub-swatch${current === null ? ' active' : ''}`}
                onClick={() => pick(cat, null)}
              >
                <i className="none" />
                <span>{NONE_LABEL[cat]}</span>
              </button>
              {(COSMETICS[cat] as readonly CosmeticItem[]).map((item) => {
                const has = owned.includes(cosmeticKey(cat, item.id));
                const on = current === item.id;
                return (
                  <button
                    key={item.id}
                    role="radio"
                    aria-checked={on}
                    className={`hub-swatch${on ? ' active' : ''}${has ? '' : ' locked'}`}
                    onClick={() => pick(cat, item)}
                    title={item.label}
                  >
                    <i
                      className={`${cat === 'neon' ? 'glow' : ''}${item.metallic ? ' metal' : ''}`}
                      style={{ background: item.color, color: item.color }}
                    />
                    <span>{has ? item.label : `🪙 ${item.cost}`}</span>
                    {has && look[cat] === item.id && <em aria-label="Kiyilgan">✓</em>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {trying ? (
        <div className="hub-try">
          <span>
            Sinov: <strong>{trying.item.label}</strong>
          </span>
          <button className="hub-buy" disabled={wallet < trying.item.cost} onClick={buyTrying}>
            {wallet < trying.item.cost ? 'Tanga yetmaydi' : `Sotib olish · 🪙 ${trying.item.cost}`}
          </button>
        </div>
      ) : (
        <p className="hub-note">Qulflangan rangni bosing — mashinada sinab ko'ring. Onlayn'da boshqalar ham ko'radi.</p>
      )}
    </>
  );
}
