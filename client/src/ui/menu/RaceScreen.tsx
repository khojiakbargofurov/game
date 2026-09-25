import { createRoom, startSolo } from '../../net/session';
import { MAX_BOTS, useMenuChoice } from '../../store/raceSettings';
import { useNetStore } from '../../store/netStore';
import { DIFFICULTIES } from '../../game/bots/botDriver';
import { ConditionFields, Segmented, TrackCards } from './raceFields';
import type { Flow } from '../Menu';

/**
 * Poyga sharoiti: pastda trassa kartalari, o'ngda fasl/ob-havo/botlar. Tanlov darhol fondagi
 * 3D dunyoga qo'llanadi. Oxirgi tugma — yakka start yoki onlayn xona yaratish.
 */
export function RaceScreen({ flow, name }: { flow: Flow; name: string }) {
  const choice = useMenuChoice();
  const connected = useNetStore((s) => s.connected);
  const busy = useNetStore((s) => s.busy);
  const error = useNetStore((s) => s.error);
  const trimmed = name.trim();
  const canOnline = connected && !busy && trimmed.length > 0;

  return (
    <>
      <aside className="hub-card hub-conditions">
        <ConditionFields season={choice.season} weather={choice.weather} onChange={choice.set} />

        {flow === 'solo' && (
          <>
            <h3 className="hub-kicker">Raqiblar</h3>
            <div className="hub-stepper" aria-label="Botlar soni">
              <button onClick={() => choice.set({ bots: Math.max(0, choice.bots - 1) })} disabled={choice.bots === 0} aria-label="Kamroq bot">
                −
              </button>
              <span>
                🤖 <strong>{choice.bots}</strong> bot
              </span>
              <button
                onClick={() => choice.set({ bots: Math.min(MAX_BOTS, choice.bots + 1) })}
                disabled={choice.bots === MAX_BOTS}
                aria-label="Ko'proq bot"
              >
                +
              </button>
            </div>
            <Segmented
              label="Botlar qiyinligi"
              items={DIFFICULTIES.map((d) => ({ id: d.id, text: d.label }))}
              value={choice.difficulty}
              disabled={choice.bots === 0}
              onChange={(difficulty) => choice.set({ difficulty })}
            />
          </>
        )}
        {flow === 'online' && <p className="hub-note">Xona shu sharoit bilan yaratiladi — keyin lobby'da o'zgartirish mumkin</p>}
      </aside>

      <div className="hub-bottom">
        <TrackCards value={choice.trackId} onChange={(trackId) => choice.set({ trackId })} />
        <div className="hub-footer">
          {flow === 'online' ? (
            <>
              <span className="hub-hint">
                {error ?? (!connected ? "Server bilan aloqa yo'q" : !trimmed ? 'Yuqorida ismingizni kiriting' : '')}
              </span>
              <button className="hub-go" disabled={!canOnline} onClick={() => createRoom(trimmed)}>
                <span>Xona yaratish ▶</span>
              </button>
            </>
          ) : (
            <>
              <span className="hub-hint">Tanlov darhol fonda ko'rinadi</span>
              <button className="hub-go" onClick={startSolo}>
                <span>Start ▶</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
