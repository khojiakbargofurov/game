import { SEASONS, TRACK_DEFS, WEATHERS, type Season, type TrackId, type Weather } from '@game/shared';

export const SEASON_ICON: Record<Season, string> = { summer: '☀️', autumn: '🍂', winter: '⛄', spring: '🌸' };
export const WEATHER_ICON: Record<Weather, string> = { clear: '🌤️', rain: '🌧️', snow: '🌨️' };

/** Trassa kartalari foni (rasm o'rniga) */
const TRACK_BG: Record<TrackId, string> = {
  adventure: 'linear-gradient(135deg, #2f7d3a, #c9a25a)',
  mountain: 'linear-gradient(135deg, #4a5a78, #b9c3d6)',
  lake: 'linear-gradient(135deg, #1d6f8a, #6cc3c9)',
  circuit: 'linear-gradient(135deg, #8a1d2a, #e0572b)',
  alpine: 'linear-gradient(135deg, #3d5a80, #e8eef4)',
  city: 'linear-gradient(135deg, #1a1040, #ff2fa8)',
};
const TRACK_ICON: Record<TrackId, string> = { adventure: '🌲', mountain: '⛰️', lake: '🌊', circuit: '🏎️', alpine: '🏔️', city: '🌃' };

/** Qiya segmentli tanlov (fasl, ob-havo, qiyinlik, grafika...) */
export function Segmented<T extends string>({
  label,
  items,
  value,
  disabled,
  onChange,
}: {
  label: string;
  items: { id: T; text: string }[];
  value: T;
  disabled?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div className="hub-seg" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.id}
          role="radio"
          aria-checked={it.id === value}
          className={it.id === value ? 'active' : undefined}
          disabled={disabled && it.id !== value}
          onClick={() => onChange(it.id)}
        >
          {it.text}
        </button>
      ))}
    </div>
  );
}

/** Fasl va ob-havo (`readOnly` — lobby'da host bo'lmagan o'yinchi faqat ko'radi) */
export function ConditionFields({
  season,
  weather,
  readOnly,
  onChange,
}: {
  season: Season;
  weather: Weather;
  readOnly?: boolean;
  onChange: (patch: { season?: Season; weather?: Weather }) => void;
}) {
  return (
    <>
      <h3 className="hub-kicker">Fasl</h3>
      <Segmented
        label="Fasl"
        items={SEASONS.map((s) => ({ id: s.id, text: `${SEASON_ICON[s.id]} ${s.label}` }))}
        value={season}
        disabled={readOnly}
        onChange={(v) => onChange({ season: v })}
      />
      <h3 className="hub-kicker">Ob-havo</h3>
      <Segmented
        label="Ob-havo"
        items={WEATHERS.map((w) => ({ id: w.id, text: `${WEATHER_ICON[w.id]} ${w.label}` }))}
        value={weather}
        disabled={readOnly}
        onChange={(v) => onChange({ weather: v })}
      />
      {weather !== 'clear' && <p className="hub-note">Yo'l sirpanchiq — tormoz va burilish kuchsizroq</p>}
    </>
  );
}

/** Trassa kartalari qatori */
export function TrackCards({
  value,
  readOnly,
  onChange,
}: {
  value: TrackId;
  readOnly?: boolean;
  onChange: (id: TrackId) => void;
}) {
  return (
    <div className="hub-tracks" role="radiogroup" aria-label="Trassa">
      {TRACK_DEFS.map((t) => {
        const id = t.id as TrackId;
        const on = id === value;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={on}
            className={`hub-track${on ? ' active' : ''}`}
            style={{ backgroundImage: TRACK_BG[id] }}
            disabled={readOnly && !on}
            onClick={() => onChange(id)}
          >
            <span className="hub-track-icon" aria-hidden="true">
              {TRACK_ICON[id]}
            </span>
            <strong>{t.name}</strong>
            <small>{t.description}</small>
          </button>
        );
      })}
    </div>
  );
}
