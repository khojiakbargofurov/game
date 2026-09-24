import { useState, type FormEvent } from 'react';
import { CARS, ROOM } from '@game/shared';
import { createRoom, joinRoom, loadName, startSolo } from '../net/session';
import { useCarChoice } from '../store/carChoice';
import { useGarage } from '../store/garage';
import { useMenuChoice } from '../store/raceSettings';
import { Garage } from './Garage';
import { CarIcon } from './CarIcon';
import { RaceSettingsPicker } from './RaceSettingsPicker';
import { useNetStore } from '../store/netStore';
import { QUALITY_LABELS, useQuality, type Quality } from '../store/quality';

/** Bosh menyu: ism, yakka o'yin, xona yaratish yoki kod bilan qo'shilish */
export function Menu() {
  const connected = useNetStore((s) => s.connected);
  const busy = useNetStore((s) => s.busy);
  const error = useNetStore((s) => s.error);
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const [garageOpen, setGarageOpen] = useState(false);
  const wallet = useGarage((s) => s.wallet);
  const choice = useMenuChoice();

  const trimmed = name.trim();
  const canOnline = connected && !busy && trimmed.length > 0;

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (canOnline && code.length === ROOM.CODE_LENGTH) joinRoom(code, trimmed);
  };

  return (
    <div className="overlay">
      <div className="panel menu wide">
        <header>
          <h1>🏜️ Adventure Racer</h1>
          <p className="subtitle">4 trassa · F1 halqasi · 4 fasl · yomg'ir va qor</p>
        </header>
        <div className="menu-col">
          <label className="field">
            <span>Ismingiz</span>
            <input
              value={name}
              maxLength={ROOM.NAME_MAX_LENGTH}
              placeholder="Masalan, Poygachi"
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>

          <div className="divider">mashina</div>
          <CarPicker />
          <button className="garage-btn" onClick={() => setGarageOpen(true)}>
            🔧 Garaj · 🪙 {wallet}
          </button>

          <button className="primary" onClick={startSolo}>
            Yakka o'ynash
          </button>

          <div className="divider">onlayn</div>

          <button onClick={() => createRoom(trimmed)} disabled={!canOnline}>
            Xona yaratish
          </button>
          <form className="join-row" onSubmit={onJoin}>
            <input
              className="code-input"
              value={code}
              maxLength={ROOM.CODE_LENGTH}
              placeholder="KOD"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
            <button type="submit" disabled={!canOnline || code.length !== ROOM.CODE_LENGTH}>
              Qo'shilish
            </button>
          </form>
        </div>

        <div className="menu-col">
          <RaceSettingsPicker
            value={{ trackId: choice.trackId, season: choice.season, weather: choice.weather }}
            onChange={choice.set}
          />
          <p className="note">Onlayn xona shu sharoit bilan yaratiladi</p>
          <div className="divider">grafika</div>
          <QualityPicker />
        </div>

        {!connected && <p className="note">Server bilan aloqa yo'q — faqat yakka rejim mavjud</p>}
        {connected && !trimmed && <p className="note">Onlayn o'ynash uchun ism kiriting</p>}
        {error && <p className="error">{error}</p>}
      </div>
      {garageOpen && <Garage onClose={() => setGarageOpen(false)} />}
    </div>
  );
}

/** Mashina tanlash: 4 ta model, tanlov brauzerda saqlanadi va onlayn xonaga yuboriladi */
function CarPicker() {
  const car = useCarChoice((s) => s.car);
  const setCar = useCarChoice((s) => s.setCar);
  const look = useGarage((s) => s.look);
  return (
    <div className="car-picker" role="radiogroup" aria-label="Mashina">
      {CARS.map((c) => (
        <button
          key={c.id}
          role="radio"
          aria-checked={c.id === car}
          className={c.id === car ? 'active' : undefined}
          onClick={() => setCar(c.id)}
        >
          <CarIcon color={c.color} look={c.id === car ? look : undefined} />
          <span>{c.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Grafika sifati: Past / O'rta / Yuqori (sekin kompyuterlar uchun — Past) */
function QualityPicker() {
  const quality = useQuality((s) => s.quality);
  const setQuality = useQuality((s) => s.setQuality);
  return (
    <div className="segmented" role="radiogroup" aria-label="Grafika sifati">
      {(Object.keys(QUALITY_LABELS) as Quality[]).map((q) => (
        <button
          key={q}
          role="radio"
          aria-checked={q === quality}
          className={q === quality ? 'active' : undefined}
          onClick={() => setQuality(q)}
        >
          {QUALITY_LABELS[q]}
        </button>
      ))}
    </div>
  );
}
