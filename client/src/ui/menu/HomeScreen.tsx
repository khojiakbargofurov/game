import { CARS, SEASONS, TRACK_DEFS, WEATHERS } from '@game/shared';
import { startSolo } from '../../net/session';
import { useCarChoice } from '../../store/carChoice';
import { useMenuChoice } from '../../store/raceSettings';
import { SEASON_ICON, WEATHER_ICON } from './raceFields';
import type { Flow, HubScreen } from '../Menu';

/** Bosh ekran: chapda katta qiya plitkalar, o'ng pastda tanlangan mashina va tezkor start */
export function HomeScreen({
  go,
  onGarage,
  onCredits,
}: {
  go: (s: HubScreen, f?: Flow) => void;
  onGarage: () => void;
  onCredits: () => void;
}) {
  const carId = useCarChoice((s) => s.car);
  const choice = useMenuChoice();
  const car = CARS.find((c) => c.id === carId)!;
  const track = TRACK_DEFS.find((t) => t.id === choice.trackId)!;
  const season = SEASONS.find((s) => s.id === choice.season)!;
  const weather = WEATHERS.find((w) => w.id === choice.weather)!;

  return (
    <>
      <nav className="hub-tiles">
        <Tile icon="🏁" label="Yakka poyga" sub="Botlar bilan yoki yolg'iz" primary onClick={() => go('cars', 'solo')} />
        <Tile icon="🌐" label="Onlayn" sub="Do'stlar bilan xona" onClick={() => go('online')} />
        <Tile icon="🔧" label="Garaj" sub="Qismlar · sozlash · bo'yoq" onClick={onGarage} />
        <Tile icon="⚙️" label="Sozlamalar" sub="Grafika · boshqaruv" onClick={() => go('settings')} />
        <button className="hub-link" onClick={onCredits}>
          Mualliflar
        </button>
      </nav>

      <div className="hub-quick">
        <div className="hub-quick-car">
          <small>Mashinangiz</small>
          <strong>{car.label}</strong>
        </div>
        <div className="hub-quick-info">
          <span>🗺️ {track.name}</span>
          <span>
            {SEASON_ICON[season.id]} {season.label}
          </span>
          <span>
            {WEATHER_ICON[weather.id]} {weather.label}
          </span>
          {choice.bots > 0 && <span>🤖 {choice.bots}</span>}
        </div>
        <button className="hub-go" onClick={startSolo}>
          <span>Poyga ▶</span>
        </button>
      </div>
    </>
  );
}

function Tile({
  icon,
  label,
  sub,
  primary,
  onClick,
}: {
  icon: string;
  label: string;
  sub: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`hub-tile${primary ? ' primary' : ''}`} onClick={onClick}>
      <span className="hub-tile-inner">
        <span className="hub-tile-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="hub-tile-text">
          <strong>{label}</strong>
          <small>{sub}</small>
        </span>
      </span>
    </button>
  );
}
