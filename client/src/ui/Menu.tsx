import { useState, type FormEvent } from 'react';
import { ROOM } from '@game/shared';
import { createRoom, joinRoom, loadName, startSolo } from '../net/session';
import { useNetStore } from '../store/netStore';
import { QUALITY_LABELS, useQuality, type Quality } from '../store/quality';

/** Bosh menyu: ism, yakka o'yin, xona yaratish yoki kod bilan qo'shilish */
export function Menu() {
  const connected = useNetStore((s) => s.connected);
  const busy = useNetStore((s) => s.busy);
  const error = useNetStore((s) => s.error);
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');

  const trimmed = name.trim();
  const canOnline = connected && !busy && trimmed.length > 0;

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (canOnline && code.length === ROOM.CODE_LENGTH) joinRoom(code, trimmed);
  };

  return (
    <div className="overlay">
      <div className="panel menu">
        <h1>🏜️ Adventure Racer</h1>
        <p className="subtitle">O'rmon → kanyon → xarobalar → marra</p>

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

        <div className="divider">grafika</div>
        <QualityPicker />

        {!connected && <p className="note">Server bilan aloqa yo'q — faqat yakka rejim mavjud</p>}
        {connected && !trimmed && <p className="note">Onlayn o'ynash uchun ism kiriting</p>}
        {error && <p className="error">{error}</p>}
      </div>
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
