import { SEASONS, TRACK_DEFS, WEATHERS, type Season, type TrackId, type Weather } from '@game/shared';

export interface PickerValue {
  trackId: TrackId;
  season: Season;
  weather: Weather;
}

const SEASON_ICON: Record<Season, string> = { summer: '☀️', autumn: '🍂', winter: '⛄', spring: '🌸' };
const WEATHER_ICON: Record<Weather, string> = { clear: '🌤️', rain: '🌧️', snow: '🌨️' };

/**
 * Trassa, fasl, ob-havo tanlash. Menyuda — o'z tanlovimiz, lobby'da — xona sozlamasi
 * (`onChange` berilmasa — faqat ko'rsatadi: host bo'lmagan o'yinchilar uchun).
 */
export function RaceSettingsPicker({ value, onChange }: { value: PickerValue; onChange?: (patch: Partial<PickerValue>) => void }) {
  const readOnly = !onChange;
  return (
    <div className="race-settings">
      <div className="divider">trassa</div>
      <div className="track-picker" role="radiogroup" aria-label="Trassa">
        {TRACK_DEFS.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={t.id === value.trackId}
            className={t.id === value.trackId ? 'active' : undefined}
            disabled={readOnly && t.id !== value.trackId}
            onClick={() => onChange?.({ trackId: t.id as TrackId })}
          >
            <strong>{t.name}</strong>
            <span>{t.description}</span>
          </button>
        ))}
      </div>

      <div className="divider">fasl</div>
      <div className="segmented" role="radiogroup" aria-label="Fasl">
        {SEASONS.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={s.id === value.season}
            className={s.id === value.season ? 'active' : undefined}
            disabled={readOnly && s.id !== value.season}
            onClick={() => onChange?.({ season: s.id })}
          >
            {SEASON_ICON[s.id]} {s.label}
          </button>
        ))}
      </div>

      <div className="divider">ob-havo</div>
      <div className="segmented" role="radiogroup" aria-label="Ob-havo">
        {WEATHERS.map((w) => (
          <button
            key={w.id}
            role="radio"
            aria-checked={w.id === value.weather}
            className={w.id === value.weather ? 'active' : undefined}
            disabled={readOnly && w.id !== value.weather}
            onClick={() => onChange?.({ weather: w.id })}
          >
            {WEATHER_ICON[w.id]} {w.label}
          </button>
        ))}
      </div>
      {value.weather !== 'clear' && <p className="note">Yo'l sirpanchiq — tormoz va burilish kuchsizroq</p>}
    </div>
  );
}
