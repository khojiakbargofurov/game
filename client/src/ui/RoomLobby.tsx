import { useState } from 'react';
import { ROOM } from '@game/shared';
import { backToMenu, startOnlineRace, updateRoomSettings } from '../net/session';
import { useNetStore } from '../store/netStore';
import { RaceSettingsPicker } from './RaceSettingsPicker';

/** Xona: kod, o'yinchilar ro'yxati, host uchun "Start" */
export function RoomLobby() {
  const room = useNetStore((s) => s.room);
  const selfId = useNetStore((s) => s.selfId);
  const error = useNetStore((s) => s.error);
  const [copied, setCopied] = useState(false);
  if (!room) return null;

  const isHost = room.players.some((p) => p.id === selfId && p.isHost);
  const enough = room.players.length >= ROOM.MIN_PLAYERS;

  const copy = () => {
    navigator.clipboard?.writeText(room.code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };

  return (
    <div className="overlay">
      <div className="panel room">
        <p className="subtitle">Xona kodi</p>
        <button className="room-code" onClick={copy} title="Nusxa olish">
          {room.code}
        </button>
        <p className="note">{copied ? 'Nusxa olindi ✓' : "Do'stlaringizga shu kodni yuboring"}</p>

        <ul className="players">
          {room.players.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} />
              <span className="pname">
                {p.name}
                {p.id === selfId && <em> (siz)</em>}
              </span>
              {p.isHost && <span title="Xona egasi">👑</span>}
            </li>
          ))}
        </ul>
        <p className="note">
          {room.players.length}/{ROOM.MAX_PLAYERS} o'yinchi
        </p>

        <RaceSettingsPicker value={room.settings} onChange={isHost ? updateRoomSettings : undefined} />
        <div className="divider">upgrade'lar</div>
        <div className="segmented upgrade-toggle" role="radiogroup" aria-label="Upgrade'lar">
          {[true, false].map((on) => (
            <button
              key={String(on)}
              role="radio"
              aria-checked={room.settings.upgradesEnabled === on}
              className={room.settings.upgradesEnabled === on ? 'active' : undefined}
              disabled={!isHost && room.settings.upgradesEnabled !== on}
              onClick={() => isHost && updateRoomSettings({ upgradesEnabled: on })}
            >
              {on ? '🔧 Yoqilgan' : '⚖️ Hamma teng'}
            </button>
          ))}
        </div>
        {!isHost && <p className="note">Sharoitni xona egasi tanlaydi</p>}

        {isHost ? (
          <button className="primary" onClick={startOnlineRace} disabled={!enough}>
            {enough ? 'Start' : `Kamida ${ROOM.MIN_PLAYERS} o'yinchi kerak`}
          </button>
        ) : (
          <p className="note">Xona egasi poygani boshlashini kuting…</p>
        )}
        <button onClick={backToMenu}>Chiqish</button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
