import { useEffect, useState, type CSSProperties } from 'react';
import { CARS, ROOM } from '@game/shared';
import { backToMenu, startOnlineRace, updateRoomSettings } from '../net/session';
import { useNetStore } from '../store/netStore';
import { TopBar } from './menu/TopBar';
import { ConditionFields, Segmented, TrackCards } from './menu/raceFields';

const carLabel = (id: string) => CARS.find((c) => c.id === id)?.label ?? id;

/**
 * Xona (Asphalt uslubi): chapda kod va o'yinchilar paneli, o'ngda sharoit, pastda trassalar va Start.
 * Orqada 3D mashina shourum kamerasida aylanadi. Sharoitni faqat xona egasi o'zgartiradi.
 */
export function RoomLobby() {
  const room = useNetStore((s) => s.room);
  const selfId = useNetStore((s) => s.selfId);
  const error = useNetStore((s) => s.error);
  const [copied, setCopied] = useState(false);

  // Esc — xonadan chiqish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.code === 'Escape' && backToMenu();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!room) return null;

  const me = room.players.find((p) => p.id === selfId);
  const isHost = !!me?.isHost;
  const enough = room.players.length >= ROOM.MIN_PLAYERS;
  const readOnly = !isHost;
  const empty = Math.max(0, ROOM.MAX_PLAYERS - room.players.length);

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
    <div className="hub">
      <TopBar title="Xona" onBack={backToMenu} name={me?.name ?? ''} />
      <div className="hub-body">
        <section className="hub-lobby">
          <button className="hub-code" onClick={copy} title="Nusxa olish">
            <small>{copied ? 'Nusxa olindi ✓' : 'Xona kodi · bosib nusxa oling'}</small>
            <strong>{room.code}</strong>
          </button>

          <h3 className="hub-kicker">
            Poygachilar · {room.players.length}/{ROOM.MAX_PLAYERS}
          </h3>
          <ul className="hub-players">
            {room.players.map((p, i) => (
              <li
                key={p.id}
                className={p.id === selfId ? 'me' : undefined}
                style={{ '--pc': p.color, animationDelay: `${i * 0.04}s` } as CSSProperties}
              >
                <span className="hub-player-slot">{p.slot + 1}</span>
                <span className="hub-player-name">
                  {p.name}
                  {p.id === selfId && <em> · siz</em>}
                </span>
                <span className="hub-player-car">{carLabel(p.car)}</span>
                {p.isHost && (
                  <span className="hub-player-host" title="Xona egasi">
                    👑
                  </span>
                )}
              </li>
            ))}
            {Array.from({ length: empty }, (_, i) => (
              <li key={`empty-${i}`} className="empty">
                <span className="hub-player-slot">·</span>
                <span className="hub-player-name">Bo'sh joy</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="hub-card hub-conditions">
          <ConditionFields
            season={room.settings.season}
            weather={room.settings.weather}
            readOnly={readOnly}
            onChange={updateRoomSettings}
          />
          <h3 className="hub-kicker">Upgrade'lar</h3>
          <Segmented
            label="Upgrade'lar"
            items={[
              { id: 'on', text: '🔧 Yoqilgan' },
              { id: 'off', text: '⚖️ Hamma teng' },
            ]}
            value={room.settings.upgradesEnabled ? 'on' : 'off'}
            disabled={readOnly}
            onChange={(v) => updateRoomSettings({ upgradesEnabled: v === 'on' })}
          />
          {readOnly && <p className="hub-note">Sharoitni xona egasi tanlaydi</p>}
        </aside>

        <div className="hub-bottom">
          <TrackCards
            value={room.settings.trackId}
            readOnly={readOnly}
            onChange={(trackId) => updateRoomSettings({ trackId })}
          />
          <div className="hub-footer">
            <span className={`hub-hint${error ? ' error' : ''}`}>
              {error ??
                (isHost
                  ? enough
                    ? "Hamma tayyor bo'lsa — Start"
                    : `Kamida ${ROOM.MIN_PLAYERS} o'yinchi kerak — kodni do'stlarga yuboring`
                  : 'Xona egasi poygani boshlashini kuting…')}
            </span>
            {isHost ? (
              <button className="hub-go" onClick={startOnlineRace} disabled={!enough}>
                <span>Start ▶</span>
              </button>
            ) : (
              <div className="hub-waiting">
                <i />
                <i />
                <i />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
