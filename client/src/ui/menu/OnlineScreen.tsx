import { useState, type FormEvent } from 'react';
import { CARS, ROOM } from '@game/shared';
import { joinRoom } from '../../net/session';
import { useNetStore } from '../../store/netStore';
import { useCarChoice } from '../../store/carChoice';
import type { Flow, HubScreen } from '../Menu';

/** Onlayn: xona yaratish (mashina → sharoit → yaratish) yoki kod bilan qo'shilish */
export function OnlineScreen({ name, go }: { name: string; go: (s: HubScreen, f?: Flow) => void }) {
  const connected = useNetStore((s) => s.connected);
  const busy = useNetStore((s) => s.busy);
  const error = useNetStore((s) => s.error);
  const [code, setCode] = useState('');
  const carId = useCarChoice((s) => s.car);
  const car = CARS.find((c) => c.id === carId)!;
  const trimmed = name.trim();
  const canOnline = connected && !busy && trimmed.length > 0;

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (canOnline && code.length === ROOM.CODE_LENGTH) joinRoom(code, trimmed);
  };

  return (
    <nav className="hub-tiles">
      <button className="hub-tile primary" disabled={!connected} onClick={() => go('cars', 'online')}>
        <span className="hub-tile-inner">
          <span className="hub-tile-icon" aria-hidden="true">
            ➕
          </span>
          <span className="hub-tile-text">
            <strong>Xona yaratish</strong>
            <small>Mashina va trassani tanlang, kodni do'stlarga yuboring</small>
          </span>
        </span>
      </button>

      <form className="hub-tile hub-join" onSubmit={onJoin}>
        <span className="hub-tile-inner">
          <span className="hub-tile-icon" aria-hidden="true">
            🔑
          </span>
          <span className="hub-tile-text">
            <strong>Kod bilan qo'shilish</strong>
            <small>Mashinangiz: {car.label}</small>
            <span className="hub-join-row">
              <input
                value={code}
                maxLength={ROOM.CODE_LENGTH}
                placeholder="KOD"
                aria-label="Xona kodi"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              />
              <button type="submit" className="hub-btn" disabled={!canOnline || code.length !== ROOM.CODE_LENGTH}>
                Kirish
              </button>
            </span>
          </span>
        </span>
      </form>

      {!connected && <p className="hub-note warn">Server bilan aloqa yo'q — faqat yakka rejim mavjud</p>}
      {connected && !trimmed && <p className="hub-note warn">Onlayn o'ynash uchun yuqorida ismingizni kiriting</p>}
      {error && <p className="hub-note error">{error}</p>}
    </nav>
  );
}
