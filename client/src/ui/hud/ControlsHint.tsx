import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { isTouch } from '../../store/device';
import { useControls } from '../../store/controls';

const SHOW_MS = 7000;

/** Boshqaruv eslatmasi — poyga boshida bir necha soniya ko'rinadi, keyin yo'qoladi */
export function ControlsHint() {
  const startedAt = useGameStore((s) => s.startedAt);
  const tilt = useControls((s) => s.scheme === 'tilt');
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    if (!startedAt) return;
    const id = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(id);
  }, [startedAt]);
  return (
    <div className={`hint ${visible ? '' : 'faded'}`}>
      {isTouch
        ? `${tilt ? 'Telefonni egib rulni boshqaring (⊙ — kalibrlash)' : '◀ ▶ — rul'} · GAZ / TORMOZ · DRIFT · ⟲ trassaga qaytish`
        : `↑↓ / W S gaz/tormoz · ←→ / A D rul · Space drift · Shift nitro · R checkpointga qaytish · V kamera · Q orqaga qarash · sichqoncha — atrofga qarash · M ovoz`}
    </div>
  );
}
