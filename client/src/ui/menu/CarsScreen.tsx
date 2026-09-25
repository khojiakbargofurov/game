import { useEffect, useRef } from 'react';
import { CARS, MAX_UPGRADE_LEVEL, carStats, type UpgradeId } from '@game/shared';
import { useCarChoice } from '../../store/carChoice';
import { useGarage } from '../../store/garage';
import { preloadCar } from '../../game/car/carGeometry';
import { CarIcon } from '../CarIcon';

/** Kartadagi ko'rsatkichlar — garajdagi upgrade darajalaridan (fizika hamma mashinada bir xil) */
const STATS: { id: UpgradeId; label: string }[] = [
  { id: 'engine', label: 'Tezlik' },
  { id: 'weight', label: 'Tezlanish' },
  { id: 'grip', label: 'Tutish' },
  { id: 'steering', label: 'Boshqaruv' },
  { id: 'nitro', label: 'Nitro' },
];

const isTyping = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
};

/** Mashina tanlash: pastda karusel (←/→), o'ngda ko'rsatkichlar kartasi; 3D mashina orqada darhol almashadi */
export function CarsScreen({
  onNext,
  onGarage,
  keysEnabled,
}: {
  onNext: () => void;
  onGarage: () => void;
  keysEnabled: boolean;
}) {
  const carId = useCarChoice((s) => s.car);
  const setCar = useCarChoice((s) => s.setCar);
  const look = useGarage((s) => s.look);
  const levels = useGarage((s) => s.levels);
  const index = CARS.findIndex((c) => c.id === carId);
  const car = CARS[index];
  const kmh = Math.round(carStats(levels).maxSpeed * 3.6);

  const active = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Yangi brauzerlarda scrollIntoView Promise qaytaradi — effect'dan qaytarilmasin
    active.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [carId]);

  useEffect(() => {
    if (!keysEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const step = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : 0;
      if (step) {
        const next = CARS[(index + step + CARS.length) % CARS.length];
        preloadCar(next.id);
        setCar(next.id);
      } else if (e.code === 'Enter') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, keysEnabled, onNext, setCar]);

  return (
    <>
      <aside className="hub-card hub-car-card">
        <small className="hub-kicker">
          {index + 1} / {CARS.length}
        </small>
        <h2 className="hub-car-name">{car.label}</h2>
        <div className="hub-speed">
          <strong>{kmh}</strong> km/soat
        </div>
        <ul className="hub-stats">
          {STATS.map((s) => {
            const level = levels[s.id];
            return (
              <li key={s.id}>
                <span>{s.label}</span>
                <div className="hub-bar" aria-label={`${s.label}: ${level}/${MAX_UPGRADE_LEVEL}`}>
                  <i style={{ width: `${30 + (70 * level) / MAX_UPGRADE_LEVEL}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <button className="hub-btn" onClick={onGarage}>
          🔧 Garajda kuchaytirish
        </button>
      </aside>

      <div className="hub-bottom">
        <div className="hub-carousel" role="radiogroup" aria-label="Mashina">
          {CARS.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={c.id === carId}
              ref={c.id === carId ? active : undefined}
              className={`hub-car${c.id === carId ? ' active' : ''}`}
              onClick={() => setCar(c.id)}
              onPointerEnter={() => preloadCar(c.id)}
            >
              <CarIcon color={c.color} shape={c.icon} look={c.id === carId ? look : undefined} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <div className="hub-footer">
          <span className="hub-hint">←/→ — mashina · sichqoncha bilan aylantiring</span>
          <button className="hub-go" onClick={onNext}>
            <span>Davom ▶</span>
          </button>
        </div>
      </div>
    </>
  );
}
