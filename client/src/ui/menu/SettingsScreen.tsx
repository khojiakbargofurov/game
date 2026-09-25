import { QUALITY_LABELS, useQuality, type Quality } from '../../store/quality';
import { Segmented } from './raceFields';

const CONTROLS: [string, string][] = [
  ['W / ↑', 'Gaz'],
  ['S / ↓', 'Tormoz / orqaga'],
  ['A D / ← →', 'Rul'],
  ['Probel', "Qo'l tormozi (drift)"],
  ['Shift', 'Nitro'],
  ['V', 'Kamera rejimi'],
  ['Q', 'Orqaga qarash'],
  ['R', 'Trassaga qaytish'],
  ['M', "Ovozni o'chirish"],
];

/** Sozlamalar: grafika sifati va boshqaruv yo'riqnomasi */
export function SettingsScreen() {
  const quality = useQuality((s) => s.quality);
  const setQuality = useQuality((s) => s.setQuality);
  return (
    <aside className="hub-card hub-settings">
      <h3 className="hub-kicker">Grafika</h3>
      <Segmented
        label="Grafika sifati"
        items={(Object.keys(QUALITY_LABELS) as Quality[]).map((q) => ({ id: q, text: QUALITY_LABELS[q] }))}
        value={quality}
        onChange={setQuality}
      />
      <p className="hub-note">Sekin kompyuterda — "Past"</p>
      <h3 className="hub-kicker">Boshqaruv</h3>
      <dl className="hub-keys">
        {CONTROLS.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
