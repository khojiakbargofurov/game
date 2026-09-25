import { ROOM } from '@game/shared';
import { useGarage } from '../../store/garage';
import { useNetStore } from '../../store/netStore';

/** Yuqori panel: orqaga + ekran nomi (chapda), ism, tangalar, server holati (o'ngda) */
export function TopBar({
  title,
  onBack,
  name,
  onName,
}: {
  title: string;
  onBack?: () => void;
  name: string;
  /** Berilmasa — ism faqat ko'rsatiladi (xonada o'zgartirib bo'lmaydi) */
  onName?: (v: string) => void;
}) {
  const wallet = useGarage((s) => s.wallet);
  const connected = useNetStore((s) => s.connected);
  return (
    <header className="hub-top">
      <div className="hub-top-left">
        {onBack && (
          <button className="hub-back" onClick={onBack} aria-label="Orqaga">
            <span>◀</span>
          </button>
        )}
        <h1 className="hub-title">{title}</h1>
      </div>
      <div className="hub-top-right">
        <label className="hub-chip hub-name" title="Ismingiz">
          <span aria-hidden="true">👤</span>
          {onName ? (
            <input
              value={name}
              maxLength={ROOM.NAME_MAX_LENGTH}
              placeholder="Ismingiz"
              aria-label="Ismingiz"
              onChange={(e) => onName(e.target.value)}
            />
          ) : (
            <span>{name}</span>
          )}
        </label>
        <div className="hub-chip hub-coins" title="Tangalar">
          🪙 <strong>{wallet}</strong>
        </div>
        <div className={`hub-chip hub-net${connected ? ' on' : ''}`} title={connected ? 'Server bilan aloqa bor' : "Server bilan aloqa yo'q"}>
          <i />
          {connected ? 'Onlayn' : 'Oflayn'}
        </div>
      </div>
    </header>
  );
}
