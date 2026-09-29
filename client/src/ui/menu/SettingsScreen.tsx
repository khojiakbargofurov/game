import { useState } from 'react';
import { QUALITY_LABELS, useQuality, type Quality } from '../../store/quality';
import { Segmented } from './raceFields';
import { isTouch } from '../../store/device';
import { useControls, type ControlScheme } from '../../store/controls';
import { calibrateTilt, requestTiltPermission } from '../../input/tilt';

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

const ON_OFF = [
  { id: 'on', text: 'Yoqilgan' },
  { id: 'off', text: "O'chiq" },
] as const;
const onOff = (v: boolean) => (v ? 'on' : 'off');

/** Telefon boshqaruvi: rul sxemasi, tilt sezgirligi, avto-gaz, vibratsiya */
function TouchSettings() {
  const c = useControls();
  const [denied, setDenied] = useState(false);
  const chooseScheme = async (scheme: ControlScheme) => {
    // iOS: ruxsat faqat tugma bosilishi ichida so'raladi
    if (scheme === 'tilt' && !(await requestTiltPermission())) return setDenied(true);
    setDenied(false);
    c.set({ scheme });
  };
  return (
    <>
      <h3 className="hub-kicker">Boshqaruv (telefon)</h3>
      <Segmented
        label="Rul"
        items={[
          { id: 'buttons', text: '◀ ▶ Tugmalar' },
          { id: 'tilt', text: '📱 Egish (tilt)' },
        ]}
        value={c.scheme}
        onChange={(v) => void chooseScheme(v)}
      />
      {denied && <p className="hub-note">Harakat sensoriga ruxsat berilmadi</p>}
      {c.scheme === 'tilt' && (
        <div className="hub-stepper">
          <span>Sezgirlik</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={c.tiltSensitivity}
            onChange={(e) => c.set({ tiltSensitivity: Number(e.target.value) })}
          />
          <button onClick={calibrateTilt} title="Joriy holatni to'g'ri deb olish">
            ⊙
          </button>
        </div>
      )}
      <p className="hub-note">Avto-gaz</p>
      <Segmented label="Avto-gaz" items={[...ON_OFF]} value={onOff(c.autoAccel)} onChange={(v) => c.set({ autoAccel: v === 'on' })} />
      <p className="hub-note">Vibratsiya</p>
      <Segmented label="Vibratsiya" items={[...ON_OFF]} value={onOff(c.haptics)} onChange={(v) => c.set({ haptics: v === 'on' })} />
      <p className="hub-note">Tugmalar</p>
      <Segmented
        label="Tugmalar o'lchami"
        items={[
          { id: '0.85', text: 'Kichik' },
          { id: '1', text: "O'rta" },
          { id: '1.2', text: 'Katta' },
        ]}
        value={String(c.buttonScale)}
        onChange={(v) => c.set({ buttonScale: Number(v) })}
      />
      <Segmented
        label="Qo'l"
        items={[
          { id: 'right', text: "O'ng qo'l" },
          { id: 'left', text: "Chap qo'l" },
        ]}
        value={c.leftHanded ? 'left' : 'right'}
        onChange={(v) => c.set({ leftHanded: v === 'left' })}
      />
    </>
  );
}

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
      {isTouch && <TouchSettings />}
      {!isTouch && (
        <>
          <h3 className="hub-kicker">Klaviatura</h3>
          <dl className="hub-keys">
            {CONTROLS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </aside>
  );
}
